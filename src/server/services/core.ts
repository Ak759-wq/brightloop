import type { Notification, Organization, Role } from "@/lib/types";
import { newId, type Store, type Tx } from "../store/types";

export interface Actor {
  uid: string;
  name: string;
  role: Role | "system";
  customerId?: string | null;
}

export interface Ctx {
  store: Store;
  org: Organization;
  actor: Actor;
  today: string;
}

export const SYSTEM: Actor = { uid: "system", name: "Billing scheduler", role: "system" };

export function realToday(tz = "Asia/Kolkata"): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

/**
 * Business date. Demo orgs may set a simulated date (Settings → Demo clock) that drives billing
 * dates only; real createdAt/updatedAt timestamps always use the real clock.
 */
export function businessToday(org: Organization): string {
  return org.demo && org.demoDate ? org.demoDate : realToday();
}

export async function makeCtx(store: Store, orgId: string, actor: Actor): Promise<Ctx> {
  const org = await store.get<Organization>("organizations", orgId);
  if (!org) throw new Error("Organization not found");
  return { store, org, actor, today: businessToday(org) };
}

export const nowISO = () => new Date().toISOString();

export function stamp(orgId: string) {
  const t = nowISO();
  return { orgId, createdAt: t, updatedAt: t };
}

/** Search tokens: lower-cased words and their prefixes, for array-contains search. */
export function searchTokens(...values: (string | null | undefined)[]): string[] {
  const set = new Set<string>();
  for (const v of values) {
    if (!v) continue;
    const s = v.toLowerCase().trim();
    set.add(s);
    for (const word of s.split(/[\s@._\-/]+/)) {
      for (let i = 2; i <= Math.min(word.length, 15); i++) set.add(word.slice(0, i));
    }
  }
  return [...set].slice(0, 120);
}

export async function audit(ctx: Ctx, action: string, entity: string, entityId: string, details?: { before?: unknown; after?: unknown; note?: string }, tx?: Tx) {
  const doc = {
    ...stamp(ctx.org.id),
    actorId: ctx.actor.uid,
    actorName: ctx.actor.name,
    actorRole: ctx.actor.role,
    action,
    entity,
    entityId,
    note: details?.note ?? null,
    before: details?.before ?? null,
    after: details?.after ?? null,
    _search: searchTokens(action, entity, ctx.actor.name),
  };
  const id = newId("log_");
  if (tx) tx.create("audit_logs", id, doc);
  else await ctx.store.create("audit_logs", doc, id);
}

export async function notify(ctx: Ctx, n: Pick<Notification, "audience" | "title" | "body" | "level"> & { customerId?: string | null; link?: string; channel?: Notification["channel"] }, tx?: Tx) {
  const doc = { ...stamp(ctx.org.id), read: false, channel: "in_app", customerId: null, link: null, ...n };
  const id = newId("ntf_");
  if (tx) tx.create("notifications", id, doc);
  else await ctx.store.create("notifications", doc, id);
}

/** Sequence numbers via a counters doc inside a transaction (read before writes!). */
export async function readCounter(tx: Tx, orgId: string, key: string): Promise<number> {
  const c = await tx.get<{ value: number }>("counters", `${orgId}_${key}`);
  return c?.value ?? 0;
}
export function writeCounter(tx: Tx, orgId: string, key: string, value: number) {
  tx.set("counters", `${orgId}_${key}`, { orgId, key, value, updatedAt: nowISO() });
}
export const fmtSub = (n: number) => `SUB-${String(n).padStart(6, "0")}`;
export const fmtInv = (year: string, n: number) => `INV-${year}-${String(n).padStart(6, "0")}`;
export const fmtCn = (year: string, n: number) => `CN-${year}-${String(n).padStart(5, "0")}`;
export const fmtPay = (n: number) => `PAY-${String(n).padStart(6, "0")}`;
