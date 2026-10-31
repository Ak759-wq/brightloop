import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { z } from "zod";
import { DEFAULT_ORG_ID, verifyBearer } from "@/server/auth";
import { toResponse, HttpError } from "@/server/http";
import { getStore } from "@/server/store";
import { createCustomerAccount } from "@/server/accounts";
import type { Profile } from "@/lib/types";

const schema = z.object({ name: z.string().trim().min(2).max(80).optional(), company: z.string().max(120).optional(), placeOfSupply: z.string().regex(/^\d{2}$/).optional() });

/**
 * Firebase mode: called after sign-up/sign-in with a verified ID token.
 * - existing profile -> returned
 * - a CLAIMABLE pending profile for this email (seeded demo accounts, or staff invited by an admin) -> linked
 * - otherwise a new CUSTOMER profile is created. Roles are never taken from the client.
 */
const inflight = new Map<string, Promise<Response>>();

export async function POST(req: Request) {
  const id = await verifyBearer(req);
  if (!id) return toResponse(new HttpError(401, "Please sign in"));
  // serialise concurrent bootstraps for the same user (prevents duplicate customer/profile docs)
  const running = inflight.get(id.uid);
  if (running) return (await running).clone();
  const p = bootstrap(req, id);
  inflight.set(id.uid, p);
  try { return (await p).clone(); } finally { inflight.delete(id.uid); }
}

async function bootstrap(req: Request, id: { uid: string; email: string }): Promise<Response> {
  try {
    const input = schema.parse(await req.json().catch(() => ({})));
    const store = await getStore();
    const existing = await store.get<Profile>("profiles", id.uid);
    if (existing) return NextResponse.json({ profile: existing });
    const pending = await store.get<Profile & { claimable?: boolean }>("profiles", `pending_${id.email}`);
    if (pending?.claimable) {
      const { id: _old, ...rest } = pending;
      void _old;
      await store.create("profiles", { ...rest, uid: id.uid, claimable: false, updatedAt: new Date().toISOString() }, id.uid);
      await store.delete("profiles", pending.id);
      if (pending.customerId) await store.update("customers", pending.customerId, { userId: id.uid });
      return NextResponse.json({ profile: { ...rest, id: id.uid, uid: id.uid } });
    }
    await createCustomerAccount(store, DEFAULT_ORG_ID, id.uid, { name: input.name ?? id.email.split("@")[0], email: id.email, company: input.company, placeOfSupply: input.placeOfSupply });
    return NextResponse.json({ profile: await store.get("profiles", id.uid) });
  } catch (e) {
    return toResponse(e);
  }
}
