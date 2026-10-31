import { z } from "zod";
export const dynamic = "force-dynamic";
import { route, body } from "@/server/http";
import { ctxFor } from "@/server/ctx";
import { createFromTemplate } from "@/server/services/subscriptions";

export const POST = route({ action: "subscription.create" }, async (req, session) => {
  const { templateId, customerId } = z.object({ templateId: z.string().min(1), customerId: z.string().min(1, "Choose a customer") }).parse(await body(req));
  return createFromTemplate(await ctxFor(session), templateId, customerId);
});
