import { z } from "zod";
import { route, body, forbidden } from "@/server/http";
import { ctxFor } from "@/server/ctx";
import { topUpWallet } from "@/server/services/usage";

const schema = z.object({ customerId: z.string().optional(), credits: z.number().int().positive().max(1_000_000), note: z.string().max(120).optional() });

/** Customers top up via the Payment Simulator (labelled); staff/admin can grant credits. */
export const POST = route({ action: "credits.topup" }, async (req, session) => {
  const input = schema.parse(await body(req));
  const customerId = session.role === "customer" ? session.customerId : input.customerId;
  if (!customerId) throw forbidden("Choose a customer");
  return topUpWallet(await ctxFor(session), customerId, input.credits, input.note || (session.role === "customer" ? "Self top-up (Payment Simulator)" : `Granted by ${session.name}`));
});
