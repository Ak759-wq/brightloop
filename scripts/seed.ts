/**
 * Seed script.
 *   npm run seed                 -> demo org, accounts, catalog, customers, ~9 months of simulated billing history
 *   npm run seed:bulk            -> the same + 3,000 lightweight subscriptions for performance checks
 *   tsx scripts/seed.ts --bulk-only 3000   -> only add bulk subscriptions to an existing seed
 *
 * With FIREBASE_SERVICE_ACCOUNT_JSON set it writes to Firestore (firebase-admin) and creates the
 * three demo users in Firebase Auth. Without it, it writes the local JSON store in .data/.
 * Refuses to run against a non-empty database unless --force is given.
 */
import { config } from "dotenv";
import { FileStore } from "../src/server/store/file";
import type { Store } from "../src/server/store/types";
import { seedDemo, seedBulk } from "../src/server/seed";
import { realToday } from "../src/server/services/core";

config({ path: ".env.local" });
config();

async function main() {
  const args = process.argv.slice(2);
  const bulkIdx = args.findIndex((a) => a === "--bulk" || a === "--bulk-only");
  const bulk = bulkIdx >= 0 ? Number(args[bulkIdx + 1] ?? 3000) : 0;
  const bulkOnly = args.includes("--bulk-only");
  const force = args.includes("--force");
  let store: Store;
  let createAuthUser: ((e: string, p: string, n: string) => Promise<string>) | undefined;
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const { initializeApp, cert } = await import("firebase-admin/app");
    const { getFirestore } = await import("firebase-admin/firestore");
    const { getAuth } = await import("firebase-admin/auth");
    const { FirestoreStore } = await import("../src/server/store/firestore");
    const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    const app = initializeApp({ credential: cert({ projectId: sa.project_id, clientEmail: sa.client_email, privateKey: String(sa.private_key).replace(/\\n/g, "\n") }) });
    const db = getFirestore(app);
    db.settings({ ignoreUndefinedProperties: true });
    store = new FirestoreStore(db);
    const auth = getAuth(app);
    createAuthUser = async (email, password, displayName) => {
      try { return (await auth.getUserByEmail(email)).uid; } catch { return (await auth.createUser({ email, password, displayName })).uid; }
    };
    console.log(`Seeding Firestore project ${sa.project_id}`);
  } else {
    store = new FileStore(process.env.LOCAL_DATA_DIR || ".data");
    console.log("Seeding LOCAL store (.data/brightloop-db.json)");
  }
  const existing = await store.get("organizations", "org_brightloop");
  if (bulkOnly) {
    if (!existing) throw new Error("Run the base seed first");
    await seedBulk(store, bulk, realToday(), console.log);
  } else {
    if (existing && !force) throw new Error("Database already seeded. Use --force to seed anyway (may create duplicates).");
    const t0 = Date.now();
    await seedDemo(store, { bulk, createAuthUser, auth: createAuthUser ? "firebase-admin" : process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? "firebase-claim" : "local", log: console.log });
    console.log(`Done in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  }
  if (store instanceof FileStore) store.flushNow();
  console.log("Demo logins: admin@brightloop.demo / Admin@12345 · staff@brightloop.demo / Staff@12345 · customer@brightloop.demo / Customer@123");
}

main().catch((e) => { console.error(e); process.exit(1); });
