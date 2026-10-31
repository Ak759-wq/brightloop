import { assertMinor, Minor, roundHalfUp } from "./money";
import { compareDates, daysBetween } from "./period";

export interface ProrationInput {
  periodStart: string;
  /** exclusive end of the current period (next billing date) */
  periodEndExclusive: string;
  /** the day the change takes effect (the change applies from this day inclusive) */
  changeDate: string;
  /** amount of the OLD configuration for a full period, pre-tax, post-discount */
  oldAmount: Minor;
  /** amount of the NEW configuration for a full period */
  newAmount: Minor;
}

export interface ProrationResult {
  totalDays: number;
  remainingDays: number;
  /** unused value of the old plan returned to the customer */
  credit: Minor;
  /** value of the new plan for the rest of the period */
  charge: Minor;
  /** charge - credit. Positive => customer owes (upgrade). Negative => customer is owed (downgrade). */
  net: Minor;
  kind: "upgrade" | "downgrade" | "no_change";
}

/**
 * Day-based proration. Each component is rounded half-up independently,
 * then net = charge - credit (so the parts are always auditable).
 */
export function prorate(input: ProrationInput): ProrationResult {
  const { periodStart, periodEndExclusive, changeDate, oldAmount, newAmount } = input;
  assertMinor(oldAmount, "oldAmount");
  assertMinor(newAmount, "newAmount");
  if (compareDates(changeDate, periodStart) < 0 || compareDates(changeDate, periodEndExclusive) > 0) {
    throw new Error("Change date must fall within the current billing period");
  }
  const totalDays = daysBetween(periodStart, periodEndExclusive);
  if (totalDays <= 0) throw new Error("Billing period must be at least one day");
  const remainingDays = daysBetween(changeDate, periodEndExclusive);
  const credit = roundHalfUp((oldAmount * remainingDays) / totalDays);
  const charge = roundHalfUp((newAmount * remainingDays) / totalDays);
  const net = charge - credit;
  return {
    totalDays,
    remainingDays,
    credit,
    charge,
    net,
    kind: net > 0 ? "upgrade" : net < 0 ? "downgrade" : "no_change",
  };
}
