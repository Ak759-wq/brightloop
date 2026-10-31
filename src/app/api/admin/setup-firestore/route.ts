import { NextResponse } from "next/server";
import { cronSecretOk } from "@/server/cron";
import { backendMode, getAdminApp } from "@/server/store";
import { FIRESTORE_INDEXES, FIRESTORE_RULES } from "@/server/generated/firestoreConfig";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type IndexField = { fieldPath: string; order?: string; arrayConfig?: string };
type IndexDef = { collectionGroup: string; queryScope: string; fields: readonly IndexField[] };

/**
 * POST /api/admin/setup-firestore  (header x-cron-secret: $CRON_SECRET)
 * Deploys firestore.rules and the composite indexes from firestore.indexes.json using the
 * service account's own OAuth token (Firebase Rules API + Firestore Admin API).
 * Safe to re-run: existing indexes answer 409 and are counted as "exists".
 */
export async function POST(req: Request) {
  if (!cronSecretOk(req)) return NextResponse.json({ error: "Unauthorized – send x-cron-secret" }, { status: 401 });
  if (backendMode() !== "firestore") return NextResponse.json({ error: "FIREBASE_SERVICE_ACCOUNT_JSON is not set" }, { status: 400 });

  const app = await getAdminApp();
  const projectId = app.options.projectId ?? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON!).project_id;
  const token = (await app.options.credential!.getAccessToken()).access_token;
  const H = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const only = new URL(req.url).searchParams.get("only"); // "rules" | "indexes" | null

  const out: Record<string, unknown> = { projectId };

  if (only !== "indexes") {
    const rs = await fetch(`https://firebaserules.googleapis.com/v1/projects/${projectId}/rulesets`, {
      method: "POST", headers: H,
      body: JSON.stringify({ source: { files: [{ name: "firestore.rules", content: FIRESTORE_RULES }] } }),
    });
    const ruleset = await rs.json();
    if (!rs.ok) return NextResponse.json({ step: "ruleset", status: rs.status, error: ruleset }, { status: 502 });
    const relName = `projects/${projectId}/releases/cloud.firestore`;
    let rel = await fetch(`https://firebaserules.googleapis.com/v1/${relName}`, {
      method: "PATCH", headers: H, body: JSON.stringify({ release: { name: relName, rulesetName: ruleset.name } }),
    });
    if (rel.status === 404) {
      rel = await fetch(`https://firebaserules.googleapis.com/v1/projects/${projectId}/releases`, {
        method: "POST", headers: H, body: JSON.stringify({ name: relName, rulesetName: ruleset.name }),
      });
    }
    const relBody = await rel.json();
    if (!rel.ok) return NextResponse.json({ step: "release", status: rel.status, error: relBody }, { status: 502 });
    out.rules = { ruleset: ruleset.name, released: true };
  }

  if (only !== "rules") {
    let created = 0, exists = 0;
    const failed: unknown[] = [];
    for (const idx of FIRESTORE_INDEXES.indexes as readonly IndexDef[]) {
      const r = await fetch(
        `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/collectionGroups/${idx.collectionGroup}/indexes`,
        { method: "POST", headers: H, body: JSON.stringify({ queryScope: idx.queryScope, fields: idx.fields }) },
      );
      if (r.ok) created++;
      else if (r.status === 409) exists++;
      else failed.push({ collectionGroup: idx.collectionGroup, fields: idx.fields.map((f) => f.fieldPath), status: r.status, error: (await r.json().catch(() => ({})))?.error?.message });
    }
    out.indexes = { total: FIRESTORE_INDEXES.indexes.length, created, exists, failed };
  }
  return NextResponse.json(out);
}
