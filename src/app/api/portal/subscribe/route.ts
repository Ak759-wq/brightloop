import { z } from "zod";
export const dynamic = "force-dynamic";
import { route, body, forbidden } from "@/server/http";
import { ctxFor } from "@/server/ctx";
import { selfSubscribe } from "@/server/services/subscriptions";
import { invalidateAnalytics } from "@/server/services/analytics";

const schema = z.object({ planId: z.string().min(1), quantity: z.number().int().min(1), variantIds: z.array(z.string()).default([]), addonIds: z.array(z.string()).default([]), code: z.string().max(30).optional() });

export const POST = route({ roles: ["customer"] }, async (req, session) => {
  if (!session.customerId) throw forbidden();
  const input = schema.parse(await body(req));
  const ctx = await ctxFor(session);
  const plan = await ctx.store.get<{ productId: string; public: boolean; active: boolean }>("plans", input.planId);
  if (!plan || !plan.public || !plan.active) throw forbidden("This plan is not available for self-service");
  const sub = await selfSubscribe(ctx, session.customerId, input.planId, { productId: plan.productId, quantity: input.quantity, variantIds: input.variantIds, addonIds: input.addonIds }, input.code);
  invalidateAnalytics();
  return sub;
});
