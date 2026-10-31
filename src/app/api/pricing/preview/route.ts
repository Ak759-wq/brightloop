import { z } from "zod";
export const dynamic = "force-dynamic";
import { lineInputSchema } from "@/lib/schemas";
import { route, body, notFound } from "@/server/http";
import { ctxFor } from "@/server/ctx";
import { loadDiscounts, priceItems } from "@/server/services/catalog";
import { composeInvoice, taxRulesFor } from "@/server/services/invoices";
import type { Customer, Plan } from "@/lib/types";

const schema = z.object({ planId: z.string().min(1), customerId: z.string().optional(), items: z.array(lineInputSchema).min(1), discountIds: z.array(z.string()).default([]) });

/** Live price preview for forms: same engine as invoicing, nothing is saved. */
export const POST = route({}, async (req, session) => {
  const input = schema.parse(await body(req));
  const ctx = await ctxFor(session);
  const plan = await ctx.store.get<Plan>("plans", input.planId);
  if (!plan) throw notFound("Plan");
  const customerId = session.role === "customer" ? session.customerId! : input.customerId;
  const customer = customerId ? await ctx.store.get<Customer>("customers", customerId) : null;
  const items = await priceItems(ctx, plan, input.items);
  const discounts = session.role === "customer" ? [] : await loadDiscounts(ctx, input.discountIds);
  const taxMap = await taxRulesFor(ctx, items.map((i) => i.productId));
  let preview = null as null | ReturnType<typeof composeInvoice>;
  let taxError: string | null = null;
  try {
    preview = composeInvoice(ctx, { sub: null, customer: customer ?? ({ placeOfSupply: ctx.org.sellerState } as Customer), items, kind: "manual", discounts, redeemedIds: [], invoiceDate: ctx.today, paymentTermsDays: 0 }, taxMap);
  } catch (e) {
    taxError = (e as Error).message;
  }
  return { items, preview, taxError, assumedIntraState: !customer };
});
