import { z } from "zod";
export const dynamic = "force-dynamic";
import { route, body } from "@/server/http";
import { ctxFor } from "@/server/ctx";
import { scopeFilters } from "@/server/resources";

export const POST = route({}, async (req, session) => {
  const { ids } = z.object({ ids: z.array(z.string()).max(200).optional() }).parse(await body(req));
  const ctx = await ctxFor(session);
  const mine = await ctx.store.all<{ id: string; read: boolean }>("notifications", [...scopeFilters(session, "notifications"), ["read", "==", false]]);
  const target = ids ? mine.filter((n) => ids.includes(n.id)) : mine;
  for (const n of target) await ctx.store.update("notifications", n.id, { read: true });
  return { updated: target.length };
});
