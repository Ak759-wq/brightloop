import { assertMinor, Minor, sum } from "./money";
import { compareDates, daysBetween } from "./period";

export type InvoiceStatus = "draft" | "confirmed" | "partially_paid" | "paid" | "overdue" | "cancelled";

export interface InvoiceMoneyState {
  status: InvoiceStatus;
  total: Minor;
  dueDate: string;
  amountPaid: Minor;
  amountRefunded: Minor;
  creditNoted: Minor;
}

/** Amount still owed. Refunds re-open nothing: a refund returns money AND reduces "paid". Credit notes reduce what is owed. */
export function outstanding(inv: Pick<InvoiceMoneyState, "total" | "amountPaid" | "amountRefunded" | "creditNoted">): Minor {
  return Math.max(0, inv.total - inv.creditNoted - (inv.amountPaid - inv.amountRefunded));
}

/**
 * Derive the payable status. Draft and cancelled are sticky (set by explicit actions).
 * Precedence: paid > overdue > partially_paid > confirmed.
 */
export function deriveStatus(inv: InvoiceMoneyState, today: string): InvoiceStatus {
  if (inv.status === "draft" || inv.status === "cancelled") return inv.status;
  const owed = outstanding(inv);
  if (owed <= 0) return "paid";
  if (compareDates(today, inv.dueDate) > 0) return "overdue";
  if (inv.amountPaid - inv.amountRefunded > 0) return "partially_paid";
  return "confirmed";
}

export function daysOverdue(dueDate: string, today: string): number {
  return Math.max(0, daysBetween(dueDate, today));
}

export class PaymentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentError";
  }
}

export function validatePaymentAmount(amount: Minor, inv: InvoiceMoneyState): void {
  assertMinor(amount, "amount");
  if (amount <= 0) throw new PaymentError("Payment amount must be greater than zero");
  if (inv.status === "draft") throw new PaymentError("Confirm the invoice before recording payments");
  if (inv.status === "cancelled") throw new PaymentError("Cannot pay a cancelled invoice");
  const owed = outstanding(inv);
  if (owed <= 0) throw new PaymentError("Invoice is already fully paid");
  if (amount > owed) throw new PaymentError(`Payment exceeds the outstanding amount`);
}

export interface OpenInvoice {
  id: string;
  dueDate: string;
  outstanding: Minor;
}

/** Allocate a lump-sum payment oldest-due-first. Leftover is returned as unapplied (credit). */
export function allocatePayment(amount: Minor, invoices: OpenInvoice[]) {
  assertMinor(amount, "amount");
  let left = amount;
  const allocations: { invoiceId: string; amount: Minor }[] = [];
  const sorted = [...invoices].sort((a, b) => compareDates(a.dueDate, b.dueDate) || a.id.localeCompare(b.id));
  for (const inv of sorted) {
    if (left <= 0) break;
    const take = Math.min(left, inv.outstanding);
    if (take > 0) {
      allocations.push({ invoiceId: inv.id, amount: take });
      left -= take;
    }
  }
  return { allocations, unapplied: left };
}

export function validateRefund(amount: Minor, inv: Pick<InvoiceMoneyState, "amountPaid" | "amountRefunded">): void {
  assertMinor(amount, "amount");
  if (amount <= 0) throw new PaymentError("Refund must be greater than zero");
  if (amount > inv.amountPaid - inv.amountRefunded) throw new PaymentError("Refund exceeds the amount paid");
}

export function validateCreditNote(amount: Minor, inv: Pick<InvoiceMoneyState, "total" | "creditNoted" | "status">): void {
  assertMinor(amount, "amount");
  if (inv.status === "draft") throw new PaymentError("Credit notes apply to confirmed invoices only; edit the draft instead");
  if (amount <= 0) throw new PaymentError("Credit note must be greater than zero");
  if (amount > inv.total - inv.creditNoted) throw new PaymentError("Credit note exceeds the invoice total");
}

export interface AgeingBuckets {
  current: Minor;
  d1_30: Minor;
  d31_60: Minor;
  d61_90: Minor;
  d90_plus: Minor;
}

export function receivablesAgeing(invoices: { dueDate: string; outstanding: Minor }[], today: string): AgeingBuckets {
  const b: AgeingBuckets = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0 };
  for (const inv of invoices) {
    if (inv.outstanding <= 0) continue;
    const d = daysOverdue(inv.dueDate, today);
    if (d === 0) b.current += inv.outstanding;
    else if (d <= 30) b.d1_30 += inv.outstanding;
    else if (d <= 60) b.d31_60 += inv.outstanding;
    else if (d <= 90) b.d61_90 += inv.outstanding;
    else b.d90_plus += inv.outstanding;
  }
  return b;
}

export function paymentSuccessRate(attempts: { status: "succeeded" | "failed" | "pending" }[]): number | null {
  const done = attempts.filter((a) => a.status !== "pending");
  if (!done.length) return null;
  return done.filter((a) => a.status === "succeeded").length / done.length;
}

export const totalOf = (xs: { amount: Minor }[]) => sum(xs.map((x) => x.amount));
