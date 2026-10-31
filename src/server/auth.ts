import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { Profile, Role } from "@/lib/types";
import { getAdminApp, getStore } from "./store";

export const DEFAULT_ORG_ID = "org_brightloop";

export interface Session {
  uid: string;
  email: string;
  name: string;
  role: Role;
  orgId: string;
  customerId: string | null;
}

export function authMode(): "firebase" | "local" {
  return process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? "firebase" : "local";
}

function secret() {
  const s = process.env.LOCAL_AUTH_SECRET;
  if (!s && process.env.NODE_ENV === "production" && authMode() === "local") {
    // still works, but warn loudly – local mode is for demos
    console.warn("[brightloop] LOCAL_AUTH_SECRET not set; using an insecure development secret");
  }
  return s || "dev-only-insecure-secret-change-me";
}

const b64 = (s: string) => Buffer.from(s).toString("base64url");

export function signLocalToken(uid: string, ttlSeconds = 60 * 60 * 24 * 7): string {
  const payload = b64(JSON.stringify({ uid, exp: Math.floor(Date.now() / 1000) + ttlSeconds }));
  const sig = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyLocalToken(token: string): string | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const { uid, exp } = JSON.parse(Buffer.from(payload, "base64url").toString()) as { uid: string; exp: number };
  if (exp < Date.now() / 1000) return null;
  return uid;
}

export function hashPassword(pw: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(pw, salt, 32).toString("hex")}`;
}

export function verifyPassword(pw: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  const test = scryptSync(pw, salt, 32);
  const h = Buffer.from(hash, "hex");
  return h.length === test.length && timingSafeEqual(h, test);
}

export interface VerifiedIdentity {
  uid: string;
  email: string;
}

/** Verify the bearer token (Firebase ID token or local session token). */
export async function verifyBearer(req: Request): Promise<VerifiedIdentity | null> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  if (authMode() === "firebase") {
    try {
      const { getAuth } = await import("firebase-admin/auth");
      const decoded = await getAuth(await getAdminApp()).verifyIdToken(token);
      return { uid: decoded.uid, email: (decoded.email ?? "").toLowerCase() };
    } catch {
      return null;
    }
  }
  const uid = verifyLocalToken(token);
  if (!uid) return null;
  const store = await getStore();
  const p = await store.get<Profile>("profiles", uid);
  return p ? { uid, email: p.email } : null;
}

export async function getSession(req: Request): Promise<Session | null> {
  const id = await verifyBearer(req);
  if (!id) return null;
  const store = await getStore();
  const p = await store.get<Profile>("profiles", id.uid);
  if (!p || p.disabled) return null;
  return { uid: p.uid, email: p.email, name: p.name, role: p.role, orgId: p.orgId, customerId: p.customerId ?? null };
}
