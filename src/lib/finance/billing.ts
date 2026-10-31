import { compareDates, Interval, periodAt } from "./period";

export interface BillableSub {
  id: string;
  status: string;
  startDate: string;
  endDate?: string | null;
  anchorDate: string;
  interval: Interval;
  intervalCount: number;
  nextBillingDate: string | null;
  autoClose?: boolean;
}

/** Idempotency key: one invoice per subscription per period start. Used as the invoice document id. */
export function billingKey(subscriptionId: string, periodStart: string): string {
  return `${subscriptionId}__${periodStart}`;
}

export type DueDecision =
  | { action: "bill"; periods: { start: string; end: string; endExclusive: string }[]; nextBillingDate: string; closeAfter: boolean }
  | { action: "close"; reason: string }
  | { action: "skip"; reason: string };

/**
 * Decide what the billing runner should do for one subscription on `today`.
 * Catches up missed periods (max `maxPeriods` per run) so nothing is skipped,
 * and never bills a period starting on/after the expiry date.
 */
export function decideBilling(sub: BillableSub, today: string, maxPeriods = 12): DueDecision {
  if (sub.status !== "active") return { action: "skip", reason: `status ${sub.status}` };
  if (!sub.nextBillingDate) return { action: "skip", reason: "no next billing date" };
  const expired = (d: string) => !!sub.endDate && compareDates(d, sub.endDate) > 0;
  if (compareDates(sub.nextBillingDate, today) > 0) {
    if (sub.autoClose && sub.endDate && compareDates(today, sub.endDate) > 0) return { action: "close", reason: "plan ended (auto-close)" };
    return { action: "skip", reason: "not due" };
  }
  const periods: { start: string; end: string; endExclusive: string }[] = [];
  let cursor = sub.nextBillingDate;
  while (compareDates(cursor, today) <= 0 && periods.length < maxPeriods) {
    if (expired(cursor)) break;
    const p = periodAt(sub.anchorDate, sub.interval, sub.intervalCount, cursor);
    periods.push({ start: p.start, end: p.end, endExclusive: p.endExclusive });
    cursor = p.endExclusive;
  }
  if (!periods.length) {
    return sub.autoClose ? { action: "close", reason: "expired" } : { action: "skip", reason: "expired; awaiting renewal" };
  }
  const closeAfter = !!sub.autoClose && !!sub.endDate && compareDates(cursor, sub.endDate) > 0;
  return { action: "bill", periods, nextBillingDate: cursor, closeAfter };
}
