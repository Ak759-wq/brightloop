import { addDays, billingKey, compareDates, decideBilling, deriveStatus, nextRetry } from "@/lib/finance";
import type { Customer, Invoice, Subscription } from "@/lib/types";
import { newId } from "../store/types";
import { audit, notify, nowISO, stamp, type Ctx } from "./core";
import { emit } from "./events";
import { loadDiscounts, taxRuleFor } from "./catalog";
import { createInvoiceTx, taxRulesFor } from "./invoices";

export interface BillOutcome {
  subscriptionId: string;
  number: string;
  action: "billed" | "duplicate" | "closed" | "skipped" | "failed";
  invoices: string[];
  error?: string;
}

/**
 * Bill one subscription for every due period (idempotent per period).
 * The invoice document id IS the idempotency key (subscriptionId + periodStart), and the
 * subscription's nextBillingDate advances in the SAME transaction as invoice creation,
 * so a retried or concurrent request can never create a second invoice for a period.
 */
export async function billSubscription(ctx: Ctx, subIn: Subscription): Promise<BillOutcome> {
  const out: BillOutcome = { subscriptionId: subIn.id, number: subIn.number, action: "skipped", invoices: [] };
  const decision = decideBilling(
    { id: subIn.id, status: subIn.status, startDate: subIn.startDate ?? ctx.today, endDate: subIn.endDate, anchorDate: subIn.anchorDate ?? subIn.startDate ?? ctx.today, interval: subIn.interval, intervalCount: subIn.intervalCount, nextBillingDate: subIn.nextBillingDate ?? null, autoClose: subIn.autoClose },
    ctx.today,
  );
  if (decision.action === "skip") return out;
  if (decision.action === "close") {
    await ctx.store.update("subscriptions", subIn.id, { status: "closed", closedAt: nowISO(), closeReason: `Auto-closed: ${decision.reason}`, nextBillingDate: null, updatedAt: nowISO() });
    await audit(ctx, "subscription.auto_closed", "subscriptions", subIn.id, { note: decision.reason });
    await emit(ctx, "subscription.closed", { customerId: subIn.customerId, entity: "subscriptions", entityId: subIn.id, label: subIn.number });
    out.action = "closed";
    return out;
  }
  const customer = await ctx.store.get<Customer>("customers", subIn.customerId);
  if (!customer) return { ...out, action: "failed", error: "Customer missing" };
  const discounts = await loadDiscounts(ctx, subIn.discountIds);
  const taxMap = await taxRulesFor(ctx, subIn.items.map((i) => i.productId));
  const overageProduct = subIn.items[0]?.productId;
  if (overageProduct && !(overageProduct in taxMap)) taxMap[overageProduct] = await taxRuleFor(ctx, overageProduct);

  for (const p of decision.periods) {
    const key = billingKey(subIn.id, p.start);
    const res = await ctx.store.tx(async (tx) => {
      const sub = await tx.get<Subscription>("subscriptions", subIn.id);
      if (!sub || sub.status !== "active") return null;
      // Another runner already advanced past this period => nothing to do
      if (!sub.nextBillingDate || compareDates(sub.nextBillingDate, p.start) > 0) {
        return { duplicate: true, invoice: null as Invoice | null };
      }
      const agg = await tx.get<{ overageUnits: number }>("usage_aggregations", `${sub.id}_open`);
      const extraLines = agg && agg.overageUnits > 0 && ctx.org.overageUnitPrice > 0
        ? [{ productId: overageProduct!, description: `Usage overage: ${agg.overageUnits} credits`, quantity: agg.overageUnits, unitPrice: ctx.org.overageUnitPrice, amount: agg.overageUnits * ctx.org.overageUnitPrice }]
        : [];
      const r = await createInvoiceTx(ctx, tx, {
        id: key, idempotencyKey: key, sub, customer, items: sub.items, extraLines, periodStart: p.start, periodEnd: p.end, kind: "recurring",
        discounts, redeemedIds: sub.redeemedDiscountIds, invoiceDate: p.start < ctx.today ? ctx.today : p.start, paymentTermsDays: sub.paymentTermsDays, confirm: ctx.org.autoConfirmInvoices,
      }, taxMap);
      const last = p === decision.periods[decision.periods.length - 1];
      tx.update("subscriptions", sub.id, {
        nextBillingDate: p.endExclusive,
        currentPeriodStart: p.start,
        redeemedDiscountIds: Array.from(new Set([...sub.redeemedDiscountIds, ...r.newlyRedeemed])),
        updatedAt: nowISO(),
        ...(last && decision.closeAfter ? {} : {}),
      });
      if (extraLines.length && !r.duplicate) tx.set("usage_aggregations", `${sub.id}_open`, { orgId: ctx.org.id, subscriptionId: sub.id, customerId: sub.customerId, overageUnits: 0, updatedAt: nowISO() });
      return r;
    });
    if (!res) break;
    if (res.duplicate || !res.invoice) {
      out.action = out.invoices.length ? "billed" : "duplicate";
      continue;
    }
    out.action = "billed";
    out.invoices.push(res.invoice.number);
    await audit(ctx, "invoice.generated", "invoices", res.invoice.id, { note: `${res.invoice.number} for ${subIn.number} period ${p.start}–${p.end}` });
    if (res.invoice.status !== "draft") {
      await emit(ctx, "invoice.created", { customerId: subIn.customerId, amount: res.invoice.totals.total, entity: "invoices", entityId: res.invoice.id, label: res.invoice.number, link: `/portal/invoices/${res.invoice.id}` });
      await notify(ctx, { audience: "customer", customerId: subIn.customerId, title: `New invoice ${res.invoice.number}`, body: `₹${(res.invoice.totals.total / 100).toLocaleString("en-IN")} due ${res.invoice.dueDate} for ${subIn.planName}.`, level: "info", link: `/portal/invoices/${res.invoice.id}` });
    }
  }
  if (decision.closeAfter) {
    await ctx.store.update("subscriptions", subIn.id, { status: "closed", closedAt: nowISO(), closeReason: "Auto-closed at end of term", nextBillingDate: null, updatedAt: nowISO() });
    await audit(ctx, "subscription.auto_closed", "subscriptions", subIn.id, { note: "end of term" });
  }
  return out;
}

export interface RunResult {
  runId: string;
  status: "completed" | "locked" | "failed";
  today: string;
  processed: number;
  billed: number;
  invoicesCreated: number;
  duplicates: number;
  closed: number;
  failed: number;
  overdueMarked: number;
  dunningReminders: number;
  renewalReminders: number;
  durationMs: number;
  errors: { subscription: string; error: string }[];
}

const LOCK_MS = 5 * 60 * 1000;

/** The recurring billing runner. Triggered by the scheduler (cron), or by an admin – never by customer visits. */
export async function runBilling(ctx: Ctx, trigger: "cron" | "manual" | "demo"): Promise<RunResult> {
  const started = Date.now();
  const runId = newId("job_");
  const lockId = `billing_${ctx.org.id}`;
  const acquired = await ctx.store.tx(async (tx) => {
    const lock = await tx.get<{ expiresAt: number; runId: string }>("billing_jobs_locks", lockId);
    if (lock && lock.expiresAt > Date.now()) return false;
    tx.set("billing_jobs_locks", lockId, { orgId: ctx.org.id, runId, expiresAt: Date.now() + LOCK_MS, at: nowISO() });
    return true;
  });
  const result: RunResult = { runId, status: "completed", today: ctx.today, processed: 0, billed: 0, invoicesCreated: 0, duplicates: 0, closed: 0, failed: 0, overdueMarked: 0, dunningReminders: 0, renewalReminders: 0, durationMs: 0, errors: [] };
  if (!acquired) {
    result.status = "locked";
    await ctx.store.create("billing_jobs", { ...stamp(ctx.org.id), trigger, ...result, note: "Another billing run is in progress – skipped" }, runId);
    return result;
  }
  await ctx.store.create("billing_jobs", { ...stamp(ctx.org.id), trigger, ...result, status: "running" }, runId);
  try {
    // 1. Due subscriptions
    const due = await ctx.store.all<Subscription>("subscriptions", [["orgId", "==", ctx.org.id], ["status", "==", "active"], ["nextBillingDate", "<=", ctx.today]]);
    const active = await ctx.store.all<Subscription>("subscriptions", [["orgId", "==", ctx.org.id], ["status", "==", "active"]]);
    const autoCloseCandidates = active.filter((s) => s.autoClose && s.endDate && compareDates(ctx.today, s.endDate) > 0 && !due.find((d) => d.id === s.id));
    for (const sub of [...due, ...autoCloseCandidates]) {
      result.processed++;
      try {
        const o = await billSubscription(ctx, sub);
        if (o.action === "billed") { result.billed++; result.invoicesCreated += o.invoices.length; }
        if (o.action === "duplicate") result.duplicates++;
        if (o.action === "closed") result.closed++;
      } catch (e) {
        result.failed++;
        result.errors.push({ subscription: sub.number, error: (e as Error).message });
        await ctx.store.create("billing_events", { ...stamp(ctx.org.id), type: "billing.failed", entity: "subscriptions", entityId: sub.id, label: sub.number, error: (e as Error).message, runId }, newId("evt_"));
      }
    }
    // 2. Overdue marking (once per invoice) + dunning schedule
    const open = await ctx.store.all<Invoice>("invoices", [["orgId", "==", ctx.org.id], ["status", "in", ["confirmed", "partially_paid", "overdue"]]]);
    for (const inv of open) {
      const status = deriveStatus(inv, ctx.today);
      if (status === "overdue" && inv.status !== "overdue") {
        await ctx.store.update("invoices", inv.id, { status: "overdue", overdueNotified: true, updatedAt: nowISO() });
        result.overdueMarked++;
        await emit(ctx, "invoice.overdue", { customerId: inv.customerId, amount: inv.totals.total - inv.amountPaid, entity: "invoices", entityId: inv.id, label: inv.number, link: `/portal/invoices/${inv.id}` });
        await notify(ctx, { audience: "customer", customerId: inv.customerId, title: `Invoice ${inv.number} is overdue`, body: `Please pay the outstanding balance to avoid service interruption.`, level: "danger", link: `/portal/invoices/${inv.id}` });
      }
      if (inv.nextRetryOn && compareDates(inv.nextRetryOn, ctx.today) <= 0 && !inv.dunningExhausted) {
        // Simulator has no stored payment method: a retry = a reminder to pay + next step scheduled.
        const n = nextRetry(inv.failedAttempts + 1, ctx.today, { retryDays: ctx.org.dunningRetryDays });
        await ctx.store.create("payment_attempts", { ...stamp(ctx.org.id), invoiceId: inv.id, invoiceNumber: inv.number, customerId: inv.customerId, status: "pending", amount: inv.totals.total - inv.amountPaid, reason: "Scheduled dunning retry – reminder sent, awaiting customer payment", attempt: inv.failedAttempts + 1 }, newId("pat_"));
        await ctx.store.update("invoices", inv.id, { nextRetryOn: n.retryOn, dunningExhausted: n.exhausted, updatedAt: nowISO() });
        await notify(ctx, { audience: "customer", customerId: inv.customerId, title: `Payment reminder: ${inv.number}`, body: `Your last payment attempt failed. Please retry payment from the portal.`, level: "warning", link: `/portal/invoices/${inv.id}` });
        result.dunningReminders++;
        if (n.exhausted) {
          if (inv.subscriptionId) await ctx.store.update("subscriptions", inv.subscriptionId, { pastDue: true, updatedAt: nowISO() });
          await notify(ctx, { audience: "staff", title: `Dunning exhausted: ${inv.number}`, body: `${inv.customer.name} – all retries used. Follow up manually.`, level: "danger", link: `/app/invoices/${inv.id}` });
          await emit(ctx, "dunning.exhausted", { customerId: inv.customerId, amount: inv.totals.total, entity: "invoices", entityId: inv.id, label: inv.number });
        }
      }
    }
    // 3. Renewal reminders: subscriptions expiring within 7 days (once)
    for (const s of active) {
      if (s.endDate && compareDates(s.endDate, ctx.today) >= 0 && compareDates(s.endDate, addDays(ctx.today, 7)) <= 0) {
        const markerId = `renewal_${s.id}_${s.endDate}`;
        const exists = await ctx.store.get("billing_events", markerId);
        if (!exists) {
          await ctx.store.create("billing_events", { ...stamp(ctx.org.id), type: "renewal.upcoming", entity: "subscriptions", entityId: s.id, label: s.number }, markerId);
          await notify(ctx, { audience: "customer", customerId: s.customerId, title: `${s.planName} renews soon`, body: `Your subscription ${s.number} ends on ${s.endDate}.`, level: "info", link: `/portal/subscriptions/${s.id}` });
          await emit(ctx, "renewal.upcoming", { customerId: s.customerId, entity: "subscriptions", entityId: s.id, label: s.number });
          result.renewalReminders++;
        }
      }
    }
  } catch (e) {
    result.status = "failed";
    result.errors.push({ subscription: "-", error: (e as Error).message });
  } finally {
    result.durationMs = Date.now() - started;
    await ctx.store.update("billing_jobs", runId, { ...result, updatedAt: nowISO(), finishedAt: nowISO() });
    await ctx.store.delete("billing_jobs_locks", lockId);
  }
  if (result.failed) await notify(ctx, { audience: "staff", title: "Billing run had failures", body: `${result.failed} subscription(s) failed. See Automations → Billing jobs.`, level: "danger", link: "/app/automations" });
  return result;
}
