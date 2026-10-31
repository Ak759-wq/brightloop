import { NextResponse } from "next/server";
import { cronSecretOk } from "@/server/cron";
import { backendMode, getAdminApp, getStore } from "@/server/store";
import { seedRemote } from "@/server/seedFirestore";
import { toResponse } from "@/server/http";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/admin/seed  (header x-cron-secret: $CRON_SECRET)
 * Seeds the demo organisation, demo accounts (also created in Firebase Auth in firestore mode),
 * catalog, customers and ~9 months of simulated billing history. Idempotent: no-op when the
 * demo org already exists. Optional ?bulk=3000 adds lightweight subscriptions for performance checks
 * (also works later on an already-seeded org, once).
 */
export async function POST(req: Request) {
  try {
    if (!cronSecretOk(req)) return NextResponse.json({ error: "Unauthorized – send x-cron-secret" }, { status: 401 });
    const bulk = Math.min(5000, Math.max(0, Number(new URL(req.url).searchParams.get("bulk") ?? 0) || 0));
    const store = await getStore();
    if (backendMode() !== "firestore") {
      // local store seeds itself on first use; report its state
      return NextResponse.json({ seeded: false, mode: "local", reason: "FIREBASE_SERVICE_ACCOUNT_JSON is not set – the local store seeds itself automatically" });
    }
    const { getAuth } = await import("firebase-admin/auth");
    const auth = getAuth(await getAdminApp());
    const result = await seedRemote(store, {
      bulk,
      createAuthUser: async (email, password, displayName) => {
        try {
          return (await auth.getUserByEmail(email)).uid;
        } catch {
          return (await auth.createUser({ email, password, displayName })).uid;
        }
      },
    });
    return NextResponse.json({ mode: "firestore", ...result });
  } catch (e) {
    return toResponse(e);
  }
}
