import {
  addDays, buildInvoiceItems, deriveStatus, evaluateDiscounts, outstanding, validateCreditNote, type DiscountRule, type InvoiceLineInput, type TaxRule,
} from "@/lib/finance";
import type { Customer, Invoice, LineItem, Subscription } from "@/lib/types";
import { DomainError, notFound } from "../http";
import { newId, type Tx } from "../store/types";
import { audit, fmtCn, fmtInv, notify, nowISO, readCounter, searchTokens, stamp, writeCounter, type Ctx } from "./core";
import { emit } from "./events";
import { loadDiscounts, taxRuleFor } from "./catalog";

export interface BuildArgs {
  sub: Subscription | null;
  customer: Customer;
  items: LineItem[];
  extraLines?: { productId: string; description: string; quantity: number; unitPrice: number; amount: number }[];
  periodStart?: string | null;
  periodEnd?: string | null;
  kind: Invoice["kind"];
  discounts: DiscountRule[];
  redeemedIds: string[];
  invoiceDate: string;
  paymentTermsDays: number;
}

/** Pre-compute tax rules outside a transaction (catalog reads). */
export async function taxRulesFor(ctx: Ctx, productIds: string[]) {
  const map: Record<string, TaxRule | null> = {};
  for (const id of Array.from(new Set(productIds))) map[id] = await taxRuleFor(ctx, id);
  return map;
}

export function composeInvoice(ctx: Ctx, a: BuildArgs, taxMap: Record<string, TaxRule | null>) {
  const lines = a.items.map((i) => ({ productId: i.productId, quantity: i.quantity, amount: i.amount }));
  const disc = evaluateDiscounts(a.discounts, { date: a.invoiceDate, lines, redeemedIds: a.redeemedIds });
  const inputs: InvoiceLineInput[] = a.items.map((i, idx) => ({
    productId: i.productId,
    description: `${i.productName}${i.variantLabel ? ` (${i.variantLabel})` : ""}`,
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    amount: i.amount,
    discount: disc.perLine[idx],
    taxRule: taxMap[i.productId] ?? null,
    periodStart: a.periodStart ?? undefined,
    periodEnd: a.periodEnd ?? undefined,
  }));
  for (const x of a.extraLines ?? []) inputs.push({ ...x, discount: 0, taxRule: taxMap[x.productId] ?? null });
  const { items, totals } = buildInvoiceItems(inputs, ctx.org.sellerState, a.customer.placeOfSupply);
  return { items, totals, applied: disc.applied.map((d) => ({ id: d.rule.id, name: d.rule.name, amount: d.amount })) };
}

/**
 * Create an invoice inside a transaction. Caller must have done all reads it needs;
 * this function performs its own reads FIRST (counter, discounts, customer) then writes.
 */
export async function createInvoiceTx(
  ctx: Ctx,
  tx: Tx,
  a: BuildArgs & { id?: string; idempotencyKey?: string | null; confirm: boolean },
  taxMap: Record<string, TaxRule | null>,
): Promise<{ invoice: Invoice; duplicate: boolean; newlyRedeemed: string[] }> {
  const id = a.id ?? newId("inv_");
  // ---- reads ----
  if (a.id) {
    const existing = await tx.get<Invoice>("invoices", a.id);
    if (existing) return { invoice: existing, duplicate: true, newlyRedeemed: [] };
  }
  const year = a.invoiceDate.slice(0, 4);
  const counter = await readCounter(tx, ctx.org.id, `inv-${year}`);
  const freshDiscounts: DiscountRule[] = [];
  for (const d of a.discounts) {
    const live = await tx.get<DiscountRule>("discounts", d.id);
    if (live) freshDiscounts.push(live);
  }
  const customer = (await tx.get<Customer>("customers", a.customer.id)) ?? a.customer;
  const cnCounter = a.confirm && customer.creditBalance > 0 ? await readCounter(tx, ctx.org.id, `cn-${year}`) : 0;

  // ---- compute ----
  const { items, totals, applied } = composeInvoice(ctx, { ...a, discounts: freshDiscounts, customer }, taxMap);
  const number = fmtInv(year, counter + 1);
  const status: Invoice["status"] = a.confirm ? (totals.total === 0 ? "paid" : "confirmed") : "draft";
  const creditApplied = a.confirm ? Math.min(customer.creditBalance ?? 0, totals.total) : 0;
  const invoice: Invoice = {
    id,
    ...stamp(ctx.org.id),
    number,
    subscriptionId: a.sub?.id ?? null,
    subscriptionNumber: a.sub?.number ?? null,
    customerId: customer.id,
    customer: { name: customer.name, email: customer.email, gstin: customer.gstin, address: [customer.billingAddress, customer.city].filter(Boolean).join(", "), placeOfSupply: customer.placeOfSupply ?? null },
    seller: { name: ctx.org.legalName || ctx.org.name, gstin: ctx.org.sellerGstin, state: ctx.org.sellerState, address: ctx.org.address },
    status,
    kind: a.kind,
    invoiceDate: a.invoiceDate,
    dueDate: addDays(a.invoiceDate, a.paymentTermsDays),
    periodStart: a.periodStart ?? null,
    periodEnd: a.periodEnd ?? null,
    currency: ctx.org.currency,
    items,
    totals,
    total: totals.total,
    discountsApplied: applied,
    amountPaid: 0,
    amountRefunded: 0,
    creditNoted: creditApplied,
    failedAttempts: 0,
    nextRetryOn: null,
    idempotencyKey: a.idempotencyKey ?? null,
    confirmedAt: a.confirm ? nowISO() : null,
    paidAt: null,
    demoClock: !!(ctx.org.demo && ctx.org.demoDate),
    _search: searchTokens(number, customer.name, customer.email, a.sub?.number),
  };
  if (creditApplied > 0 && outstanding(invoice) === 0) {
    invoice.status = "paid";
    invoice.paidAt = nowISO();
  }

  // ---- writes ----
  tx.create("invoices", id, invoice as unknown as Record<string, unknown>);
  writeCounter(tx, ctx.org.id, `inv-${year}`, counter + 1);
  const newlyRedeemed: string[] = [];
  for (const ap of applied) {
    if (a.redeemedIds.includes(ap.id)) continue;
    const live = freshDiscounts.find((d) => d.id === ap.id)!;
    tx.update("discounts", ap.id, { usedCount: (live.usedCount ?? 0) + 1, updatedAt: nowISO() });
    tx.create("discount_usages", newId("du_"), { ...stamp(ctx.org.id), discountId: ap.id, invoiceId: id, subscriptionId: a.sub?.id ?? null, customerId: customer.id, amount: ap.amount });
    newlyRedeemed.push(ap.id);
  }
  if (creditApplied > 0) {
    tx.update("customers", customer.id, { creditBalance: customer.creditBalance - creditApplied, updatedAt: nowISO() });
    tx.create("credit_notes", newId("cn_"), { ...stamp(ctx.org.id), number: fmtCn(year, cnCounter + 1), invoiceId: id, invoiceNumber: number, customerId: customer.id, amount: creditApplied, reason: "Account credit applied (e.g. downgrade proration)", kind: "credit_applied" });
    writeCounter(tx, ctx.org.id, `cn-${year}`, cnCounter + 1);
  }
  return { invoice, duplicate: false, newlyRedeemed };
}

export function liveStatus(inv: Invoice, today: string): Invoice["status"] {
  return deriveStatus(inv, today);
}

export async function getInvoice(ctx: Ctx, id: string) {
  const inv = await ctx.store.get<Invoice>("invoices", id);
  if (!inv || inv.orgId !== ctx.org.id) throw notFound("Invoice");
  return inv;
}

/** Manual draft invoice for the current subscription configuration (staff "Create invoice"). */
export async function createManualInvoice(ctx: Ctx, subscriptionId: string) {
  const sub = await ctx.store.get<Subscription>("subscriptions", subscriptionId);
  if (!sub || sub.orgId !== ctx.org.id) throw notFound("Subscription");
  if (!["confirmed", "active"].includes(sub.status)) throw new DomainError("Only confirmed or active subscriptions can be invoiced");
  const customer = await ctx.store.get<Customer>("customers", sub.customerId);
  if (!customer) throw notFound("Customer");
  const discounts = await loadDiscounts(ctx, sub.discountIds);
  const taxMap = await taxRulesFor(ctx, sub.items.map((i) => i.productId));
  const { invoice } = await ctx.store.tx((tx) =>
    createInvoiceTx(ctx, tx, { sub, customer, items: sub.items, kind: "manual", discounts, redeemedIds: sub.redeemedDiscountIds, invoiceDate: ctx.today, paymentTermsDays: sub.paymentTermsDays, confirm: false }, taxMap),
  );
  await audit(ctx, "invoice.created", "invoices", invoice.id, { note: `Draft ${invoice.number} from ${sub.number}` });
  return invoice;
}

export async function confirmInvoice(ctx: Ctx, id: string) {
  const inv = await ctx.store.tx(async (tx) => {
    const inv = await tx.get<Invoice>("invoices", id);
    if (!inv || inv.orgId !== ctx.org.id) throw notFound("Invoice");
    if (inv.status !== "draft") throw new DomainError("Only draft invoices can be confirmed");
    const status = inv.totals.total === 0 ? "paid" : "confirmed";
    tx.update("invoices", id, { status, confirmedAt: nowISO(), updatedAt: nowISO() });
    return { ...inv, status } as Invoice;
  });
  await audit(ctx, "invoice.confirmed", "invoices", id, { note: inv.number });
  await emit(ctx, "invoice.created", { customerId: inv.customerId, amount: inv.totals.total, entity: "invoices", entityId: id, label: inv.number, link: `/portal/invoices/${id}` });
  await notify(ctx, { audience: "customer", customerId: inv.customerId, title: `New invoice ${inv.number}`, body: `Amount due ₹${(inv.totals.total / 100).toLocaleString("en-IN")} by ${inv.dueDate}.`, level: "info", link: `/portal/invoices/${id}` });
  return inv;
}

export async function cancelInvoice(ctx: Ctx, id: string, reason: string) {
  if (!reason?.trim()) throw new DomainError("A cancellation reason is required");
  const inv = await ctx.store.tx(async (tx) => {
    const inv = await tx.get<Invoice>("invoices", id);
    if (!inv || inv.orgId !== ctx.org.id) throw notFound("Invoice");
    if (inv.status === "cancelled") throw new DomainError("Invoice is already cancelled");
    if (inv.amountPaid - inv.amountRefunded > 0) throw new DomainError("Invoice has payments. Refund them or issue a credit note instead of cancelling.");
    tx.update("invoices", id, { status: "cancelled", cancelledAt: nowISO(), cancelReason: reason, updatedAt: nowISO() });
    return inv;
  });
  await audit(ctx, "invoice.cancelled", "invoices", id, { note: `${inv.number}: ${reason}` });
  return { ...inv, status: "cancelled" };
}

export async function sendInvoice(ctx: Ctx, id: string) {
  const inv = await getInvoice(ctx, id);
  if (inv.status === "draft" || inv.status === "cancelled") throw new DomainError("Confirm the invoice before sending it");
  let channel: "email_sent" | "email_logged" = "email_logged";
  let detail = "Email delivery is unavailable because RESEND_API_KEY is not configured. An in-app notification was recorded instead.";
  if (process.env.RESEND_API_KEY) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "billing@example.com",
        to: inv.customer.email,
        subject: `Invoice ${inv.number} from ${inv.seller.name}`,
        html: `<p>Hello ${inv.customer.name},</p><p>Your invoice <b>${inv.number}</b> for <b>₹${(inv.totals.total / 100).toLocaleString("en-IN")}</b> is due on ${inv.dueDate}.</p>`,
      }),
    });
    if (res.ok) { channel = "email_sent"; detail = `Emailed to ${inv.customer.email}`; }
    else detail = `Email provider error (${res.status}); email was not sent. An in-app notification was recorded instead.`;
  }
  await ctx.store.update("invoices", id, { ...(channel === "email_sent" ? { sentAt: nowISO() } : {}), updatedAt: nowISO() });
  await notify(ctx, {
    audience: "customer",
    customerId: inv.customerId,
    title: `Invoice ${inv.number}`,
    body: channel === "email_sent"
      ? `Your invoice for ₹${(inv.totals.total / 100).toLocaleString("en-IN")} is due ${inv.dueDate}.`
      : `${detail}`,
    level: channel === "email_sent" ? "info" : "warning",
    link: `/portal/invoices/${id}`,
    channel,
  });
  await audit(ctx, "invoice.sent", "invoices", id, { note: detail });
  return { channel, detail };
}

export async function issueCreditNote(ctx: Ctx, id: string, amount: number, reason: string) {
  if (!reason?.trim()) throw new DomainError("A reason is required");
  const result = await ctx.store.tx(async (tx) => {
    const inv = await tx.get<Invoice>("invoices", id);
    if (!inv || inv.orgId !== ctx.org.id) throw notFound("Invoice");
    if (inv.status === "cancelled") throw new DomainError("Invoice is cancelled");
    validateCreditNote(amount, inv);
    const year = ctx.today.slice(0, 4);
    const c = await readCounter(tx, ctx.org.id, `cn-${year}`);
    const creditNoted = inv.creditNoted + amount;
    const next = { ...inv, creditNoted };
    const status = deriveStatus(next, ctx.today);
    tx.update("invoices", id, { creditNoted, status, updatedAt: nowISO(), ...(status === "paid" && !inv.paidAt ? { paidAt: nowISO() } : {}) });
    const number = fmtCn(year, c + 1);
    tx.create("credit_notes", newId("cn_"), { ...stamp(ctx.org.id), number, invoiceId: id, invoiceNumber: inv.number, customerId: inv.customerId, amount, reason, kind: "credit_note" });
    writeCounter(tx, ctx.org.id, `cn-${year}`, c + 1);
    return { number, inv };
  });
  await audit(ctx, "credit_note.issued", "invoices", id, { note: `${result.number} for ${amount} on ${result.inv.number}: ${reason}` });
  return result;
}
