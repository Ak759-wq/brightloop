"use client";
import { useEffect, useState } from "react";
import { Building2, Clock, Plus, ShieldCheck, Users } from "lucide-react";
import { api, useApi, useList } from "@/lib/client/api";
import { useAuth } from "@/lib/client/auth";
import type { Organization } from "@/lib/types";
import { PageHeader } from "@/components/shell/AppShell";
import { Badge, Button, Callout, Card, CardHeader, EmptyState, Field, Input, Select, Switch, Tabs } from "@/components/ui/primitives";
import { DataTable } from "@/components/ui/table";
import { Modal } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { STATE_OPTIONS, date } from "@/lib/client/format";
import { passwordIssues } from "@/lib/schemas";

interface Profile { id: string; name: string; email: string; role: string; createdAt: string; claimable?: boolean }

export default function SettingsPage() {
  const { refresh, modes } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState("org");
  const org = useApi<Organization>("/api/settings");
  const discounts = useApi<{ items: { id: string; name: string }[] }>("/api/r/discounts?active=true&limit=100");
  const [f, setF] = useState<Organization | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (org.data) setF(org.data); }, [org.data]);
  const users = useList<Profile>("profiles", { role: tab === "team" ? undefined : "staff" });
  const [invite, setInvite] = useState(false);
  const [s, setS] = useState({ name: "", email: "", password: "" });
  async function save(patch: Partial<Organization>, msg = "Settings saved") {
    setBusy(true);
    try { const r = await api<Organization>("/api/settings", { method: "PATCH", body: patch }); org.setData(r); toast.success(msg); await refresh(); }
    catch (e) { toast.error("Could not save", (e as Error).message); } finally { setBusy(false); }
  }
  if (!f) return null;
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Company, tax identity, billing policies, demo clock and team." />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: "org", label: "Company & tax" }, { value: "billing", label: "Billing policies" }, { value: "demo", label: "Demo clock" }, { value: "team", label: "Team" }]} />
      {tab === "org" && (
        <Card className="p-6">
          <CardHeader className="px-0 pt-0" title="Company & GST identity" icon={<Building2 className="h-4 w-4" />} subtitle="The seller state decides CGST+SGST vs IGST on every invoice" />
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Display name" id="s-n"><Input id="s-n" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <Field label="Legal name" id="s-l"><Input id="s-l" value={f.legalName} onChange={(e) => setF({ ...f, legalName: e.target.value })} /></Field>
            <Field label="Seller state" id="s-s"><Select id="s-s" value={f.sellerState} onChange={(e) => setF({ ...f, sellerState: e.target.value })} options={STATE_OPTIONS} /></Field>
            <Field label="GSTIN" id="s-g"><Input id="s-g" value={f.sellerGstin ?? ""} onChange={(e) => setF({ ...f, sellerGstin: e.target.value.toUpperCase() })} /></Field>
            <div className="sm:col-span-2"><Field label="Registered address" id="s-a"><Input id="s-a" value={f.address ?? ""} onChange={(e) => setF({ ...f, address: e.target.value })} /></Field></div>
          </div>
          <div className="mt-5 flex justify-end"><Button loading={busy} onClick={() => save({ name: f.name, legalName: f.legalName, sellerState: f.sellerState, sellerGstin: f.sellerGstin, address: f.address })}>Save</Button></div>
        </Card>
      )}
      {tab === "billing" && (
        <Card className="p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Default payment terms (days)" id="b-t"><Input id="b-t" type="number" min={0} value={f.paymentTermsDays} onChange={(e) => setF({ ...f, paymentTermsDays: Number(e.target.value) })} /></Field>
            <Field label="Dunning retry schedule (days after failure)" id="b-d" hint="Comma separated"><Input id="b-d" value={f.dunningRetryDays.join(", ")} onChange={(e) => setF({ ...f, dunningRetryDays: e.target.value.split(",").map((x) => Number(x.trim())).filter((n) => n > 0) })} /></Field>
            <Field label="Low credit alert (% of last top-up)" id="b-l"><Input id="b-l" type="number" min={1} max={90} value={f.lowBalancePct} onChange={(e) => setF({ ...f, lowBalancePct: Number(e.target.value) })} /></Field>
            <Field label="When credits run out" id="b-o"><Select id="b-o" value={f.overagePolicy} onChange={(e) => setF({ ...f, overagePolicy: e.target.value as "block" | "overage" })} options={[{ value: "block", label: "Block usage" }, { value: "overage", label: "Allow & bill overage" }]} /></Field>
            <Field label="Overage price per credit (₹)" id="b-p"><Input id="b-p" type="number" step="0.01" value={f.overageUnitPrice / 100} onChange={(e) => setF({ ...f, overageUnitPrice: Math.round(Number(e.target.value) * 100) })} /></Field>
            <Field label="Retention offer (shown on cancel)" id="b-r"><Select id="b-r" value={f.retentionDiscountId ?? ""} onChange={(e) => setF({ ...f, retentionDiscountId: e.target.value || null })} options={(discounts.data?.items ?? []).map((d) => ({ value: d.id, label: d.name }))} placeholder="No offer" /></Field>
            <div className="sm:col-span-2"><Switch checked={f.autoConfirmInvoices} onChange={(v) => setF({ ...f, autoConfirmInvoices: v })} label="Auto-confirm invoices generated by the billing run" description="Off = invoices are created as drafts for review" /></div>
          </div>
          <div className="mt-5 flex justify-end"><Button loading={busy} onClick={() => save({ paymentTermsDays: f.paymentTermsDays, dunningRetryDays: f.dunningRetryDays, lowBalancePct: f.lowBalancePct, overagePolicy: f.overagePolicy, overageUnitPrice: f.overageUnitPrice, retentionDiscountId: f.retentionDiscountId, autoConfirmInvoices: f.autoConfirmInvoices })}>Save policies</Button></div>
        </Card>
      )}
      {tab === "demo" && (
        <Card className="p-6">
          <CardHeader className="px-0 pt-0" title="Demo / simulated time" icon={<Clock className="h-4 w-4" />} subtitle="Only for organisations flagged as demo" />
          {f.demo ? (<>
            <Callout tone="blue" title="How it works">Setting a simulated date changes the <b>business date</b> used by billing (due dates, periods, overdue checks) so you can fast-forward a month in a demo. Real record timestamps (created/updated) always use the real clock, and the UI shows a “Demo clock” badge while it is set.</Callout>
            <div className="mt-5 flex flex-wrap items-end gap-3">
              <Field label="Simulated business date" id="d-d"><Input id="d-d" type="date" value={f.demoDate ?? ""} onChange={(e) => setF({ ...f, demoDate: e.target.value || null })} /></Field>
              <Button loading={busy} onClick={() => save({ demoDate: f.demoDate ?? null }, f.demoDate ? `Demo clock set to ${f.demoDate}` : "Demo clock cleared")}>Apply</Button>
              <Button variant="secondary" onClick={() => { setF({ ...f, demoDate: null }); void save({ demoDate: null }, "Demo clock cleared – using real date"); }}>Use real date</Button>
            </div>
            <p className="mt-3 text-xs text-ink-muted">Tip: set the date forward, then run billing from Automations to watch invoices and overdue reminders appear.</p>
          </>) : <Callout tone="amber">This organisation is not a demo organisation, so the demo clock is disabled.</Callout>}
        </Card>
      )}
      {tab === "team" && (
        <div className="space-y-4">
          <Callout icon={<ShieldCheck className="h-4 w-4" />}>Only admins can add staff. Staff can manage customers, quotations, subscriptions, invoices and payments, but not products, taxes, discounts, settings, audit logs or cost prices.</Callout>
          <DataTable list={users} empty={<EmptyState icon={<Users className="h-6 w-6" />} title="No users" />}
            toolbar={<div className="flex justify-end px-5 py-4"><Button icon={<Plus className="h-4 w-4" />} onClick={() => setInvite(true)}>Add staff member</Button></div>}
            columns={[
              { key: "n", header: "Name", cell: (r) => <b className="font-medium">{r.name}</b> }, { key: "e", header: "Email", cell: (r) => r.email },
              { key: "r", header: "Role", cell: (r) => <Badge tone={r.role === "admin" ? "violet" : r.role === "staff" ? "blue" : "slate"}>{r.role}</Badge> },
              { key: "s", header: "Status", cell: (r) => (r.claimable ? <Badge tone="amber">Invited</Badge> : <Badge tone="green">Active</Badge>) }, { key: "c", header: "Added", cell: (r) => date(r.createdAt) },
            ]} />
        </div>
      )}
      <Modal open={invite} onClose={() => setInvite(false)} title="Add staff member" description={modes?.auth === "firebase" && modes.backend !== "firestore" ? "Firebase admin credentials are not configured: an invite is created and they register with this email to receive the staff role." : "Creates the login immediately."} size="sm"
        footer={<><Button variant="secondary" onClick={() => setInvite(false)}>Cancel</Button><Button loading={busy} onClick={async () => {
          setBusy(true);
          try { const r = await api<{ message: string }>("/api/admin/staff", { body: { name: s.name, email: s.email, password: s.password || undefined } }); toast.success(r.message); setInvite(false); setS({ name: "", email: "", password: "" }); users.reload(); }
          catch (e) { toast.error("Could not add staff", (e as Error).message); } finally { setBusy(false); }
        }}>Add</Button></>}>
        <div className="space-y-4">
          <Field label="Name" id="st-n"><Input id="st-n" value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} /></Field>
          <Field label="Email" id="st-e"><Input id="st-e" type="email" value={s.email} onChange={(e) => setS({ ...s, email: e.target.value })} /></Field>
          {!(modes?.auth === "firebase" && modes.backend !== "firestore") && <Field label="Initial password" id="st-p" error={s.password ? passwordIssues(s.password)[0] : undefined}><Input id="st-p" type="password" value={s.password} onChange={(e) => setS({ ...s, password: e.target.value })} /></Field>}
        </div>
      </Modal>
    </div>
  );
}
