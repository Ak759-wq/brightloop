/**
 * Money primitives. All amounts are integer minor units (paise for INR).
 *
 * ROUNDING RULES (documented in docs/FINANCE_RULES.md):
 *  - Any fractional minor unit is rounded HALF-UP (away from zero for .5),
 *    at the LINE level, per tax component. Invoice totals are sums of
 *    already-rounded line values, so totals always reconcile to the paisa.
 *  - Percentages are stored as basis points (1% = 100 bp) to stay integral.
 *  - Splitting an amount across lines uses the largest-remainder method so
 *    the parts always sum exactly to the whole.
 */
export type Minor = number;

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyError";
  }
}

export function assertMinor(value: number, label = "amount"): Minor {
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new MoneyError(`${label} must be an integer number of minor units, got ${value}`);
  }
  return value;
}

/** Round half-up (half away from zero). */
export function roundHalfUp(value: number): number {
  const sign = value < 0 ? -1 : 1;
  // Guard against binary float artefacts like 2.4999999999 for 2.5
  const abs = Math.abs(value);
  const rounded = Math.floor(abs + 0.5 + 1e-9);
  return sign * rounded === 0 ? 0 : sign * rounded;
}

/** Convert major units (e.g. rupees, possibly with 2 decimals) to minor units. */
export function toMinor(major: number): Minor {
  return roundHalfUp(major * 100);
}

export function toMajor(minor: Minor): number {
  return minor / 100;
}

/** amount × basisPoints / 10_000, rounded half-up. */
export function applyBp(amount: Minor, bp: number): Minor {
  return roundHalfUp((amount * bp) / 10_000);
}

export function sum(values: Minor[]): Minor {
  return values.reduce((a, b) => a + b, 0);
}

/**
 * Split `total` into parts proportional to `weights` using the largest
 * remainder method. Parts always sum to exactly `total`.
 */
export function allocateProportionally(total: Minor, weights: number[]): Minor[] {
  assertMinor(total, "total");
  const weightSum = weights.reduce((a, b) => a + b, 0);
  if (weights.length === 0) return [];
  if (weightSum <= 0) return weights.map((_, i) => (i === 0 ? total : 0));
  const raw = weights.map((w) => (total * w) / weightSum);
  const floors = raw.map((r) => Math.floor(r));
  let remainder = total - sum(floors);
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (remainder <= 0) break;
    floors[i] += 1;
    remainder -= 1;
  }
  return floors;
}

const formatters = new Map<string, Intl.NumberFormat>();
export function formatMoney(minor: Minor, currency = "INR", opts: { compact?: boolean } = {}): string {
  const key = `${currency}-${opts.compact ? "c" : "f"}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
      style: "currency",
      currency,
      notation: opts.compact ? "compact" : "standard",
      maximumFractionDigits: opts.compact ? 1 : 2,
      minimumFractionDigits: opts.compact ? 0 : 2,
    });
    formatters.set(key, f);
  }
  return f.format(minor / 100);
}
