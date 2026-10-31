import { canWrite, policyOf } from "@/lib/permissions";
import { forbidden, notFound, route, body } from "@/server/http";
import { ctxFor } from "@/server/ctx";
import { archiveResource, redact, scopeFilters, updateResource } from "@/server/resources";
import { matches } from "@/server/store/types";

export const dynamic = "force-dynamic";
type C = { params: { collection: string; id: string } };

export const GET = route<C>({}, async (_req, session, { params }) => {
  const ctx = await ctxFor(session);
  const filters = scopeFilters(session, params.collection);
  const doc = await ctx.store.get<Record<string, unknown>>(params.collection, params.id);
  if (!doc || !filters.every((f) => matches(doc, f))) throw notFound();
  return redact(session, params.collection, doc);
});

export const PATCH = route<C>({}, async (req, session, { params }) => {
  if (!canWrite(session.role, params.collection)) throw forbidden();
  const ctx = await ctxFor(session);
  return updateResource(ctx, session, params.collection, params.id, await body(req));
});

export const DELETE = route<C>({}, async (_req, session, { params }) => {
  if (!canWrite(session.role, params.collection) || !policyOf(params.collection)) throw forbidden();
  const ctx = await ctxFor(session);
  return archiveResource(ctx, params.collection, params.id);
});
