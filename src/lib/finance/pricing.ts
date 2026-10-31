import { assertMinor, Minor, roundHalfUp, sum } from "./money";

export type PricingModel = "flat" | "per_seat" | "tiered" | "volume";

export interface Tier {
  /** inclusive upper bound of units in this tier; null = infinity */
  upTo: number | null;
  /** price per unit inside this tier (minor units) */
  unitAmount: Minor;
  /** optional flat fee added when the tier is reached (minor units) */
  flatAmount?: Minor;
}

export class PricingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PricingError";
  }
}

export interface UnitPriceInput {
  base: Minor;
  /** price deltas from chosen variants, e.g. Brand=Odoo +56000 */
  variantDeltas?: Minor[];
  /** per-unit add-on prices, e.g. Premium support +30000 */
  addons?: Minor[];
}

/** Brightloop CRM ₹1,000 + Odoo ₹560 + Premium support ₹300 = ₹1,860 */
export function computeUnitPrice({ base, variantDeltas = [], addons = [] }: UnitPriceInput): Minor {
  assertMinor(base, "base");
  [...variantDeltas, ...addons].forEach((v) => assertMinor(v, "delta"));
  const unit = base + sum(variantDeltas) + sum(addons);
  if (unit < 0) throw new PricingError("Unit price cannot be negative");
  return unit;
}

export function validateQuantity(quantity: number, minQuantity = 1): void {
  if (!Number.isInteger(quantity) || quantity < 1) throw new PricingError("Quantity must be a whole number of at least 1");
  if (quantity < minQuantity) throw new PricingError(`Minimum quantity for this plan is ${minQuantity}`);
}

function validateTiers(tiers: Tier[]): void {
  if (!tiers.length) throw new PricingError("Tiered/volume pricing needs at least one tier");
  let prev = 0;
  tiers.forEach((t, i) => {
    assertMinor(t.unitAmount, "tier.unitAmount");
    if (t.upTo === null) {
      if (i !== tiers.length - 1) throw new PricingError("Only the last tier may be unbounded");
    } else {
      if (t.upTo <= prev) throw new PricingError("Tier bounds must be strictly increasing");
      prev = t.upTo;
    }
  });
  if (tiers[tiers.length - 1].upTo !== null) throw new PricingError("Last tier must be unbounded (upTo: null)");
}

export interface LinePriceInput {
  model: PricingModel;
  quantity: number;
  minQuantity?: number;
  /** unit price for per_seat, or the fixed price for flat */
  unitAmount: Minor;
  tiers?: Tier[];
  /** per-unit extra from variants/add-ons applied on top of tiered/volume prices */
  perUnitExtra?: Minor;
}

/**
 * Price a line before discounts and tax.
 *  flat     : unitAmount once, regardless of quantity
 *  per_seat : unitAmount × quantity
 *  tiered   : graduated – each unit priced in the tier it falls into
 *  volume   : all units priced at the tier the TOTAL quantity falls into
 */
export function priceLine(input: LinePriceInput): Minor {
  const { model, quantity, minQuantity = 1, unitAmount, tiers = [], perUnitExtra = 0 } = input;
  validateQuantity(quantity, minQuantity);
  assertMinor(unitAmount, "unitAmount");
  switch (model) {
    case "flat":
      return unitAmount + perUnitExtra * quantity;
    case "per_seat":
      return (unitAmount + perUnitExtra) * quantity;
    case "tiered": {
      validateTiers(tiers);
      let remaining = quantity;
      let lower = 0;
      let total = 0;
      for (const t of tiers) {
        const cap = t.upTo === null ? Infinity : t.upTo - lower;
        const units = Math.min(remaining, cap);
        if (units <= 0) break;
        total += units * t.unitAmount + (t.flatAmount ?? 0);
        remaining -= units;
        lower = t.upTo ?? lower;
        if (remaining <= 0) break;
      }
      return total + perUnitExtra * quantity;
    }
    case "volume": {
      validateTiers(tiers);
      const tier = tiers.find((t) => t.upTo === null || quantity <= t.upTo)!;
      return quantity * tier.unitAmount + (tier.flatAmount ?? 0) + perUnitExtra * quantity;
    }
    default:
      throw new PricingError(`Unknown pricing model ${String(model)}`);
  }
}

/** Effective unit price for display = line amount / quantity (rounded). */
export function effectiveUnitPrice(lineAmount: Minor, quantity: number): Minor {
  return roundHalfUp(lineAmount / quantity);
}
