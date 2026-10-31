import { timingSafeEqual } from "node:crypto";

/** Accepts the scheduler secret as `x-cron-secret` or `Authorization: Bearer` (Vercel Cron sends the latter). */
export function cronSecretOk(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const got = req.headers.get("x-cron-secret") ?? (req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "");
  if (!secret || !got) return false;
  const a = Buffer.from(secret), b = Buffer.from(got);
  return a.length === b.length && timingSafeEqual(a, b);
}
