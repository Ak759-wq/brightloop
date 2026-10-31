import { FileStore } from "./file";
import type { Store } from "./types";

export * from "./types";

declare global {
  // eslint-disable-next-line no-var
  var __brightloopStore: Store | undefined;
}

export function backendMode(): "firestore" | "local" {
  return process.env.FIREBASE_SERVICE_ACCOUNT_JSON ? "firestore" : "local";
}

export async function getAdminApp() {
  const { getApps, initializeApp, cert } = await import("firebase-admin/app");
  if (getApps().length) return getApps()[0];
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (raw) {
    const sa = JSON.parse(raw) as { project_id: string; client_email: string; private_key: string };
    return initializeApp({ credential: cert({ projectId: sa.project_id, clientEmail: sa.client_email, privateKey: sa.private_key.replace(/\\n/g, "\n") }) });
  }
  // No credentials: only ID-token verification works (it needs just the project id + Google public keys).
  return initializeApp({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID });
}

export async function getStore(): Promise<Store> {
  if (globalThis.__brightloopStore) return globalThis.__brightloopStore;
  let store: Store;
  if (backendMode() === "firestore") {
    const { getFirestore } = await import("firebase-admin/firestore");
    const { FirestoreStore } = await import("./firestore");
    const db = getFirestore(await getAdminApp());
    try { db.settings({ ignoreUndefinedProperties: true }); } catch { /* already set */ }
    store = new FirestoreStore(db);
  } else {
    const dir = process.env.LOCAL_DATA_DIR || (process.env.VERCEL ? "/tmp/brightloop" : ".data");
    const fs = new FileStore(dir);
    if (fs.isEmpty()) {
      const { seedDemo } = await import("../seed");
      await seedDemo(fs, { bulk: 0 });
      fs.flushNow();
    }
    store = fs;
  }
  globalThis.__brightloopStore = store;
  return store;
}
