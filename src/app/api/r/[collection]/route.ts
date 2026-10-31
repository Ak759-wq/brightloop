import { canWrite } from "@/lib/permissions";
import { forbidden, route, body } from "@/server/http";
import { ctxFor } from "@/server/ctx";
import { createResource, parseListQuery, redact } from "@/server/resources";

export const dynamic = "force-dynamic";
type C = { params: { collection: string } };

export const GET = route<C>({}, async (req, session, { params }) => {
  const ctx = await ctxFor(session);
  const q = parseListQuery(session, params.collection, new URL(req.url));
  const t0 = Date.now();
  const page = await ctx.store.list<Record<string, unknown>>(params.collection, q);
  return { items: page.items.map((d) => redact(session, params.collection, d)), nextCursor: page.nextCursor, tookMs: Date.now() - t0 };
});

export const POST = route<C>({}, async (req, session, { params }) => {
  if (!canWrite(session.role, params.collection)) throw forbidden();
  const ctx = await ctxFor(session);
  return createResource(ctx, session, params.collection, await body(req));
});
