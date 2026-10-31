import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { authMode, signLocalToken, verifyPassword } from "@/server/auth";
import { toResponse, HttpError } from "@/server/http";
import { getStore } from "@/server/store";

const attempts = new Map<string, { n: number; at: number }>();

export async function POST(req: Request) {
  try {
    if (authMode() !== "local") throw new HttpError(400, "Local auth is disabled");
    const { email, password } = (await req.json()) as { email?: string; password?: string };
    const key = (email ?? "").trim().toLowerCase();
    const a = attempts.get(key);
    if (a && a.n >= 8 && Date.now() - a.at < 10 * 60_000) throw new HttpError(429, "Too many attempts. Try again in a few minutes.");
    const store = await getStore();
    const rec = await store.get<{ uid: string; passwordHash: string }>("local_auth", key);
    if (!rec || !password || !verifyPassword(password, rec.passwordHash)) {
      attempts.set(key, { n: (a?.n ?? 0) + 1, at: Date.now() });
      throw new HttpError(401, "Incorrect email or password");
    }
    attempts.delete(key);
    return NextResponse.json({ token: signLocalToken(rec.uid) });
  } catch (e) {
    return toResponse(e);
  }
}
