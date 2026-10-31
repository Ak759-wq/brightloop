import { NextResponse } from "next/server";
import { cronSecretOk } from "@/server/cron";
import { backendMode, getAdminApp, getStore } from "@/server/store";
import { parseListQuery } from "@/server/resources";
import type { Profile } from "@/lib/types";
import type { Session } from "@/server/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/admin/diagnose?email=...&cols=subscriptions,invoices  (header x-cron-secret)
 * Operator diagnostics: runs the same list queries a signed-in user would run and returns the
 * raw error (e.g. a missing Firestore index), plus composite-index build states. Read-only.
 */
export async function GET(req: Request) {
  if (!cronSecretOk(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const store = await getStore();
  const out: Record<string, unknown> = { mode: backendMode() };
  const email = url.searchParams.get("email");
  if (email) {
    const found = await store.all<Profile>("profiles", [["email", "==", email.toLowerCase()]]);
    const p = found[0];
    out.profile = p ? { uid: p.uid, role: p.role, orgId: p.orgId, customerId: p.customerId ?? null } : null;
    if (p) {
      const session: Session = { uid: p.uid, email: p.email, name: p.name, role: p.role, orgId: p.orgId, customerId: p.customerId ?? null };
      const results: Record<string, unknown> = {};
      for (const col of (url.searchParams.get("cols") ?? "subscriptions,invoices,payments,customers").split(",")) {
        try {
          const q = parseListQuery(session, col, new URL(`http://x/?${url.searchParams.get("q") ?? ""}`));
          const r = await store.list(col, q);
          results[col] = { ok: true, count: r.items.length, query: q };
        } catch (e) {
          results[col] = { ok: false, error: String((e as Error)?.message ?? e).slice(0, 600) };
        }
      }
      out.lists = results;
    }
  }
  if (backendMode() === "firestore" && url.searchParams.get("indexes") !== "0") {
    const app = await getAdminApp();
    const projectId = app.options.projectId ?? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON!).project_id;
    const token = (await app.options.credential!.getAccessToken()).access_token;
    const r = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/collectionGroups/-/indexes?pageSize=200`, { headers: { Authorization: `Bearer ${token}` } });
    const j = (await r.json()) as { indexes?: { state: string }[] };
    const states: Record<string, number> = {};
    (j.indexes ?? []).forEach((i) => (states[i.state] = (states[i.state] ?? 0) + 1));
    out.indexStates = r.ok ? states : j;
  }
  return NextResponse.json(out);
}
