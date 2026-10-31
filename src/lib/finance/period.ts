/**
 * Billing period math on calendar dates (ISO "YYYY-MM-DD", timezone-free).
 * Periods are half-open: [start, nextStart). The displayed "end" date is nextStart - 1 day.
 *
 * Month-end anchoring: the anchor day (day-of-month of the subscription start)
 * is remembered, so Jan 31 -> Feb 28 (29 in leap years) -> Mar 31 -> Apr 30.
 * Every period is computed from the ANCHOR, never from the previous period,
 * so there is no drift.
 */
export type Interval = "daily" | "weekly" | "monthly" | "yearly";
export const INTERVALS: Interval[] = ["daily", "weekly", "monthly", "yearly"];

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseISODate(iso: string): { y: number; m: number; d: number } {
  const match = ISO.exec(iso);
  if (!match) throw new Error(`Invalid ISO date: ${iso}`);
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) throw new Error(`Invalid ISO date: ${iso}`);
  return { y, m, d };
}

export function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export function daysInMonth(y: number, m: number): number {
  return [31, isLeapYear(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
}

function fmt(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function toUTC(iso: string): number {
  const { y, m, d } = parseISODate(iso);
  return Date.UTC(y, m - 1, d);
}

function fromUTC(ms: number): string {
  const dt = new Date(ms);
  return fmt(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function addDays(iso: string, days: number): string {
  return fromUTC(toUTC(iso) + days * 86_400_000);
}

/** Whole days from a to b (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((toUTC(b) - toUTC(a)) / 86_400_000);
}

export function compareDates(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function addMonthsAnchored(iso: string, months: number, anchorDay?: number): string {
  const { y, m, d } = parseISODate(iso);
  const anchor = anchorDay ?? d;
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return fmt(ny, nm, Math.min(anchor, daysInMonth(ny, nm)));
}

/**
 * Start of the n-th period (n = 0 is the anchor itself).
 */
export function periodStartN(anchor: string, interval: Interval, intervalCount: number, n: number): string {
  if (!Number.isInteger(intervalCount) || intervalCount < 1) throw new Error("intervalCount must be >= 1");
  switch (interval) {
    case "daily":
      return addDays(anchor, n * intervalCount);
    case "weekly":
      return addDays(anchor, n * 7 * intervalCount);
    case "monthly":
      return addMonthsAnchored(anchor, n * intervalCount);
    case "yearly":
      return addMonthsAnchored(anchor, n * 12 * intervalCount);
  }
}

/**
 * Given the anchor and any period start, return the next period start.
 * Uses the anchor so month-end days are restored (Feb 28 -> Mar 31 for a Jan 31 anchor).
 */
export function nextPeriodStart(anchor: string, interval: Interval, intervalCount: number, current: string): string {
  // find n such that periodStartN(n) === current, then n+1
  const approx = estimateIndex(anchor, interval, intervalCount, current);
  for (let n = Math.max(0, approx - 2); n <= approx + 2; n++) {
    if (periodStartN(anchor, interval, intervalCount, n) === current) {
      return periodStartN(anchor, interval, intervalCount, n + 1);
    }
  }
  // current is not on the anchor grid: advance from the first grid point after it
  let n = Math.max(0, approx - 2);
  while (compareDates(periodStartN(anchor, interval, intervalCount, n), current) <= 0) n++;
  return periodStartN(anchor, interval, intervalCount, n);
}

function estimateIndex(anchor: string, interval: Interval, intervalCount: number, current: string): number {
  const days = daysBetween(anchor, current);
  const per = interval === "daily" ? 1 : interval === "weekly" ? 7 : interval === "monthly" ? 30.436875 : 365.2425;
  return Math.max(0, Math.round(days / (per * intervalCount)));
}

export interface Period {
  start: string;
  /** exclusive end = next period start */
  endExclusive: string;
  /** inclusive end for display */
  end: string;
  days: number;
}

export function periodAt(anchor: string, interval: Interval, intervalCount: number, start: string): Period {
  const endExclusive = nextPeriodStart(anchor, interval, intervalCount, start);
  return { start, endExclusive, end: addDays(endExclusive, -1), days: daysBetween(start, endExclusive) };
}

export function intervalLabel(interval: Interval, count = 1): string {
  const unit = { daily: "day", weekly: "week", monthly: "month", yearly: "year" }[interval];
  return count === 1 ? `per ${unit}` : `every ${count} ${unit}s`;
}
