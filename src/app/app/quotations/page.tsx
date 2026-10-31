"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FileSignature, Plus, Wand2 } from "lucide-react";
import { api, useApi, useList } from "@/lib/client/api";
import { useAuth } from "@/lib/client/auth";
import { PageHeader } from "@/components/shell/AppShell";
import { Badge, Button, Card, CardHeader, EmptyState, Field, Select, StatusPill, Tabs } from "@/components/ui/primitives";
import { DataTable, Toolbar, useDebounced } from "@/components/ui/table";
import { Modal } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { LineItemsEditor, type LineInput } from "@/components/billing/lines";
import { date, money } from "@/lib/client/format";
import { ResourceFormModal } from "@/components/crud";
import type { Sub } from "@/components/billing/SubscriptionView";

interface Template { id: string; name: string; planId: string; validityDays: number; items: LineInput[]; notes: string; paymentTermsDays?: number }

export default function QuotationsPage() {
  const router = useRouter();
  const toast = useToast();
  const { user, org } = useAuth();
  const admin = user?.role === "admin";
  const [tab, setTab] = useState("quotes");
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const list = useList<Sub>("subscriptions", { q: dq, status: "draft,quotation" });
  const templates = useApi<{ items: Template[] }>("/api/r/quotation_templates?limit=50");
  const plans = useApi<{ items: { id: string; name: string; productId: string; minQuantity: number }[] }>("/api/r/plans?active=true&limit=100");
  const products = useApi<{ items: { id: string; name: string }[] }>("/api/r/products?limit=100");
  const customers = useApi<{ items: { id: string; name: string }[] }>("/api/r/customers?status=active&limit=100&orderBy=name&dir=asc");
  const [useTpl, setUseTpl] = useState<Template | null>(null);
  const [cust, setCust] = useState("");
  const [busy, setBusy] = useState(false);
  const [tplForm, setTplForm] = useState<Template | "new" | null>(null);
  const [tplLines, setTplLines] = useState<LineInput[]>([]);
  const planName = (id: string) => plans.data?.items.find((p) => p.id === id)?.name ?? id;
  return (
    <div>
      <PageHeader title="Quotations" description="Start offers from templates with the right plan and lines; each stays valid for a set number of days and converts into a subscription." actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => router.push("/app/subscriptions/new")}>Blank quotation</Button>} />
      <div className="mb-4"><Tabs value={tab} onChange={setTab} tabs={[{ value: "quotes", label: "Open quotations" }, { value: "templates", label: "Templates", count: templates.data?.items.length }]} /></div>
      {tab === "quotes" ? (
        <DataTable list={list} onRowClick={(r) => router.push(`/app/subscriptions/${r.id}`)}
          toolbar={<Toolbar search={q} onSearch={setQ} placeholder="Search quotations…" />}
          empty={<EmptyState icon={<FileSignature className="h-6 w-6" />} title="No open quotations" description="Use a template to prepare an offer in seconds." action={<Button size="sm" onClick={() => setTab("templates")}>Browse templates</Button>} />}
          columns={[
            { key: "n", header: "Number", cell: (r) => <span className="font-mono text-xs">{r.number}</span> },
            { key: "c", header: "Customer", cell: (r) => <b className="font-medium">{r.customerName}</b> },
            { key: "p", header: "Plan", hideOnMobile: true, cell: (r) => r.planName },
            { key: "a", header: "Amount", align: "right", cell: (r) => money(r.recurringAmount) },
            { key: "v", header: "Valid until", cell: (r) => r.quoteValidUntil ? <span className={org && r.quoteValidUntil < org.today ? "text-rose-600" : ""}>{date(r.quoteValidUntil)}{org && r.quoteValidUntil < org.today && " (expired)"}</span> : "—" },
            { key: "s", header: "Status", cell: (r) => <StatusPill status={r.status} /> },
          ]} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(templates.data?.items ?? []).map((t) => (
            <Card key={t.id} className="flex flex-col p-5">
              <div className="flex items-start justify-between"><div><p className="font-semibold">{t.name}</p><p className="text-xs text-ink-muted">{planName(t.planId)}</p></div><Badge tone="violet">Valid {t.validityDays} days</Badge></div>
              <ul className="mt-3 flex-1 space-y-1 text-sm text-slate-600">{t.items.map((i, k) => <li key={k}>• {i.quantity} × {products.data?.items.find((p) => p.id === i.productId)?.name ?? "Product"}{i.variantIds.length ? " (variant)" : ""}{i.addonIds.length ? " + add-ons" : ""}</li>)}</ul>
              <div className="mt-4 flex gap-2">
                <Button size="sm" icon={<Wand2 className="h-3.5 w-3.5" />} onClick={() => { setUseTpl(t); setCust(""); }}>Use template</Button>
                {admin && <Button size="sm" variant="ghost" onClick={() => { setTplForm(t); setTplLines(t.items); }}>Edit</Button>}
              </div>
            </Card>
          ))}
          {admin && <button onClick={() => { setTplForm("new"); setTplLines([]); }} className="flex min-h-[180px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 text-sm font-medium text-slate-500 hover:border-brand-300 hover:text-brand-600"><Plus className="mb-1 h-5 w-5" />New template</button>}
          {templates.data && !templates.data.items.length && !admin && <Card><EmptyState title="No templates" /></Card>}
        </div>
      )}
      <Modal open={!!useTpl} onClose={() => setUseTpl(null)} title={`New quotation from “${useTpl?.name}”`} description={`Valid for ${useTpl?.validityDays} days from today.`} size="sm"
        footer={<><Button variant="secondary" onClick={() => setUseTpl(null)}>Cancel</Button><Button loading={busy} disabled={!cust} onClick={async () => {
          setBusy(true);
          try { const s = await api<{ id: string; number: string }>("/api/subscriptions/from-template", { body: { templateId: useTpl!.id, customerId: cust } }); toast.success(`Quotation ${s.number} created`); router.push(`/app/subscriptions/${s.id}`); }
          catch (e) { toast.error("Failed", (e as Error).message); } finally { setBusy(false); }
        }}>Create quotation</Button></>}>
        <Field label="Customer" id="tcust"><Select id="tcust" value={cust} onChange={(e) => setCust(e.target.value)} options={(customers.data?.items ?? []).map((c) => ({ value: c.id, label: c.name }))} placeholder="Choose customer" /></Field>
      </Modal>
      <ResourceFormModal open={!!tplForm} onClose={() => setTplForm(null)} collection="quotation_templates" title={tplForm === "new" ? "New quotation template" : "Edit template"} doc={tplForm && tplForm !== "new" ? (tplForm as never) : null}
        fields={[
          { name: "name", label: "Template name", type: "text" },
          { name: "planId", label: "Plan", type: "select", options: (plans.data?.items ?? []).map((p) => ({ value: p.id, label: p.name })) },
          { name: "validityDays", label: "Valid for (days)", type: "number" },
          { name: "paymentTermsDays", label: "Payment terms (days)", type: "number", nullable: true },
          { name: "notes", label: "Notes", type: "textarea" },
        ]}
        defaults={{ validityDays: 30 }}
        extra={(values, set) => {
          const p = plans.data?.items.find((x) => x.id === values.planId);
          const ls = tplLines.length ? tplLines : p ? [{ productId: p.productId, variantIds: [], addonIds: [], quantity: p.minQuantity }] : [];
          if (JSON.stringify((values.__extra as { items?: unknown })?.items) !== JSON.stringify(ls)) setTimeout(() => set("__extra", { items: ls }), 0);
          return p ? <div className="mt-5"><CardHeader className="px-0 pt-0" title="Template lines" /><div className="mt-2"><LineItemsEditor lines={ls} onChange={setTplLines} lockFirstProduct minQuantity={p.minQuantity} /></div></div> : null;
        }}
        onSaved={() => templates.reload()} />
    </div>
  );
}
