import { allocateProportionally, applyBp, assertMinor, Minor, sum } from "./money";
import { compareDates } from "./period";

export interface DiscountRule {
  id: string;
  name: string;
  code?: string;
  type: "fixed" | "percent";
  /** fixed: minor units. percent: basis points (1000 = 10%) */
  value: number;
  scope: "subscription" | "product";
  productIds?: string[];
  minQuantity?: number | null;
  minAmount?: Minor | null;
  startDate?: string | null;
  endDate?: string | null;
  usageLimit?: number | null;
  usedCount?: number;
  active?: boolean;
}

export interface DiscountLine {
  productId: string;
  quantity: number;
  /** pre-discount line amount (minor) */
  amount: Minor;
}

export interface DiscountContext {
  date: string;
  lines: DiscountLine[];
  /** set true when this discount was already redeemed by this subscription (re-application on renewals does not consume new usages) */
  alreadyRedeemed?: boolean;
}

export interface DiscountEvaluation {
  applicable: boolean;
  reason?: string;
  /** total discount (minor), never more than the eligible base */
  amount: Minor;
  /** discount allocated per input line (same order) */
  perLine: Minor[];
}

const none = (lines: DiscountLine[], reason: string): DiscountEvaluation => ({
  applicable: false,
  reason,
  amount: 0,
  perLine: lines.map(() => 0),
});

export function validateDiscountRule(rule: DiscountRule): string[] {
  const errors: string[] = [];
  if (rule.type === "percent" && (rule.value <= 0 || rule.value > 10_000)) errors.push("Percentage must be between 0.01% and 100%");
  if (rule.type === "fixed" && (!Number.isInteger(rule.value) || rule.value <= 0)) errors.push("Fixed discount must be a positive amount");
  if (rule.scope === "product" && !rule.productIds?.length) errors.push("Product-specific discounts need at least one product");
  if (rule.startDate && rule.endDate && compareDates(rule.startDate, rule.endDate) > 0) errors.push("Start date must be before end date");
  if (rule.usageLimit != null && rule.usageLimit < 1) errors.push("Usage limit must be at least 1");
  return errors;
}

/**
 * Evaluate a discount against invoice lines. Discounts are applied BEFORE tax
 * (GST is charged on the discounted transaction value).
 */
export function evaluateDiscount(rule: DiscountRule, ctx: DiscountContext): DiscountEvaluation {
  const { lines, date } = ctx;
  lines.forEach((l) => assertMinor(l.amount, "line.amount"));
  if (rule.active === false) return none(lines, "Discount is inactive");
  if (rule.startDate && compareDates(date, rule.startDate) < 0) return none(lines, "Discount has not started yet");
  if (rule.endDate && compareDates(date, rule.endDate) > 0) return none(lines, "Discount has expired");
  if (!ctx.alreadyRedeemed && rule.usageLimit != null && (rule.usedCount ?? 0) >= rule.usageLimit) {
    return none(lines, "Discount usage limit reached");
  }
  const eligible = lines.map((l) => (rule.scope === "subscription" || rule.productIds?.includes(l.productId) ? l : null));
  const eligibleLines = eligible.filter((l): l is DiscountLine => l !== null);
  if (!eligibleLines.length) return none(lines, "No eligible products on this invoice");
  const base = sum(eligibleLines.map((l) => l.amount));
  const qty = sum(eligibleLines.map((l) => l.quantity));
  if (rule.minQuantity != null && qty < rule.minQuantity) return none(lines, `Requires at least ${rule.minQuantity} units`);
  if (rule.minAmount != null && base < rule.minAmount) return none(lines, "Minimum purchase amount not met");
  if (base <= 0) return none(lines, "Nothing to discount");

  const amount = rule.type === "percent" ? Math.min(base, applyBp(base, rule.value)) : Math.min(base, rule.value);
  const weights = eligible.map((l) => (l ? l.amount : 0));
  const perLine = allocateProportionally(amount, weights);
  return { applicable: true, amount, perLine };
}

/**
 * Apply several discounts in sequence (each one sees the amounts left after the previous).
 * Returns per-line totals that never exceed the line amounts.
 */
export function evaluateDiscounts(rules: DiscountRule[], ctx: DiscountContext & { redeemedIds?: string[] }) {
  let lines = ctx.lines.map((l) => ({ ...l }));
  const totals = ctx.lines.map(() => 0);
  const applied: { rule: DiscountRule; amount: Minor }[] = [];
  const skipped: { rule: DiscountRule; reason: string }[] = [];
  for (const rule of rules) {
    const ev = evaluateDiscount(rule, { date: ctx.date, lines, alreadyRedeemed: ctx.redeemedIds?.includes(rule.id) });
    if (!ev.applicable) {
      skipped.push({ rule, reason: ev.reason ?? "Not applicable" });
      continue;
    }
    ev.perLine.forEach((d, i) => (totals[i] += d));
    lines = lines.map((l, i) => ({ ...l, amount: l.amount - ev.perLine[i] }));
    applied.push({ rule, amount: ev.amount });
  }
  return { perLine: totals, total: sum(totals), applied, skipped };
}
