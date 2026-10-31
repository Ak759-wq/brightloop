import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { createHash, randomBytes } from "node:crypto";
import { authDiagnostic, authMode } from "@/server/auth";
import { HttpError, toResponse } from "@/server/http";
import { getStore } from "@/server/store";

/** Local-mode password reset. Always answers the same way (no account enumeration). */
export async function POST(req: Request) {
  try {
    if (authMode() !== "local") throw new HttpError(400, "Local auth is disabled; use Firebase password reset");
    if (authDiagnostic()) throw new HttpError(503, authDiagnostic()!);
    const { email } = (await req.json()) as { email?: string };
    const key = (email ?? "").trim().toLowerCase();
    const store = await getStore();
    const rec = await store.get<{ uid: string }>("local_auth", key);
    let resetLink: string | undefined;
    if (rec) {
      const token = randomBytes(24).toString("base64url");
      await store.create("password_resets", { email: key, hash: createHash("sha256").update(token).digest("hex"), expiresAt: Date.now() + 30 * 60_000, used: false });
      if (process.env.NODE_ENV !== "production") {
        const origin = new URL(req.url).origin;
        resetLink = `${origin}/reset-password?token=${token}&email=${encodeURIComponent(key)}`;
      }
    }
    return NextResponse.json({
      ok: true,
      message: resetLink ? "Local development reset link generated." : "If that email has an account, a reset link has been sent.",
      ...(resetLink ? { resetLink } : {}),
    });
  } catch (e) {
    return toResponse(e);
  }
}
