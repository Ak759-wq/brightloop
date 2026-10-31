import { policyOf } from "@/lib/permissions";
import { schemas, type SchemaName } from "@/lib/schemas";
import type { Session } from "./auth";
import { bad, forbidden, notFound } from "./http";
import type { Filter } from "./store/types";
import { newId } from "./store/types";
import { audit, nowISO, searchTokens, stamp, type Ctx } from "./services/core";
import { invalidateAnalytics } from "./services/analytics";
import { validateDiscountRule, type DiscountRule } from "@/lib/finance";

const FILTERABLE = ["status", "customerId", "planId", "productId", "subscriptionId", "invoiceId", "type", "role", "active", "trigger", "entity", "kind", "method", "metric", "public", "action", "ruleId"];

export function scopeFilters(session: Session, collection: string): Filter[] {
  const p = policyOf(collection);
  if (!p || !p.read.includes(session.role)) throw forbidden();
  const f: Filter[] = [["orgId", "==", session.orgId]];
  if (collection === "notifications") {
    if (session.role === "customer") f.push(["audience", "==", "customer"], ["customerId", "==", session.customerId]);
    else f.push(["audience", "==", "staff"]);
    return f;
  }
  if (session.role === "customer" && p.own) {
    if (!session.customerId) throw forbidden();
    f.push([p.ownerField ?? "customerId", "==", session.customerId]);
  }
  if (session.role === "customer" && (collection === "plans" || collection === "products" || collection === "product_variants" || collection === "product_addons")) {
    f.push(["active", "==", true]);
    if (collection === "plans") f.push(["public", "==", true]);
  }
  return f;
}

export function redact<T extends Record<string, unknown>>(session: Session, collection: string, doc: T): T {
  const p = policyOf(collection);
  if (session.role !== "admin" && p?.adminOnlyFields?.length) {
    const copy = { ...doc };
    for (const f of p.adminOnlyFields) delete copy[f];
    delete copy._search;
    return copy;
  }
  const { _search, ...rest } = doc;
  void _search;
  return rest as T;
}

export function parseListQuery(session: Session, collection: string, url: URL) {
  const where = scopeFilters(session, collection);
  for (const key of FILTERABLE) {
    const v = url.searchParams.get(key);
    if (v == null || v === "" || v === "all") continue;
    const value = v === "true" ? true : v === "false" ? false : v;
    if (value === "__in_open") where.push([key, "in", ["confirmed", "partially_paid", "overdue"]]);
    else if (v.includes(",")) where.push([key, "in", v.split(",")]);
    else where.push([key, "==", value]);
  }
  const q = url.searchParams.get("q")?.trim().toLowerCase();
  if (q) where.push(["_search", "array-contains", q.slice(0, 15)]);
  return {
    where,
    cursor: url.searchParams.get("cursor"),
    limit: Math.min(Number(url.searchParams.get("limit") ?? 20) || 20, 100),
    orderBy: url.searchParams.get("orderBy") === "name" ? "name" : "createdAt",
    direction: (url.searchParams.get("dir") === "asc" ? "asc" : "desc") as "asc" | "desc",
  };
}

function searchFor(collection: string, d: Record<string, unknown>) {
  return searchTokens(d.name as string, d.email as string, d.code as string, d.value as string, d.company as string, d.city as string);
}

function extraValidation(collection: string, data: Record<string, unknown>) {
  if (collection === "discounts") {
    const errs = validateDiscountRule({ ...(data as unknown as DiscountRule), id: "x" });
    if (errs.length) throw bad(errs[0]);
  }
}

export async function createResource(ctx: Ctx, session: Session, collection: string, raw: unknown) {
  const schema = schemas[collection as SchemaName];
  if (!schema) throw bad("Unsupported resource");
  const data = schema.parse(raw) as Record<string, unknown>;
  extraValidation(collection, data);
  if (collection === "customers") {
    const dup = await ctx.store.all("customers", [["orgId", "==", ctx.org.id], ["email", "==", data.email]]);
    if (dup.length) throw bad("A customer with this email already exists");
  }
  if (collection === "tax_rules" && data.isDefault) await clearDefaultTax(ctx);
  const id = newId(collection.slice(0, 4) + "_");
  const doc = { ...stamp(ctx.org.id), ...data, ...(collection === "discounts" ? { usedCount: 0 } : {}), ...(collection === "customers" ? { creditBalance: 0, userId: null } : {}), _search: searchFor(collection, data) };
  const created = await ctx.store.create(collection, doc, id);
  await audit(ctx, `${collection}.created`, collection, id, { after: data });
  invalidateAnalytics();
  return redact(session, collection, created);
}

async function clearDefaultTax(ctx: Ctx) {
  const defs = await ctx.store.all<{ id: string }>("tax_rules", [["orgId", "==", ctx.org.id], ["isDefault", "==", true]]);
  for (const d of defs) await ctx.store.update("tax_rules", d.id, { isDefault: false });
}

export async function updateResource(ctx: Ctx, session: Session, collection: string, id: string, raw: Record<string, unknown>) {
  const schema = schemas[collection as SchemaName];
  if (!schema) throw bad("Unsupported resource");
  const current = await ctx.store.get<Record<string, unknown>>(collection, id);
  if (!current || current.orgId !== ctx.org.id) throw notFound();
  const merged = schema.parse({ ...current, ...raw }) as Record<string, unknown>;
  extraValidation(collection, merged);
  if (collection === "tax_rules" && merged.isDefault && !current.isDefault) await clearDefaultTax(ctx);
  const changed: Record<string, unknown> = {};
  for (const k of Object.keys(merged)) if (JSON.stringify(merged[k]) !== JSON.stringify(current[k])) changed[k] = merged[k];
  await ctx.store.update(collection, id, { ...changed, updatedAt: nowISO(), _search: searchFor(collection, merged) });
  await audit(ctx, `${collection}.updated`, collection, id, { before: Object.fromEntries(Object.keys(changed).map((k) => [k, current[k]])), after: changed });
  invalidateAnalytics();
  return redact(session, collection, { ...current, ...changed });
}

export async function archiveResource(ctx: Ctx, collection: string, id: string) {
  const current = await ctx.store.get<Record<string, unknown>>(collection, id);
  if (!current || current.orgId !== ctx.org.id) throw notFound();
  if ("active" in current) await ctx.store.update(collection, id, { active: false, updatedAt: nowISO() });
  else if ("status" in current) await ctx.store.update(collection, id, { status: "archived", updatedAt: nowISO() });
  else await ctx.store.delete(collection, id);
  await audit(ctx, `${collection}.archived`, collection, id, { before: { name: current.name ?? id } });
  return { ok: true };
}
