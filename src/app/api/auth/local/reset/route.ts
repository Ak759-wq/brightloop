import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { createHash } from "node:crypto";
import { passwordSchema } from "@/lib/schemas";
import { authDiagnostic, authMode, hashPassword } from "@/server/auth";
import { toResponse, HttpError } from "@/server/http";
import { getStore } from "@/server/store";

export async function POST(req: Request) {
  try {
    if (authMode() !== "local") throw new HttpError(400, "Local auth is disabled; use Firebase password reset");
    if (authDiagnostic()) throw new HttpError(503, authDiagnostic()!);
    const { email, token, password } = (await req.json()) as { email: string; token: string; password: string };
    passwordSchema.parse(password);
    const store = await getStore();
    const hash = createHash("sha256").update(token ?? "").digest("hex");
    const rows = await store.all<{ id: string; email: string; expiresAt: number; used: boolean }>("password_resets", [["hash", "==", hash]]);
    const r = rows[0];
    if (!r || r.used || r.expiresAt < Date.now() || r.email !== email?.toLowerCase()) throw new HttpError(400, "This reset link is invalid or has expired");
    await store.update("local_auth", r.email, { passwordHash: hashPassword(password) });
    await store.update("password_resets", r.id, { used: true });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return toResponse(e);
  }
}
