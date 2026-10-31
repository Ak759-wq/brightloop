import { z } from "zod";
export const dynamic = "force-dynamic";
import { route, body } from "@/server/http";
import { ctxFor } from "@/server/ctx";
import { simulatePayment } from "@/server/services/payments";
import { invalidateAnalytics } from "@/server/services/analytics";

const schema = z.object({ invoiceId: z.string().min(1), outcome: z.enum(["success", "fail", "partial"]), reason: z.string().max(200).optional(), amount: z.number().int().positive().optional() });

/** PAYMENT SIMULATOR – no real money moves. Replace with the Razorpay adapter when keys exist. */
export const POST = route({ action: "payment.simulate" }, async (req, session) => {
  const input = schema.parse(await body(req));
  const r = await simulatePayment(await ctxFor(session), input.invoiceId, input.outcome, input);
  invalidateAnalytics();
  return r;
});
