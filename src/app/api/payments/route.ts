import { paymentSchema } from "@/lib/schemas";
export const dynamic = "force-dynamic";
import { route, body } from "@/server/http";
import { ctxFor } from "@/server/ctx";
import { recordPayment } from "@/server/services/payments";
import { invalidateAnalytics } from "@/server/services/analytics";

export const POST = route({ action: "payment.record" }, async (req, session) => {
  const input = paymentSchema.parse(await body(req));
  const r = await recordPayment(await ctxFor(session), input);
  invalidateAnalytics();
  return r;
});
