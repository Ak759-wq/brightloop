import { describe } from "vitest";
import { area, check } from "../audit";
import {
  allocatePayment, consumeCredits, deriveStatus, mrr, mrrBridge, nextRetry, normalizeToMonthly, outstanding, paymentSuccessRate,
  receivablesAgeing, validateCreditNote, validatePaymentAmount, validateRefund, arr, arpc, projectMrr, topUp,
} from "@/lib/finance";

area("payments-metrics");
const inv = { status: "confirmed" as const, total: 1019520, dueDate: "2026-11-15", amountPaid: 0, amountRefunded: 0, creditNoted: 0 };

describe("payments & invoice status", () => {
  check("Y-01", "unpaid before due = confirmed", { ...inv, today: "2026-11-10" }, "confirmed", () => deriveStatus(inv, "2026-11-10"));
  check("Y-02", "partial payment = partially_paid, outstanding reduced", { amountPaid: 500000 }, { status: "partially_paid", outstanding: 519520 },
    () => ({ status: deriveStatus({ ...inv, amountPaid: 500000 }, "2026-11-10"), outstanding: outstanding({ ...inv, amountPaid: 500000 }) }));
  check("Y-03", "unpaid after due date = overdue", { today: "2026-11-16" }, "overdue", () => deriveStatus(inv, "2026-11-16"));
  check("Y-04", "due date itself is not overdue", { today: "2026-11-15" }, "confirmed", () => deriveStatus(inv, "2026-11-15"));
  check("Y-05", "fully paid = paid even after due", { amountPaid: 1019520 }, "paid", () => deriveStatus({ ...inv, amountPaid: 1019520 }, "2026-12-01"));
  check("Y-06", "refund re-opens outstanding", { amountPaid: 1019520, amountRefunded: 19520 }, { status: "partially_paid", outstanding: 19520 },
    () => ({ status: deriveStatus({ ...inv, amountPaid: 1019520, amountRefunded: 19520 }, "2026-11-10"), outstanding: outstanding({ ...inv, amountPaid: 1019520, amountRefunded: 19520 }) }));
  check("Y-07", "credit note reduces outstanding", { creditNoted: 19520, amountPaid: 1000000 }, "paid", () => deriveStatus({ ...inv, creditNoted: 19520, amountPaid: 1000000 }, "2026-11-10"));
  check("Y-08", "overpayment rejected", { amount: 2000000 }, { error: "Payment exceeds the outstanding amount" }, () => { validatePaymentAmount(2000000, inv); return null; });
  check("Y-09", "payment on draft rejected", { status: "draft" }, { error: "Confirm the invoice before recording payments" }, () => { validatePaymentAmount(100, { ...inv, status: "draft" }); return null; });
  check("Y-10", "zero payment rejected", { amount: 0 }, { error: "Payment amount must be greater than zero" }, () => { validatePaymentAmount(0, inv); return null; });
  check("Y-11", "cancelled stays cancelled", { status: "cancelled" }, "cancelled", () => deriveStatus({ ...inv, status: "cancelled" }, "2026-12-30"));
  check("Y-12", "allocate ₹15,000 oldest-due first, remainder unapplied", { amount: 1500000 },
    { allocations: [{ invoiceId: "a", amount: 1000000 }, { invoiceId: "b", amount: 400000 }], unapplied: 100000 },
    () => allocatePayment(1500000, [{ id: "b", dueDate: "2026-11-20", outstanding: 400000 }, { id: "a", dueDate: "2026-11-01", outstanding: 1000000 }]));
  check("Y-13", "refund above paid rejected", { amountPaid: 1000, refund: 1500 }, { error: "Refund exceeds the amount paid" }, () => { validateRefund(1500, { amountPaid: 1000, amountRefunded: 0 }); return null; });
  check("Y-14", "credit note above total rejected", { total: 1000, creditNoted: 800, note: 300 }, { error: "Credit note exceeds the invoice total" }, () => { validateCreditNote(300, { total: 1000, creditNoted: 800, status: "paid" }); return null; });
  check("Y-15", "receivables ageing buckets", { today: "2026-12-31" }, { current: 100, d1_30: 200, d31_60: 300, d61_90: 0, d90_plus: 400 },
    () => receivablesAgeing([{ dueDate: "2027-01-05", outstanding: 100 }, { dueDate: "2026-12-20", outstanding: 200 }, { dueDate: "2026-11-15", outstanding: 300 }, { dueDate: "2026-08-01", outstanding: 400 }, { dueDate: "2026-08-01", outstanding: 0 }], "2026-12-31"));
  check("Y-16", "payment success rate ignores pending", { s: 3, f: 1, p: 2 }, 0.75,
    () => paymentSuccessRate([{ status: "succeeded" }, { status: "succeeded" }, { status: "succeeded" }, { status: "failed" }, { status: "pending" }, { status: "pending" }]));
});

describe("dunning", () => {
  check("N-01", "first failure → retry +1 day", { failed: 1, date: "2026-11-15" }, { retryOn: "2026-11-16", exhausted: false }, () => nextRetry(1, "2026-11-15"));
  check("N-02", "third failure → retry +7 days", { failed: 3, date: "2026-11-15" }, { retryOn: "2026-11-22", exhausted: false }, () => nextRetry(3, "2026-11-15"));
  check("N-03", "fourth failure → exhausted", { failed: 4 }, { retryOn: null, exhausted: true }, () => nextRetry(4, "2026-11-15"));
  check("N-04", "custom sequence [2,5]", { failed: 2, policy: [2, 5] }, { retryOn: "2026-11-20", exhausted: false }, () => nextRetry(2, "2026-11-15", { retryDays: [2, 5] }));
});

describe("revenue metrics", () => {
  const subs = [
    { id: "s1", customerId: "c1", status: "active", recurringAmount: 120000, interval: "yearly" as const, intervalCount: 1 },
    { id: "s2", customerId: "c1", status: "active", recurringAmount: 186000, interval: "monthly" as const, intervalCount: 1 },
    { id: "s3", customerId: "c2", status: "active", recurringAmount: 12000, interval: "weekly" as const, intervalCount: 1 },
    { id: "s4", customerId: "c3", status: "paused", recurringAmount: 99900, interval: "monthly" as const, intervalCount: 1 },
  ];
  check("K-01", "normalise yearly ₹1,200 → ₹100/month", { amount: 120000, interval: "yearly" }, 10000, () => normalizeToMonthly(120000, "yearly"));
  check("K-02", "normalise weekly ₹120 → ₹520/month", { amount: 12000, interval: "weekly" }, 52000, () => normalizeToMonthly(12000, "weekly"));
  check("K-03", "normalise daily ₹10 → ₹304.17/month", { amount: 1000, interval: "daily" }, 30417, () => normalizeToMonthly(1000, "daily"));
  check("K-04", "normalise quarterly ₹3,000 → ₹1,000/month", { amount: 300000, interval: "monthly", count: 3 }, 100000, () => normalizeToMonthly(300000, "monthly", 3));
  check("K-05", "MRR excludes paused", { subs }, 248000, () => mrr(subs));
  check("K-06", "ARR = MRR × 12", { mrr: 248000 }, 2976000, () => arr(248000));
  check("K-07", "ARPC = MRR / active customers", { subs }, 124000, () => arpc(subs));
  check("K-08", "MRR bridge, NRR and GRR", { start: "3 subs", end: "1 expanded, 1 churned, 1 new" },
    { startMrr: 30000, newMrr: 5000, expansion: 5000, contraction: 2000, churned: 10000, endMrr: 28000, grr: 0.6, nrr: 0.7666666666666667, customerChurnRate: 1 / 3 },
    () => mrrBridge(
      { a: { mrr: 10000, customerId: "x" }, b: { mrr: 10000, customerId: "y" }, c: { mrr: 10000, customerId: "z" } },
      { a: { mrr: 15000, customerId: "x" }, b: { mrr: 8000, customerId: "y" }, d: { mrr: 5000, customerId: "w" }, c: { mrr: 0, customerId: "z" } },
    ));
  check("K-09", "forecast projection labelled growth", { history: [100000, 110000, 121000] }, { projected: [133100, 146410], growthRate: 0.1 },
    () => { const r = projectMrr([100000, 110000, 121000], 2); return { projected: r.projected, growthRate: Math.round(r.growthRate * 1000) / 1000 }; });
});

describe("credits", () => {
  const w = { balance: 1000, lastTopUp: 1000, lowBalancePct: 20, policy: "block" as const };
  check("W-01", "consume within balance", { balance: 1000, use: 300 }, { allowed: true, balanceAfter: 700, consumed: 300, overageUnits: 0, lowBalance: false, crossedLowBalance: false }, () => consumeCredits(w, 300));
  check("W-02", "crossing 20% triggers low-balance alert once", { balance: 300, use: 150 }, { allowed: true, balanceAfter: 150, consumed: 150, overageUnits: 0, lowBalance: true, crossedLowBalance: true }, () => consumeCredits({ ...w, balance: 300 }, 150));
  check("W-03", "block policy rejects insufficient", { balance: 100, use: 150 }, { allowed: false, balanceAfter: 100, consumed: 0, overageUnits: 0, lowBalance: true, crossedLowBalance: false, reason: "Insufficient credits (policy: block)" }, () => consumeCredits({ ...w, balance: 100 }, 150));
  check("W-04", "overage policy allows and records overage", { balance: 100, use: 150, policy: "overage" }, { allowed: true, balanceAfter: -50, consumed: 100, overageUnits: 50, lowBalance: true, crossedLowBalance: false }, () => consumeCredits({ ...w, balance: 100, policy: "overage" }, 150));
  check("W-05", "top-up resets threshold base", { balance: 50, topUp: 500 }, { balance: 550, lastTopUp: 500, lowBalancePct: 20, policy: "block" }, () => topUp({ ...w, balance: 50 }, 500));
});
