import { describe } from "vitest";
import { area, check } from "../audit";
import { allocateProportionally, applyBp, computeUnitPrice, priceLine, roundHalfUp, toMinor, validateQuantity, Tier } from "@/lib/finance";

area("money-pricing");
const tiers: Tier[] = [
  { upTo: 10, unitAmount: 10000 },
  { upTo: 50, unitAmount: 8000 },
  { upTo: null, unitAmount: 6000 },
];

describe("money", () => {
  check("M-01", "round half-up 2.5 → 3", 2.5, 3, () => roundHalfUp(2.5));
  check("M-02", "round half-up −2.5 → −3 (away from zero)", -2.5, -3, () => roundHalfUp(-2.5));
  check("M-03", "float artefact 1.005 rupees → 101 paise", 1.005, 101, () => toMinor(1.005));
  check("M-04", "18% of ₹999.99", { amount: 99999, bp: 1800 }, 18000, () => applyBp(99999, 1800));
  check("M-05", "allocate ₹100 across 3 equal lines sums exactly", { total: 10000, weights: [1, 1, 1] }, [3334, 3333, 3333], () => allocateProportionally(10000, [1, 1, 1]));
  check("M-06", "allocate with zero weights puts all on first", { total: 500, weights: [0, 0] }, [500, 0], () => allocateProportionally(500, [0, 0]));
  check("M-07", "non-integer paise rejected", 10.5, { error: "total must be an integer number of minor units, got 10.5" }, () => allocateProportionally(10.5, [1]));
});

describe("pricing", () => {
  check("P-01", "variant + add-on unit price: CRM ₹1,000 + Odoo ₹560 + Premium support ₹300", { base: 100000, variantDeltas: [56000], addons: [30000] }, 186000, () => computeUnitPrice({ base: 100000, variantDeltas: [56000], addons: [30000] }));
  check("P-02", "per-seat ₹1,860 × 5 seats", { model: "per_seat", unitAmount: 186000, quantity: 5 }, 930000, () => priceLine({ model: "per_seat", unitAmount: 186000, quantity: 5 }));
  check("P-03", "flat price ignores quantity", { model: "flat", unitAmount: 499900, quantity: 20 }, 499900, () => priceLine({ model: "flat", unitAmount: 499900, quantity: 20 }));
  check("P-04", "tiered (graduated) 60 units: 10×100 + 40×80 + 10×60", { model: "tiered", quantity: 60, tiers }, 10 * 10000 + 40 * 8000 + 10 * 6000, () => priceLine({ model: "tiered", unitAmount: 0, quantity: 60, tiers }));
  check("P-05", "volume 60 units all at ₹60", { model: "volume", quantity: 60, tiers }, 360000, () => priceLine({ model: "volume", unitAmount: 0, quantity: 60, tiers }));
  check("P-06", "volume boundary 10 units stays in tier 1", { model: "volume", quantity: 10, tiers }, 100000, () => priceLine({ model: "volume", unitAmount: 0, quantity: 10, tiers }));
  check("P-07", "tiered boundary 11 units crosses into tier 2", { model: "tiered", quantity: 11, tiers }, 108000, () => priceLine({ model: "tiered", unitAmount: 0, quantity: 11, tiers }));
  check("P-08", "below plan minimum quantity is rejected", { quantity: 2, minQuantity: 3 }, { error: "Minimum quantity for this plan is 3" }, () => priceLine({ model: "per_seat", unitAmount: 100, quantity: 2, minQuantity: 3 }));
  check("P-09", "fractional quantity rejected", { quantity: 1.5 }, { error: "Quantity must be a whole number of at least 1" }, () => { validateQuantity(1.5); return null; });
  check("P-10", "tiered with variant extra per unit", { quantity: 5, tiers, perUnitExtra: 56000 }, 5 * 10000 + 5 * 56000, () => priceLine({ model: "tiered", unitAmount: 0, quantity: 5, tiers, perUnitExtra: 56000 }));
  check("P-11", "invalid tiers (last bounded) rejected", { tiers: [{ upTo: 5, unitAmount: 1 }] }, { error: "Last tier must be unbounded (upTo: null)" }, () => priceLine({ model: "tiered", unitAmount: 0, quantity: 1, tiers: [{ upTo: 5, unitAmount: 1 }] }));
  check("P-12", "negative unit price rejected", { base: 1000, variantDeltas: [-2000] }, { error: "Unit price cannot be negative" }, () => computeUnitPrice({ base: 1000, variantDeltas: [-2000] }));
});
