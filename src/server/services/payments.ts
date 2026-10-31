import { deriveStatus, nextRetry, outstanding, validatePaymentAmount, validateRefund } from "@/lib/finance";
import type { Invoice, Payment } from "@/lib/types";
import { DomainError, notFound } from "../http";
import { newId } from "../store/types";
import { audit, fmtPay, notify, nowISO, readCounter, searchTokens, stamp, writeCounter, type Ctx } from "./core";
import { emit } from "./events";

export interface RecordPaymentInput {
  invoiceId: string;
  method: Payment["method"];
  amount: number;
  date: string;
  note?: string;
  reference?: string;
}

/** Record a successful payment against an invoice (transactional; validates against outstanding). */
export async function recordPayment(ctx: Ctx, input: RecordPaymentInput) {
  const res = await ctx.store.tx(async (tx) => {
    const inv = await tx.get<Invoice>("invoices", input.invoiceId);
    if (!inv || inv.orgId !== ctx.org.id) throw notFound("Invoice");
    if (ctx.actor.role === "customer" && inv.customerId !== ctx.actor.customerId) throw notFound("Invoice");
    validatePaymentAmount(input.amount, inv);
    const n = await readCounter(tx, ctx.org.id, "pay");
    const amountPaid = inv.amountPaid + input.amount;
    const next = { ...inv, amountPaid };
    const status = deriveStatus(next, ctx.today);
    const paymentId = newId("pay_");
    const reference = input.reference || fmtPay(n + 1);
    const payment: Payment = {
      id: paymentId, ...stamp(ctx.org.id), invoiceId: inv.id, invoiceNumber: inv.number, customerId: inv.customerId, customerName: inv.customer.name,
      method: input.method, amount: input.amount, date: input.date, note: input.note ?? "", reference, status: "succeeded", amountRefunded: 0, recordedBy: ctx.actor.name,
    };
    tx.create("payments", paymentId, { ...payment, _search: searchTokens(reference, inv.number, inv.customer.name) } as unknown as Record<string, unknown>);
    tx.create("payment_attempts", newId("pat_"), { ...stamp(ctx.org.id), invoiceId: inv.id, invoiceNumber: inv.number, customerId: inv.customerId, status: "succeeded", amount: input.amount, method: input.method, attempt: inv.failedAttempts + 1 });
    tx.update("invoices", inv.id, { amountPaid, status, updatedAt: nowISO(), nextRetryOn: status === "paid" ? null : inv.nextRetryOn ?? null, ...(status === "paid" ? { paidAt: nowISO() } : {}) });
    writeCounter(tx, ctx.org.id, "pay", n + 1);
    return { payment, invoice: { ...next, status } as Invoice };
  });
  await audit(ctx, "payment.recorded", "payments", res.payment.id, { note: `${res.payment.reference}: ${input.amount} on ${res.invoice.number} via ${input.method}` });
  await emit(ctx, "payment.succeeded", { customerId: res.invoice.customerId, amount: input.amount, entity: "payments", entityId: res.payment.id, label: res.invoice.number });
  await notify(ctx, { audience: "customer", customerId: res.invoice.customerId, title: `Payment received`, body: `₹${(input.amount / 100).toLocaleString("en-IN")} received for ${res.invoice.number}${res.invoice.status === "paid" ? " – fully paid. Thank you!" : `. Outstanding ₹${(outstanding(res.invoice) / 100).toLocaleString("en-IN")}.`}`, level: "success", link: `/portal/invoices/${res.invoice.id}` });
  if (res.invoice.subscriptionId && res.invoice.status === "paid") await ctx.store.update("subscriptions", res.invoice.subscriptionId, { pastDue: false });
  return res;
}

export type SimOutcome = "success" | "fail" | "partial";

/**
 * PAYMENT SIMULATOR (clearly labelled in the UI): no real money moves.
 *  success: pays the full outstanding amount
 *  partial: pays the given amount (default half)
 *  fail   : records a failed attempt with a reason, schedules a dunning retry, alerts staff. Never marks paid.
 */
export async function simulatePayment(ctx: Ctx, invoiceId: string, outcome: SimOutcome, opts: { reason?: string; amount?: number } = {}) {
  const inv = await ctx.store.get<Invoice>("invoices", invoiceId);
  if (!inv || inv.orgId !== ctx.org.id) throw notFound("Invoice");
  if (ctx.actor.role === "customer" && inv.customerId !== ctx.actor.customerId) throw notFound("Invoice");
  const owed = outstanding(inv);
  if (inv.status === "draft" || inv.status === "cancelled") throw new DomainError("This invoice cannot be paid");
  if (owed <= 0) throw new DomainError("Invoice is already fully paid");
  if (outcome === "success" || outcome === "partial") {
    const amount = outcome === "success" ? owed : opts.amount ?? Math.floor(owed / 2);
    return { outcome, ...(await recordPayment(ctx, { invoiceId, method: "simulator", amount, date: ctx.today, note: `Payment Simulator: ${outcome}`, reference: `SIM-${Date.now().toString(36).toUpperCase()}` })) };
  }
  const reason = opts.reason || "Card declined by issuer (simulated)";
  const failed = inv.failedAttempts + 1;
  const n = nextRetry(failed, ctx.today, { retryDays: ctx.org.dunningRetryDays });
  await ctx.store.tx(async (tx) => {
    const cur = await tx.get<Invoice>("invoices", invoiceId);
    tx.create("payment_attempts", newId("pat_"), { ...stamp(ctx.org.id), invoiceId, invoiceNumber: inv.number, customerId: inv.customerId, status: "failed", amount: owed, method: "simulator", reason, attempt: failed });
    tx.update("invoices", invoiceId, { failedAttempts: (cur?.failedAttempts ?? 0) + 1, nextRetryOn: n.retryOn, dunningExhausted: n.exhausted, updatedAt: nowISO() });
  });
  await audit(ctx, "payment.failed", "invoices", invoiceId, { note: `${inv.number}: ${reason} (attempt ${failed})` });
  await notify(ctx, { audience: "customer", customerId: inv.customerId, title: `Payment failed for ${inv.number}`, body: `${reason}. ${n.retryOn ? `We'll remind you again on ${n.retryOn}.` : "Please contact support."}`, level: "danger", link: `/portal/invoices/${invoiceId}` });
  await notify(ctx, { audience: "staff", title: `Payment failed: ${inv.number}`, body: `${inv.customer.name} – ${reason}. Attempt ${failed}${n.exhausted ? " (retries exhausted)" : `, next retry ${n.retryOn}`}.`, level: "warning", link: `/app/invoices/${invoiceId}` });
  await emit(ctx, "payment.failed", { customerId: inv.customerId, amount: owed, entity: "invoices", entityId: invoiceId, label: inv.number, link: `/app/invoices/${invoiceId}` });
  if (n.exhausted) await emit(ctx, "dunning.exhausted", { customerId: inv.customerId, amount: owed, entity: "invoices", entityId: invoiceId, label: inv.number });
  return { outcome, reason, attempt: failed, nextRetryOn: n.retryOn, exhausted: n.exhausted };
}

export async function refundPayment(ctx: Ctx, paymentId: string, amount: number, reason: string) {
  if (!reason?.trim()) throw new DomainError("A refund reason is required");
  const res = await ctx.store.tx(async (tx) => {
    const p = await tx.get<Payment>("payments", paymentId);
    if (!p || p.orgId !== ctx.org.id) throw notFound("Payment");
    const inv = await tx.get<Invoice>("invoices", p.invoiceId);
    if (!inv) throw notFound("Invoice");
    validateRefund(amount, { amountPaid: p.amount, amountRefunded: p.amountRefunded });
    const amountRefunded = inv.amountRefunded + amount;
    const status = deriveStatus({ ...inv, amountRefunded }, ctx.today);
    tx.update("payments", p.id, { amountRefunded: p.amountRefunded + amount, updatedAt: nowISO() });
    tx.update("invoices", inv.id, { amountRefunded, status, updatedAt: nowISO() });
    const refundId = newId("rfd_");
    tx.create("refunds", refundId, { ...stamp(ctx.org.id), paymentId: p.id, invoiceId: inv.id, invoiceNumber: inv.number, customerId: p.customerId, customerName: p.customerName, amount, reason, method: p.method });
    return { refundId, inv, p };
  });
  await audit(ctx, "payment.refunded", "payments", paymentId, { note: `Refund ${amount} on ${res.inv.number}: ${reason}` });
  await notify(ctx, { audience: "customer", customerId: res.p.customerId, title: "Refund issued", body: `₹${(amount / 100).toLocaleString("en-IN")} refunded for ${res.inv.number}.`, level: "info" });
  return res;
}
