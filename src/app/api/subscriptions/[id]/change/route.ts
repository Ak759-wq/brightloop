import { z } from "zod";
import { lineInputSchema } from "@/lib/schemas";
import { forbidden, route, body } from "@/server/http";
import { ctxFor } from "@/server/ctx";
import { changeSubscription, getSub } from "@/server/services/subscriptions";
import { invalidateAnalytics } from "@/server/services/analytics";

const schema = z.object({ planId: z.string().optional(), items: z.array(lineInputSchema).min(1), discountIds: z.array(z.string()).optional() });

export const POST = route<{ params: { id: string } }>({}, async (req, session, { params }) => {
  const input = schema.parse(await body(req));
  const ctx = await ctxFor(session);
  if (session.role === "customer") {
    const sub = await getSub(ctx, params.id);
    if (sub.customerId !== session.customerId) throw forbidden();
    delete input.discountIds; // customers cannot attach discounts directly
  }
  const r = await changeSubscription(ctx, params.id, input);
  invalidateAnalytics();
  return r;
});
