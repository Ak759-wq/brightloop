import { z } from "zod";
export const dynamic = "force-dynamic";
import { forbidden, route, body } from "@/server/http";
import { ctxFor } from "@/server/ctx";
import { getSub, transition } from "@/server/services/subscriptions";
import { invalidateAnalytics } from "@/server/services/analytics";

const schema = z.object({
  action: z.enum(["send_quotation", "confirm", "activate", "pause", "resume", "renew", "close", "revert_to_draft"]),
  reason: z.string().max(300).optional(),
  acceptRetentionOffer: z.boolean().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
const CUSTOMER_ACTIONS = ["pause", "resume", "close", "renew", "confirm"];

export const POST = route<{ params: { id: string } }>({}, async (req, session, { params }) => {
  const input = schema.parse(await body(req));
  const ctx = await ctxFor(session);
  if (session.role === "customer") {
    const sub = await getSub(ctx, params.id);
    if (sub.customerId !== session.customerId) throw forbidden();
    if (!CUSTOMER_ACTIONS.includes(input.action)) throw forbidden("Customers can pause, resume, renew, accept a quotation or cancel");
  }
  const res = await transition(ctx, params.id, input.action, input);
  invalidateAnalytics();
  return res;
});
