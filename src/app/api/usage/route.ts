import { z } from "zod";
import { route, body } from "@/server/http";
import { ctxFor } from "@/server/ctx";
import { recordUsage } from "@/server/services/usage";

const schema = z.object({ subscriptionId: z.string().min(1), metric: z.string().min(1).max(40), quantity: z.number().int().positive().max(1_000_000), idempotencyKey: z.string().max(80).optional() });

export const POST = route({ action: "usage.record" }, async (req, session) => recordUsage(await ctxFor(session), schema.parse(await body(req))));
