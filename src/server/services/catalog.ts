import { computeUnitPrice, effectiveUnitPrice, evaluateDiscounts, priceLine, sum, type DiscountRule, type TaxRule } from "@/lib/finance";
import type { LineItem, Plan, Product, ProductAddon, ProductVariant } from "@/lib/types";
import { DomainError } from "../http";
import type { Ctx } from "./core";

export interface LineInput {
  productId: string;
  variantIds: string[];
  addonIds: string[];
  quantity: number;
}

/** Price subscription lines from the live catalog (used for new subs / amendments, never for old invoices). */
export async function priceItems(ctx: Ctx, plan: Plan, inputs: LineInput[]): Promise<LineItem[]> {
  const out: LineItem[] = [];
  for (const input of inputs) {
    const product = await ctx.store.get<Product>("products", input.productId);
    if (!product || product.orgId !== ctx.org.id) throw new DomainError("Product not found");
    if (!product.active) throw new DomainError(`${product.name} is not active`);
    const variants: ProductVariant[] = [];
    for (const vid of input.variantIds ?? []) {
      const v = await ctx.store.get<ProductVariant>("product_variants", vid);
      if (!v || v.productId !== product.id) throw new DomainError("Variant does not belong to this product");
      variants.push(v);
    }
    const addons: ProductAddon[] = [];
    for (const aid of input.addonIds ?? []) {
      const a = await ctx.store.get<ProductAddon>("product_addons", aid);
      if (!a || (a.productId && a.productId !== product.id)) throw new DomainError("Add-on not available for this product");
      addons.push(a);
    }
    const primary = product.id === plan.productId;
    const base = primary ? plan.price : product.salesPrice;
    const extra = sum(variants.map((v) => v.priceDelta)) + sum(addons.map((a) => a.price));
    const model = primary ? plan.pricingModel : "per_seat";
    let amount: number;
    let unitPrice: number;
    if (model === "tiered" || model === "volume") {
      amount = priceLine({ model, quantity: input.quantity, minQuantity: plan.minQuantity, unitAmount: 0, tiers: plan.tiers ?? [], perUnitExtra: extra });
      unitPrice = effectiveUnitPrice(amount, input.quantity);
    } else {
      unitPrice = computeUnitPrice({ base, variantDeltas: variants.map((v) => v.priceDelta), addons: addons.map((a) => a.price) });
      amount = priceLine({ model, quantity: input.quantity, minQuantity: primary ? plan.minQuantity : 1, unitAmount: model === "flat" ? base : unitPrice, perUnitExtra: model === "flat" ? extra : 0 });
    }
    const label = [...variants.map((v) => `${v.attribute}: ${v.value}`), ...addons.map((a) => `+ ${a.name}`)].join(", ");
    out.push({ productId: product.id, productName: product.name, variantIds: input.variantIds ?? [], variantLabel: label, addonIds: input.addonIds ?? [], quantity: input.quantity, unitPrice, amount });
  }
  return out;
}

export async function loadDiscounts(ctx: Ctx, ids: string[]): Promise<DiscountRule[]> {
  const rules: DiscountRule[] = [];
  for (const id of ids) {
    const d = await ctx.store.get<DiscountRule & { orgId: string }>("discounts", id);
    if (d && d.orgId === ctx.org.id) rules.push(d);
  }
  return rules;
}

/** Recurring amount (pre-tax, post-discount) for MRR. Uses today's discount validity. */
export function recurringAmountOf(items: LineItem[], rules: DiscountRule[], today: string, redeemed: string[]) {
  const subtotal = sum(items.map((i) => i.amount));
  const ev = evaluateDiscounts(rules, { date: today, lines: items.map((i) => ({ productId: i.productId, quantity: i.quantity, amount: i.amount })), redeemedIds: redeemed });
  return { subtotal, recurringAmount: subtotal - ev.total };
}

export async function taxRuleFor(ctx: Ctx, productId: string): Promise<TaxRule | null> {
  const product = await ctx.store.get<Product>("products", productId);
  if (product?.taxRuleId) {
    const r = await ctx.store.get<TaxRule>("tax_rules", product.taxRuleId);
    if (r) return r;
  }
  const defaults = await ctx.store.all<TaxRule & { isDefault: boolean }>("tax_rules", [["orgId", "==", ctx.org.id], ["isDefault", "==", true]]);
  return defaults[0] ?? null;
}
