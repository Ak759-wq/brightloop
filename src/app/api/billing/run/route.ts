import { NextResponse } from "next/server";
import { DEFAULT_ORG_ID, getSession } from "@/server/auth";
import { cronSecretOk } from "@/server/cron";
import { getStore } from "@/server/store";
import { makeCtx, SYSTEM } from "@/server/services/core";
import { runBilling } from "@/server/services/billing";
import { invalidateAnalytics } from "@/server/services/analytics";
import { toResponse } from "@/server/http";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function runAsScheduler() {
  const store = await getStore();
  const ctx = await makeCtx(store, DEFAULT_ORG_ID, SYSTEM);
  const r = await runBilling(ctx, "cron");
  invalidateAnalytics();
  return NextResponse.json(r);
}

/**
 * Recurring billing runner. Triggered by a scheduler – Vercel Cron (GET + Authorization: Bearer CRON_SECRET)
 * or GitHub Actions (POST + x-cron-secret) – or by an admin from the UI (POST with a session).
 * Customer page visits never trigger billing.
 */
export async function GET(req: Request) {
  try {
    if (!cronSecretOk(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return await runAsScheduler();
  } catch (e) {
    return toResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    if (cronSecretOk(req)) return await runAsScheduler();
    const session = await getSession(req);
    if (!session || session.role !== "admin") return NextResponse.json({ error: "Unauthorized – send x-cron-secret or sign in as admin" }, { status: 401 });
    const store = await getStore();
    const ctx = await makeCtx(store, session.orgId, { uid: session.uid, name: session.name, role: "admin" });
    const r = await runBilling(ctx, "manual");
    invalidateAnalytics();
    return NextResponse.json(r);
  } catch (e) {
    return toResponse(e);
  }
}
