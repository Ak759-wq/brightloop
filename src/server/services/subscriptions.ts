import { addDays, canTransition, compareDates, periodAt, periodStartN, prorate, type SubAction } from "@/lib/finance";
import type { Customer, Plan, Subscription, QuotationTemplate } from "@/lib/types";
import { DomainError, notFound } from "../http";
import { newId } from "../store/types";
import { audit, fmtSub, notify, nowISO, readCounter, searchTokens, stamp, writeCounter, type Ctx } from "./core";
import { emit } from "./events";
import { loadDiscounts, priceItems, recurringAmountOf, type LineInput } from "./catalog";
import { createInvoiceTx, taxRulesFor } from "./invoices";
import { billSubscription } from "./billing";

export interface CreateSubInput {
  customerId: string;
  planId: string;
  items: LineInput[];
  discountIds: string[];
  startDate?: string | null;
  endDate?: string | null;
  paymentTermsDays?: number;
  notes?: string;
  status: "draft" | "quotation";
  quoteValidUntil?: string | null;
  templateId?: string | null;
}

async function loadPlan(ctx: Ctx, id: string) {
  const plan = await ctx.store.get<Plan>("plans", id);
  if (!plan || plan.orgId !== ctx.org.id) throw notFound("Plan");
  return plan;
}

function expiryFor(plan: Plan, start: string): string | null {
  if (!plan.termPeriods) return null;
  return addDays(periodStartN(start, plan.interval, plan.intervalCount, plan.termPeriods), -1);
}

function snapshot(s: Subscription) {
  const { _search, ...rest } = s;
  void _search;
  return rest;
}

async function writeVersion(ctx: Ctx, sub: Subscription, reason: string) {
  await ctx.store.create("subscription_versions", { ...stamp(ctx.org.id), subscriptionId: sub.id, customerId: sub.customerId, version: sub.version, reason, snapshot: snapshot(sub), actor: ctx.actor.name }, `${sub.id}_v${sub.version}`);
}

export async function createSubscription(ctx: Ctx, input: CreateSubInput): Promise<Subscription> {
  const plan = await loadPlan(ctx, input.planId);
  if (!plan.active) throw new DomainError("This plan is not active");
  const customer = await ctx.store.get<Customer>("customers", input.customerId);
  if (!customer || customer.orgId !== ctx.org.id) throw notFound("Customer");
  const start = input.startDate ?? null;
  if (start && plan.availableFrom && compareDates(start, plan.availableFrom) < 0) throw new DomainError(`Plan is available from ${plan.availableFrom}`);
  if (plan.availableUntil && compareDates(start ?? ctx.today, plan.availableUntil) > 0) throw new DomainError(`Plan stopped being available on ${plan.availableUntil}`);
  if (!input.items.some((i) => i.productId === plan.productId)) throw new DomainError("The plan's product must be one of the lines");
  const items = await priceItems(ctx, plan, input.items);
  const discounts = await loadDiscounts(ctx, input.discountIds);
  const { subtotal, recurringAmount } = recurringAmountOf(items, discounts, ctx.today, input.discountIds);
  const id = newId("sub_");
  const sub = await ctx.store.tx(async (tx) => {
    const n = await readCounter(tx, ctx.org.id, "sub");
    const number = fmtSub(n + 1);
    const doc: Subscription = {
      id,
      ...stamp(ctx.org.id),
      number,
      customerId: customer.id,
      customerName: customer.name,
      planId: plan.id,
      planName: plan.name,
      status: input.status,
      items,
      discountIds: input.discountIds,
      redeemedDiscountIds: [],
      startDate: start,
      endDate: input.endDate ?? (start ? expiryFor(plan, start) : null),
      anchorDate: null,
      nextBillingDate: null,
      currentPeriodStart: null,
      interval: plan.interval,
      intervalCount: plan.intervalCount,
      paymentTermsDays: input.paymentTermsDays ?? ctx.org.paymentTermsDays,
      recurringAmount,
      subtotal,
      quoteValidUntil: input.quoteValidUntil ?? null,
      templateId: input.templateId ?? null,
      version: 1,
      notes: input.notes ?? "",
      autoClose: plan.autoClose,
      createdBy: ctx.actor.uid,
      _search: searchTokens(number, customer.name, customer.email, plan.name),
    };
    tx.create("subscriptions", id, doc as unknown as Record<string, unknown>);
    writeCounter(tx, ctx.org.id, "sub", n + 1);
    return doc;
  });
  await writeVersion(ctx, sub, "created");
  await audit(ctx, "subscription.created", "subscriptions", sub.id, { after: { number: sub.number, status: sub.status, recurringAmount } });
  return sub;
}

export async function createFromTemplate(ctx: Ctx, templateId: string, customerId: string) {
  const t = await ctx.store.get<QuotationTemplate>("quotation_templates", templateId);
  if (!t || t.orgId !== ctx.org.id) throw notFound("Quotation template");
  return createSubscription(ctx, {
    customerId,
    planId: t.planId,
    items: t.items,
    discountIds: [],
    status: "quotation",
    quoteValidUntil: addDays(ctx.today, t.validityDays),
    templateId,
    paymentTermsDays: t.paymentTermsDays,
    notes: t.notes,
  });
}

export async function getSub(ctx: Ctx, id: string) {
  const sub = await ctx.store.get<Subscription>("subscriptions", id);
  if (!sub || sub.orgId !== ctx.org.id) throw notFound("Subscription");
  return sub;
}

export interface TransitionOpts {
  reason?: string;
  acceptRetentionOffer?: boolean;
  startDate?: string;
}

export async function transition(ctx: Ctx, id: string, action: SubAction, opts: TransitionOpts = {}) {
  const sub = await getSub(ctx, id);
  const plan = await loadPlan(ctx, sub.planId);
  const check = canTransition(sub.status, action, plan);
  if (!check.ok) throw new DomainError(check.reason!);

  // Retention offer: shown before cancelling, never blocks the cancellation.
  if (action === "close" && opts.acceptRetentionOffer) {
    const offerId = ctx.org.retentionDiscountId;
    if (!offerId) throw new DomainError("No retention offer is configured");
    if (sub.discountIds.includes(offerId)) throw new DomainError("Retention offer already applied");
    const discountIds = [...sub.discountIds, offerId];
    const discounts = await loadDiscounts(ctx, discountIds);
    const { recurringAmount } = recurringAmountOf(sub.items, discounts, ctx.today, discountIds);
    const next = { ...sub, discountIds, recurringAmount, version: sub.version + 1, updatedAt: nowISO() };
    await ctx.store.update("subscriptions", id, { discountIds, recurringAmount, version: next.version, updatedAt: next.updatedAt });
    await writeVersion(ctx, next, "retention offer accepted");
    await audit(ctx, "subscription.retention_accepted", "subscriptions", id, { note: opts.reason });
    return next;
  }

  const patch: Partial<Subscription> = { status: check.to!, updatedAt: nowISO(), version: sub.version + 1 };
  let note = action as string;
  switch (action) {
    case "send_quotation":
      patch.quoteValidUntil = sub.quoteValidUntil ?? addDays(ctx.today, 30);
      break;
    case "confirm":
      if (sub.quoteValidUntil && compareDates(ctx.today, sub.quoteValidUntil) > 0) throw new DomainError("This quotation has expired. Revise it and resend.");
      break;
    case "activate": {
      const start = opts.startDate ?? sub.startDate ?? ctx.today;
      if (compareDates(start, ctx.today) > 0) throw new DomainError(`Start date ${start} is in the future – activate on or after that day`);
      patch.startDate = start;
      patch.anchorDate = start;
      patch.nextBillingDate = start;
      patch.currentPeriodStart = start;
      patch.activatedAt = nowISO();
      patch.endDate = sub.endDate ?? expiryFor(plan, start);
      break;
    }
    case "pause":
      note = `paused${opts.reason ? `: ${opts.reason}` : ""}`;
      break;
    case "resume": {
      // Paused time is not billed. If the next billing date passed while paused, re-anchor to today.
      if (sub.nextBillingDate && compareDates(sub.nextBillingDate, ctx.today) < 0) {
        patch.anchorDate = ctx.today;
        patch.nextBillingDate = ctx.today;
      }
      break;
    }
    case "renew": {
      const from = sub.endDate && compareDates(sub.endDate, ctx.today) >= 0 ? addDays(sub.endDate, 1) : ctx.today;
      patch.endDate = plan.termPeriods ? expiryFor(plan, from) : null;
      if (sub.status === "closed") {
        patch.anchorDate = ctx.today;
        patch.nextBillingDate = ctx.today;
        patch.closedAt = null;
        patch.closeReason = null;
      }
      note = `renewed until ${patch.endDate ?? "open-ended"}`;
      break;
    }
    case "close":
      if (!opts.reason?.trim()) throw new DomainError("Please give a reason for closing");
      patch.closeReason = opts.reason;
      patch.closedAt = nowISO();
      patch.closedOn = ctx.today;
      patch.nextBillingDate = null;
      note = `closed: ${opts.reason}`;
      break;
  }
  const next = { ...sub, ...patch } as Subscription;
  await ctx.store.update("subscriptions", id, patch as Record<string, unknown>);
  await writeVersion(ctx, next, note);
  await audit(ctx, `subscription.${action}`, "subscriptions", id, { before: { status: sub.status }, after: { status: next.status }, note });
  if (action === "activate") {
    await emit(ctx, "subscription.activated", { customerId: sub.customerId, amount: sub.recurringAmount, entity: "subscriptions", entityId: id, label: sub.number, link: `/app/subscriptions/${id}` });
    await billSubscription(ctx, next); // first invoice immediately
  }
  if (action === "close") {
    await emit(ctx, "subscription.closed", { customerId: sub.customerId, amount: sub.recurringAmount, entity: "subscriptions", entityId: id, label: sub.number, link: `/app/subscriptions/${id}` });
    await notify(ctx, { audience: "staff", title: `${sub.number} closed`, body: `${sub.customerName}: ${opts.reason}`, level: "warning", link: `/app/subscriptions/${id}` });
  }
  return ctx.store.get<Subscription>("subscriptions", id);
}

/**
 * Upgrade/downgrade mid-cycle with day-based proration.
 * Upgrade => immediate proration invoice for the net charge.
 * Downgrade => net credit added to the customer's account balance (auto-applied to the next invoice).
 */
export async function changeSubscription(ctx: Ctx, id: string, input: { planId?: string; items: LineInput[]; discountIds?: string[] }) {
  const sub = await getSub(ctx, id);
  if (!["active", "draft", "quotation", "confirmed"].includes(sub.status)) throw new DomainError(`Cannot change a ${sub.status} subscription`);
  const plan = await loadPlan(ctx, input.planId ?? sub.planId);
  if (plan.interval !== sub.interval || plan.intervalCount !== sub.intervalCount) {
    if (sub.status === "active") throw new DomainError("Switching billing frequency mid-cycle is not supported – close and start a new subscription");
  }
  const items = await priceItems(ctx, plan, input.items);
  const discountIds = input.discountIds ?? sub.discountIds;
  const discounts = await loadDiscounts(ctx, discountIds);
  const { subtotal, recurringAmount } = recurringAmountOf(items, discounts, ctx.today, [...sub.redeemedDiscountIds, ...discountIds]);
  let proration = null as null | ReturnType<typeof prorate>;
  let prorationInvoiceId: string | null = null;
  if (sub.status === "active" && sub.currentPeriodStart && sub.nextBillingDate && sub.anchorDate) {
    const period = periodAt(sub.anchorDate, sub.interval, sub.intervalCount, sub.currentPeriodStart);
    if (compareDates(ctx.today, period.start) >= 0 && compareDates(ctx.today, period.endExclusive) < 0) {
      proration = prorate({ periodStart: period.start, periodEndExclusive: period.endExclusive, changeDate: ctx.today, oldAmount: sub.recurringAmount, newAmount: recurringAmount });
    }
  }
  const next: Subscription = { ...sub, planId: plan.id, planName: plan.name, items, discountIds, subtotal, recurringAmount, version: sub.version + 1, updatedAt: nowISO() };
  const customer = await ctx.store.get<Customer>("customers", sub.customerId);
  if (!customer) throw notFound("Customer");
  if (proration && proration.net > 0) {
    const taxMap = await taxRulesFor(ctx, [plan.productId]);
    const { invoice } = await ctx.store.tx((tx) =>
      createInvoiceTx(ctx, tx, {
        sub: next, customer, items: [], kind: "proration", discounts: [], redeemedIds: [], invoiceDate: ctx.today, paymentTermsDays: sub.paymentTermsDays, confirm: true,
        extraLines: [{ productId: plan.productId, description: `Proration: ${sub.planName} → ${plan.name} (${proration!.remainingDays}/${proration!.totalDays} days)`, quantity: 1, unitPrice: proration!.net, amount: proration!.net }],
      }, taxMap),
    );
    prorationInvoiceId = invoice.id;
  } else if (proration && proration.net < 0) {
    await ctx.store.update("customers", customer.id, { creditBalance: (customer.creditBalance ?? 0) - proration.net, updatedAt: nowISO() });
  }
  await ctx.store.update("subscriptions", id, { planId: next.planId, planName: next.planName, items, discountIds, subtotal, recurringAmount, version: next.version, updatedAt: next.updatedAt });
  const rs = (p: number) => `₹${(Math.abs(p) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
  await writeVersion(ctx, next, proration ? `${proration.kind} – ${proration.net >= 0 ? `proration charge ${rs(proration.net)}` : `credit ${rs(proration.net)}`}` : `lines updated (${sub.planName} → ${plan.name})`);
  await ctx.store.create("subscription_amendments", {
    ...stamp(ctx.org.id), subscriptionId: id, customerId: sub.customerId, fromPlan: sub.planName, toPlan: plan.name,
    oldAmount: sub.recurringAmount, newAmount: recurringAmount, effectiveDate: ctx.today, proration, prorationInvoiceId, kind: proration?.kind ?? (recurringAmount >= sub.recurringAmount ? "upgrade" : "downgrade"), actor: ctx.actor.name,
  }, newId("amd_"));
  await audit(ctx, "subscription.changed", "subscriptions", id, { before: { plan: sub.planName, amount: sub.recurringAmount }, after: { plan: plan.name, amount: recurringAmount }, note: proration ? `proration net ${proration.net}` : undefined });
  return { subscription: next, proration, prorationInvoiceId };
}

/** Customer self-service subscribe from Explore Plans: creates, confirms and activates in one go. */
export async function selfSubscribe(ctx: Ctx, customerId: string, planId: string, line: LineInput, discountCode?: string) {
  let discountIds: string[] = [];
  if (discountCode) {
    const found = await ctx.store.all<{ id: string; code: string; active: boolean }>("discounts", [["orgId", "==", ctx.org.id], ["code", "==", discountCode.trim().toUpperCase()]]);
    if (!found.length || !found[0].active) throw new DomainError("That discount code is not valid");
    discountIds = [found[0].id];
  }
  const sub = await createSubscription(ctx, { customerId, planId, items: [line], discountIds, status: "draft", startDate: ctx.today });
  await transition(ctx, sub.id, "confirm");
  return transition(ctx, sub.id, "activate");
}
