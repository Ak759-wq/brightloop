import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { DEFAULT_ORG_ID, getSession } from "@/server/auth";
import { getStore } from "@/server/store";
import { makeCtx, SYSTEM } from "@/server/services/core";
import { runBilling } from "@/server/services/billing";
import { invalidateAnalytics } from "@/server/services/analytics";
import { toResponse } from "@/server/http";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function cronOk(req: Request) {
  const secret = process.env.CRON_SECRET;
  const got = req.headers.get("x-cron-secret") ?? (req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "");
  if (!secret || !got) return false;
  const a = Buffer.from(secret), b = Buffer.from(got);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Recurring billing runner. Called by the scheduler (GitHub Actions cron with x-cron-secret)
 * or by an admin from Settings. Customer page visits never trigger billing.
 */
export async function POST(req: Request) {
  try {
    const store = await getStore();
    if (cronOk(req)) {
      const ctx = await makeCtx(store, DEFAULT_ORG_ID, SYSTEM);
      const r = await runBilling(ctx, "cron");
      invalidateAnalytics();
      return NextResponse.json(r);
    }
    const session = await getSession(req);
    if (!session || session.role !== "admin") return NextResponse.json({ error: "Unauthorized – send x-cron-secret or sign in as admin" }, { status: 401 });
    const ctx = await makeCtx(store, session.orgId, { uid: session.uid, name: session.name, role: "admin" });
    const r = await runBilling(ctx, "manual");
    invalidateAnalytics();
    return NextResponse.json(r);
  } catch (e) {
    return toResponse(e);
  }
}
