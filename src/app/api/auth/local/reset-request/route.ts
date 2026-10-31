import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { createHash, randomBytes } from "node:crypto";
import { toResponse } from "@/server/http";
import { getStore } from "@/server/store";

/** Local-mode password reset. Always answers the same way (no account enumeration). */
export async function POST(req: Request) {
  try {
    const { email } = (await req.json()) as { email?: string };
    const key = (email ?? "").trim().toLowerCase();
    const store = await getStore();
    const rec = await store.get<{ uid: string }>("local_auth", key);
    if (rec) {
      const token = randomBytes(24).toString("base64url");
      await store.create("password_resets", { email: key, hash: createHash("sha256").update(token).digest("hex"), expiresAt: Date.now() + 30 * 60_000, used: false });
      const origin = new URL(req.url).origin;
      // No email provider in local mode: the link is written to the server log only.
      console.info(`[brightloop] Password reset link for ${key}: ${origin}/reset-password?token=${token}&email=${encodeURIComponent(key)}`);
    }
    return NextResponse.json({ ok: true, message: "If that email has an account, a reset link has been sent." });
  } catch (e) {
    return toResponse(e);
  }
}
