import { subscriptionCreateSchema } from "@/lib/schemas";
export const dynamic = "force-dynamic";
import { route, body } from "@/server/http";
import { ctxFor } from "@/server/ctx";
import { createSubscription } from "@/server/services/subscriptions";
import { invalidateAnalytics } from "@/server/services/analytics";

export const POST = route({ action: "subscription.create" }, async (req, session) => {
  const ctx = await ctxFor(session);
  const input = subscriptionCreateSchema.parse(await body(req));
  const sub = await createSubscription(ctx, input);
  invalidateAnalytics();
  return sub;
});
