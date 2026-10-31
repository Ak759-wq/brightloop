"use client";
import { useState } from "react";
import { ScrollText } from "lucide-react";
import { useList } from "@/lib/client/api";
import { PageHeader } from "@/components/shell/AppShell";
import { Badge, EmptyState } from "@/components/ui/primitives";
import { DataTable, Toolbar, useDebounced } from "@/components/ui/table";
import { Modal } from "@/components/ui/overlay";
import { dateTime } from "@/lib/client/format";

interface Log { id: string; actorName: string; actorRole: string; action: string; entity: string; entityId: string; note: string | null; before: unknown; after: unknown; createdAt: string }

export default function AuditPage() {
  const [q, setQ] = useState("");
  const [entity, setEntity] = useState("");
  const dq = useDebounced(q);
  const list = useList<Log>("audit_logs", { q: dq, entity }, 25);
  const [open, setOpen] = useState<Log | null>(null);
  return (
    <div>
      <PageHeader title="Audit Logs" description="Every change by every user, with before/after values. Read-only and admin-only." />
      <DataTable list={list} onRowClick={setOpen}
        toolbar={<Toolbar search={q} onSearch={setQ} placeholder="Search action or user…" filters={[{ key: "entity", label: "Entities", options: ["subscriptions", "invoices", "payments", "customers", "products", "plans", "discounts", "tax_rules", "organizations", "profiles", "credit_wallets"].map((e) => ({ value: e, label: e })) }]} values={{ entity }} onFilter={(_, v) => setEntity(v)} />}
        empty={<EmptyState icon={<ScrollText className="h-6 w-6" />} title="No audit entries" />}
        columns={[
          { key: "w", header: "When", cell: (r) => <span className="whitespace-nowrap text-xs">{dateTime(r.createdAt)}</span> },
          { key: "u", header: "Actor", cell: (r) => <span><b className="font-medium">{r.actorName}</b> <Badge className="ml-1">{r.actorRole}</Badge></span> },
          { key: "a", header: "Action", cell: (r) => <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{r.action}</code> },
          { key: "n", header: "Details", cell: (r) => <span className="line-clamp-1 max-w-md text-xs text-ink-muted">{r.note ?? (r.after ? JSON.stringify(r.after).slice(0, 90) : r.entityId)}</span> },
        ]} />
      <Modal open={!!open} onClose={() => setOpen(null)} title={open?.action ?? ""} description={open ? `${open.actorName} · ${dateTime(open.createdAt)} · ${open.entity}/${open.entityId}` : ""} size="lg">
        {open && <div className="grid gap-4 md:grid-cols-2">
          <div><p className="mb-1 text-xs font-semibold text-ink-muted">Before</p><pre className="max-h-80 overflow-auto rounded-xl bg-slate-50 p-3 text-xs">{JSON.stringify(open.before, null, 2) ?? "—"}</pre></div>
          <div><p className="mb-1 text-xs font-semibold text-ink-muted">After</p><pre className="max-h-80 overflow-auto rounded-xl bg-slate-50 p-3 text-xs">{JSON.stringify(open.after, null, 2) ?? "—"}</pre></div>
          {open.note && <p className="text-sm md:col-span-2">{open.note}</p>}
        </div>}
      </Modal>
    </div>
  );
}
