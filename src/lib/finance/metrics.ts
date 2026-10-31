import { Minor, roundHalfUp, sum } from "./money";
import type { Interval } from "./period";

/**
 * METRIC DEFINITIONS (also in docs/METRICS.md)
 *  MRR  : sum over ACTIVE subscriptions of recurring amount (pre-tax, post-discount) normalised to one month.
 *         yearly ÷ 12, weekly × 52 ÷ 12, daily × 365 ÷ 12, divided by intervalCount. Paused subs excluded.
 *  ARR  : MRR × 12.
 *  Customer churn rate : customers active at period start who are no longer active at period end ÷ customers active at start.
 *  GRR  : (start MRR − contraction − churned MRR) ÷ start MRR  (never above 100%).
 *  NRR  : (start MRR + expansion − contraction − churned MRR) ÷ start MRR.
 *  ARPC : MRR ÷ number of customers with at least one active subscription.
 *  Payment success rate : succeeded attempts ÷ (succeeded + failed) attempts.
 */
export function normalizeToMonthly(amount: Minor, interval: Interval, intervalCount = 1): Minor {
  const perInterval = amount / intervalCount;
  switch (interval) {
    case "monthly":
      return roundHalfUp(perInterval);
    case "yearly":
      return roundHalfUp(perInterval / 12);
    case "weekly":
      return roundHalfUp((perInterval * 52) / 12);
    case "daily":
      return roundHalfUp((perInterval * 365) / 12);
  }
}

export interface SubForMetrics {
  id: string;
  customerId: string;
  status: string;
  /** recurring amount per billing interval (pre-tax, post-discount) */
  recurringAmount: Minor;
  interval: Interval;
  intervalCount: number;
}

export function mrr(subs: SubForMetrics[]): Minor {
  return sum(subs.filter((s) => s.status === "active").map((s) => normalizeToMonthly(s.recurringAmount, s.interval, s.intervalCount)));
}

export function arr(mrrValue: Minor): Minor {
  return mrrValue * 12;
}

export function arpc(subs: SubForMetrics[]): Minor {
  const active = subs.filter((s) => s.status === "active");
  const customers = new Set(active.map((s) => s.customerId)).size;
  return customers ? roundHalfUp(mrr(active) / customers) : 0;
}

export interface MrrBridge {
  startMrr: Minor;
  newMrr: Minor;
  expansion: Minor;
  contraction: Minor;
  churned: Minor;
  endMrr: Minor;
  grr: number | null;
  nrr: number | null;
  customerChurnRate: number | null;
}

/**
 * Revenue bridge between two snapshots of per-subscription MRR keyed by subscription id
 * (with customer ids for customer churn).
 */
export function mrrBridge(
  start: Record<string, { mrr: Minor; customerId: string }>,
  end: Record<string, { mrr: Minor; customerId: string }>,
): MrrBridge {
  let newMrr = 0, expansion = 0, contraction = 0, churned = 0;
  for (const [id, s] of Object.entries(start)) {
    const e = end[id];
    if (!e || e.mrr === 0) churned += s.mrr;
    else if (e.mrr > s.mrr) expansion += e.mrr - s.mrr;
    else if (e.mrr < s.mrr) contraction += s.mrr - e.mrr;
  }
  for (const [id, e] of Object.entries(end)) if (!start[id] && e.mrr > 0) newMrr += e.mrr;
  const startMrr = sum(Object.values(start).map((s) => s.mrr));
  const endMrr = sum(Object.values(end).map((s) => s.mrr));
  const startCustomers = new Set(Object.values(start).filter((s) => s.mrr > 0).map((s) => s.customerId));
  const endCustomers = new Set(Object.values(end).filter((s) => s.mrr > 0).map((s) => s.customerId));
  const lost = [...startCustomers].filter((c) => !endCustomers.has(c)).length;
  return {
    startMrr,
    newMrr,
    expansion,
    contraction,
    churned,
    endMrr,
    grr: startMrr ? Math.min(1, (startMrr - contraction - churned) / startMrr) : null,
    nrr: startMrr ? (startMrr + expansion - contraction - churned) / startMrr : null,
    customerChurnRate: startCustomers.size ? lost / startCustomers.size : null,
  };
}

/**
 * Naive projection, ALWAYS labelled as a forecast in the UI:
 * next-month MRR = current MRR × (1 + average monthly net growth of the last n months).
 */
export function projectMrr(history: Minor[], months = 3): { projected: Minor[]; growthRate: number } {
  if (history.length < 2) return { projected: Array(months).fill(history[0] ?? 0), growthRate: 0 };
  const rates: number[] = [];
  for (let i = 1; i < history.length; i++) if (history[i - 1] > 0) rates.push(history[i] / history[i - 1] - 1);
  const g = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;
  const projected: Minor[] = [];
  let cur = history[history.length - 1];
  for (let i = 0; i < months; i++) {
    cur = roundHalfUp(cur * (1 + g));
    projected.push(cur);
  }
  return { projected, growthRate: g };
}
