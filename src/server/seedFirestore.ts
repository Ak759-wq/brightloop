import { DEFAULT_ORG_ID } from "./auth";
import { FileStore } from "./store/file";
import type { Store } from "./store/types";
import { seedDemo, seedBulk } from "./seed";
import { realToday } from "./services/core";

/** Collections that must never be copied into Firestore (local-auth only). */
const SKIP = new Set(["local_auth", "password_resets", "billing_jobs_locks"]);

export interface SeedResult {
  seeded: boolean;
  reason?: string;
  collections?: Record<string, number>;
  bulk?: number;
  authUsers?: string[];
  ms: number;
}

/**
 * Seeds a remote store (Firestore) quickly enough for a serverless function:
 *  1. run the full simulated history against an in-memory/tmp FileStore using the real services (< 1 s),
 *  2. copy every collection to the target store with batched writes (400 docs per batch).
 * Demo users are created in Firebase Auth (or looked up if they exist) and their profiles keyed by the real uid.
 * Idempotent: does nothing when the demo organisation already exists.
 */
export async function seedRemote(target: Store, opts: { bulk?: number; createAuthUser?: (email: string, password: string, name: string) => Promise<string> }): Promise<SeedResult> {
  const t0 = Date.now();
  if (await target.get("organizations", DEFAULT_ORG_ID)) {
    if (opts.bulk && opts.bulk > 0) {
      const already = await target.count("subscriptions", [["orgId", "==", DEFAULT_ORG_ID], ["bulk", "==", true]]);
      if (already > 0) return { seeded: false, reason: `Demo org exists and ${already} bulk subscriptions are already present`, ms: Date.now() - t0 };
      await seedBulk(target, opts.bulk, realToday());
      return { seeded: true, reason: "Demo org existed; added bulk subscriptions only", bulk: opts.bulk, ms: Date.now() - t0 };
    }
    return { seeded: false, reason: "Demo organisation already exists – nothing to do", ms: Date.now() - t0 };
  }
  // lock so two concurrent calls cannot both seed
  try {
    await target.create("seed_locks", { at: new Date().toISOString(), orgId: DEFAULT_ORG_ID }, `seed_${DEFAULT_ORG_ID}`);
  } catch {
    return { seeded: false, reason: "A seed is already in progress (or finished) – delete seed_locks/seed_org_brightloop to retry", ms: Date.now() - t0 };
  }
  const authUsers: string[] = [];
  try {
    const mem = new FileStore(null); // in-memory only
    await seedDemo(mem, {
      bulk: opts.bulk ?? 0,
      auth: opts.createAuthUser ? "firebase-admin" : "firebase-claim",
      createAuthUser: opts.createAuthUser
        ? async (email, password, name) => { const uid = await opts.createAuthUser!(email, password, name); authUsers.push(email); return uid; }
        : undefined,
    });
    const dump = mem.dump();
    const counts: Record<string, number> = {};
    // write the organisation LAST so a partially failed copy is retried as "not seeded"
    const orgDocs = dump.organizations ?? [];
    for (const [col, docs] of Object.entries(dump)) {
      if (SKIP.has(col) || col === "organizations" || !docs.length) continue;
      await target.bulkSet(col, docs);
      counts[col] = docs.length;
    }
    await target.bulkSet("organizations", orgDocs);
    counts.organizations = orgDocs.length;
    return { seeded: true, collections: counts, bulk: opts.bulk ?? 0, authUsers, ms: Date.now() - t0 };
  } catch (e) {
    await target.delete("seed_locks", `seed_${DEFAULT_ORG_ID}`).catch(() => undefined);
    throw e;
  }
}
