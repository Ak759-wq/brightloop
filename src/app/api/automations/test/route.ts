import { z } from "zod";
export const dynamic = "force-dynamic";
import { route, body, notFound } from "@/server/http";
import { ctxFor } from "@/server/ctx";
import { emit, type EventType } from "@/server/services/events";

/** Fires a synthetic event so admins can see a rule execute (logged as a test). */
export const POST = route({ action: "automation.test" }, async (req, session) => {
  const { ruleId } = z.object({ ruleId: z.string() }).parse(await body(req));
  const ctx = await ctxFor(session);
  const rule = await ctx.store.get<{ trigger: EventType; orgId: string }>("automation_rules", ruleId);
  if (!rule || rule.orgId !== ctx.org.id) throw notFound("Rule");
  await emit(ctx, rule.trigger, { customerId: "cust_001", amount: 150000, entity: "test", entityId: ruleId, label: "TEST-EVENT" });
  return { ok: true };
});
