import { NextResponse } from "next/server";
import { z } from "zod";
import { cronSecretOk } from "@/server/cron";
import { getStore } from "@/server/store";
import { DEFAULT_ORG_ID } from "@/server/auth";
import type { Profile } from "@/lib/types";

export const dynamic = "force-dynamic";
const schema = z.object({ email: z.string().email(), role: z.enum(["admin", "staff"]), name: z.string().min(2).max(80).optional() });

/**
 * POST /api/admin/grant-role (header x-cron-secret) – operator bootstrap for the first admin.
 * Existing profile -> role updated. Otherwise a claimable pending profile is created and linked
 * on that user's first sign-in (email/password or Google).
 */
export async function POST(req: Request) {
  if (!cronSecretOk(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { email: raw, role, name } = schema.parse(await req.json());
  const email = raw.toLowerCase();
  const store = await getStore();
  const now = new Date().toISOString();
  const [existing] = await store.all<Profile>("profiles", [["email", "==", email]]);
  if (existing && !existing.id.startsWith("pending_")) {
    await store.update("profiles", existing.id, { role, customerId: null, updatedAt: now });
    return NextResponse.json({ updated: existing.id, role });
  }
  const id = `pending_${email}`;
  const data = { uid: id, email, name: name ?? email.split("@")[0], role, orgId: DEFAULT_ORG_ID, customerId: null, disabled: false, claimable: true, createdAt: now, updatedAt: now };
  if (existing) await store.update("profiles", id, data);
  else await store.create("profiles", data, id);
  return NextResponse.json({ pending: id, role });
}
