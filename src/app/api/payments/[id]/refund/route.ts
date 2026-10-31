import { z } from "zod";
export const dynamic = "force-dynamic";
import { route, body } from "@/server/http";
import { ctxFor } from "@/server/ctx";
import { refundPayment } from "@/server/services/payments";

export const POST = route<{ params: { id: string } }>({ action: "payment.refund" }, async (req, session, { params }) => {
  const { amount, reason } = z.object({ amount: z.number().int().positive(), reason: z.string().min(2).max(300) }).parse(await body(req));
  return refundPayment(await ctxFor(session), params.id, amount, reason);
});
