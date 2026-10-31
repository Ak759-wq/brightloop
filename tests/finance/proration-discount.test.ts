import { describe } from "vitest";
import { area, check } from "../audit";
import { DiscountRule, evaluateDiscount, evaluateDiscounts, prorate, validateDiscountRule } from "@/lib/finance";

area("proration-discount");
const lines = [
  { productId: "crm", quantity: 5, amount: 930000 },
  { productId: "support", quantity: 1, amount: 30000 },
];
const pct: DiscountRule = { id: "d1", name: "10% off", type: "percent", value: 1000, scope: "subscription" };

describe("proration", () => {
  check("R-01", "upgrade mid-cycle: ₹1,000 → ₹1,860, 15 of 30 days left", { periodStart: "2026-11-01", periodEndExclusive: "2026-12-01", changeDate: "2026-11-16", oldAmount: 100000, newAmount: 186000 },
    { totalDays: 30, remainingDays: 15, credit: 50000, charge: 93000, net: 43000, kind: "upgrade" },
    () => prorate({ periodStart: "2026-11-01", periodEndExclusive: "2026-12-01", changeDate: "2026-11-16", oldAmount: 100000, newAmount: 186000 }));
  check("R-02", "downgrade gives credit (negative net)", { periodStart: "2026-11-01", periodEndExclusive: "2026-12-01", changeDate: "2026-11-21", oldAmount: 186000, newAmount: 100000 },
    { totalDays: 30, remainingDays: 10, credit: 62000, charge: 33333, net: -28667, kind: "downgrade" },
    () => prorate({ periodStart: "2026-11-01", periodEndExclusive: "2026-12-01", changeDate: "2026-11-21", oldAmount: 186000, newAmount: 100000 }));
  check("R-03", "change on first day = full swap", { changeDate: "2026-11-01" }, { totalDays: 30, remainingDays: 30, credit: 100000, charge: 186000, net: 86000, kind: "upgrade" },
    () => prorate({ periodStart: "2026-11-01", periodEndExclusive: "2026-12-01", changeDate: "2026-11-01", oldAmount: 100000, newAmount: 186000 }));
  check("R-04", "February leap month uses 29 days", { periodStart: "2028-02-01", changeDate: "2028-02-15" }, { totalDays: 29, remainingDays: 15, credit: 51724, charge: 103448, net: 51724, kind: "upgrade" },
    () => prorate({ periodStart: "2028-02-01", periodEndExclusive: "2028-03-01", changeDate: "2028-02-15", oldAmount: 100000, newAmount: 200000 }));
  check("R-05", "change outside period rejected", { changeDate: "2026-12-05" }, { error: "Change date must fall within the current billing period" },
    () => prorate({ periodStart: "2026-11-01", periodEndExclusive: "2026-12-01", changeDate: "2026-12-05", oldAmount: 1, newAmount: 2 }));
});

describe("discounts", () => {
  check("C-01", "10% subscription-wide on ₹9,600", { rule: pct, lines }, { applicable: true, amount: 96000, perLine: [93000, 3000] }, () => evaluateDiscount(pct, { date: "2026-11-01", lines }));
  check("C-02", "fixed ₹500 product-specific to CRM only", { type: "fixed", value: 50000, productIds: ["crm"] }, { applicable: true, amount: 50000, perLine: [50000, 0] },
    () => evaluateDiscount({ id: "d2", name: "x", type: "fixed", value: 50000, scope: "product", productIds: ["crm"] }, { date: "2026-11-01", lines }));
  check("C-03", "fixed discount capped at eligible base", { value: 5000000, productIds: ["support"] }, { applicable: true, amount: 30000, perLine: [0, 30000] },
    () => evaluateDiscount({ id: "d3", name: "x", type: "fixed", value: 5000000, scope: "product", productIds: ["support"] }, { date: "2026-11-01", lines }));
  check("C-04", "minimum quantity not met", { minQuantity: 10 }, { applicable: false, reason: "Requires at least 10 units", amount: 0, perLine: [0, 0] },
    () => evaluateDiscount({ ...pct, minQuantity: 10 }, { date: "2026-11-01", lines }));
  check("C-05", "minimum amount not met", { minAmount: 1000000 }, { applicable: false, reason: "Minimum purchase amount not met", amount: 0, perLine: [0, 0] },
    () => evaluateDiscount({ ...pct, minAmount: 1000000 }, { date: "2026-11-01", lines }));
  check("C-06", "expired discount stops applying", { endDate: "2026-10-31", date: "2026-11-01" }, { applicable: false, reason: "Discount has expired", amount: 0, perLine: [0, 0] },
    () => evaluateDiscount({ ...pct, endDate: "2026-10-31" }, { date: "2026-11-01", lines }));
  check("C-07", "not started yet", { startDate: "2026-12-01" }, { applicable: false, reason: "Discount has not started yet", amount: 0, perLine: [0, 0] },
    () => evaluateDiscount({ ...pct, startDate: "2026-12-01" }, { date: "2026-11-01", lines }));
  check("C-08", "usage limit reached blocks new redemption", { usageLimit: 5, usedCount: 5 }, { applicable: false, reason: "Discount usage limit reached", amount: 0, perLine: [0, 0] },
    () => evaluateDiscount({ ...pct, usageLimit: 5, usedCount: 5 }, { date: "2026-11-01", lines }));
  check("C-09", "already-redeemed subscription keeps discount on renewal despite limit", { usageLimit: 5, usedCount: 5, alreadyRedeemed: true }, { applicable: true, amount: 96000, perLine: [93000, 3000] },
    () => evaluateDiscount({ ...pct, usageLimit: 5, usedCount: 5 }, { date: "2026-11-01", lines, alreadyRedeemed: true }));
  check("C-10", "stacked: 10% then fixed ₹100 on remainder", { rules: ["10%", "₹100"] }, { perLine: [102688, 3312], total: 106000 },
    () => { const r = evaluateDiscounts([pct, { id: "f", name: "f", type: "fixed", value: 10000, scope: "subscription" }], { date: "2026-11-01", lines }); return { perLine: r.perLine, total: r.total }; });
  check("C-11", "invalid percent >100% rejected by validator", { value: 12000 }, ["Percentage must be between 0.01% and 100%"], () => validateDiscountRule({ ...pct, value: 12000 }));
  check("C-12", "product discount without products rejected", { scope: "product" }, ["Product-specific discounts need at least one product"], () => validateDiscountRule({ ...pct, scope: "product" }));
});
