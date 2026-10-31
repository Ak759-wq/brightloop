"use client";
import { useState } from "react";
import { Coins, Gauge, Plus, Zap } from "lucide-react";
import { api, useApi, useList } from "@/lib/client/api";
import { useAuth } from "@/lib/client/auth";
import { PageHeader } from "./shell/AppShell";
import { Badge, Button, Callout, Card, CardHeader, EmptyState, Field, Input, Select, Tabs } from "./ui/primitives";
import { DataTable } from "./ui/table";
import { Modal } from "./ui/overlay";
import { useToast } from "./ui/toast";
import { dateTime, date } from "@/lib/client/format";
import { cn } from "@/lib/client/cn";

interface Wallet { id: string; customerId: string; balance: number; lastTopUp: number; lowBalancePct: number; policy: string }
interface UsageEvent { id: string; subscriptionNumber: string; customerId: string; metric: string; quantity: number; date: string; overageUnits: number; createdAt: string }
interface Tx { id: string; customerId: string; type: string; amount: number; balanceAfter: number; reference: string; createdAt: string }

export function UsagePanel({ portal = false }: { portal?: boolean }) {
  const { user } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState(portal ? "events" : "wallets");
  const wallets = useList<Wallet>("credit_wallets", {});
  const events = useList<UsageEvent>("usage_events", {});
  const ledger = useList<Tx>("credit_transactions", {});
  const customers = useApi<{ items: { id: string; name: string }[] }>(portal ? null : "/api/r/customers?limit=100&orderBy=name&dir=asc");
  const subs = useApi<{ items: { id: string; number: string; planName: string; customerName: string }[] }>("/api/r/subscriptions?status=active&limit=100");
  const myWallet = portal ? wallets.items[0] : null;
  const name = (id: string) => customers.data?.items.find((c) => c.id === id)?.name ?? id;
  const [useOpen, setUseOpen] = useState(false);
  const [topOpen, setTopOpen] = useState(false);
  const [u, setU] = useState({ subscriptionId: "", metric: "api_calls", quantity: "100" });
  const [t, setT] = useState({ customerId: "", credits: "500" });
  const [busy, setBusy] = useState(false);
  const reload = () => { wallets.reload(); events.reload(); ledger.reload(); };
  const threshold = myWallet ? Math.floor((myWallet.lastTopUp * myWallet.lowBalancePct) / 100) : 0;
  return (
    <div className="space-y-6">
      <PageHeader title="Usage & Credits" description={portal ? "Your prepaid credit balance and metered usage." : "Metered usage events and prepaid credit wallets with an append-only ledger. Low-balance alert at 20% of the last top-up."}
        actions={<><Button variant="secondary" icon={<Zap className="h-4 w-4" />} onClick={() => setUseOpen(true)}>{portal ? "Simulate usage" : "Record usage"}</Button><Button icon={<Plus className="h-4 w-4" />} onClick={() => setTopOpen(true)}>{portal ? "Buy credits" : "Grant credits"}</Button></>} />
      {portal && myWallet && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-5 md:col-span-2">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700"><Coins className="h-4 w-4" />Credit balance</div>
            <p className={cn("mt-3 text-4xl font-semibold tabular-nums", myWallet.balance <= threshold && "text-rose-600")}>{myWallet.balance.toLocaleString("en-IN")}<span className="ml-1 text-base font-normal text-ink-muted">credits</span></p>
            <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-100"><div className={cn("h-full rounded-full", myWallet.balance <= threshold ? "bg-rose-500" : "bg-gradient-to-r from-brand-600 to-cyan-400")} style={{ width: `${Math.max(2, Math.min(100, (myWallet.balance / Math.max(1, myWallet.lastTopUp)) * 100))}%` }} /></div>
            <p className="mt-2 text-xs text-ink-muted">Low-balance alert at {threshold} credits ({myWallet.lowBalancePct}% of your last top-up of {myWallet.lastTopUp}). When credits run out: <b>{myWallet.policy === "block" ? "usage is blocked" : "usage continues and overage is billed on your next invoice"}</b>.</p>
          </Card>
          <Card className="p-5"><div className="flex items-center gap-2 text-sm font-medium text-slate-700"><Gauge className="h-4 w-4" />This period</div><p className="mt-3 text-3xl font-semibold tabular-nums">{events.items.reduce((s, e) => s + e.quantity, 0).toLocaleString("en-IN")}</p><p className="text-xs text-ink-muted">units on recent events</p></Card>
        </div>
      )}
      {portal && myWallet && myWallet.balance <= threshold && <Callout tone="amber" title="Credits running low">Top up to avoid interruption.</Callout>}
      <Tabs value={tab} onChange={setTab} tabs={[...(portal ? [] : [{ value: "wallets", label: "Wallets" }]), { value: "events", label: "Usage events" }, { value: "ledger", label: "Credit ledger" }]} />
      {tab === "wallets" && <DataTable list={wallets} empty={<EmptyState title="No wallets yet" />} columns={[
        { key: "c", header: "Customer", cell: (r) => <b className="font-medium">{name(r.customerId)}</b> },
        { key: "b", header: "Balance", align: "right", cell: (r) => <span className={r.balance <= Math.floor((r.lastTopUp * r.lowBalancePct) / 100) ? "font-semibold text-rose-600" : ""}>{r.balance.toLocaleString("en-IN")}</span> },
        { key: "l", header: "Last top-up", align: "right", cell: (r) => r.lastTopUp },
        { key: "p", header: "Policy", cell: (r) => <Badge tone={r.policy === "block" ? "amber" : "blue"}>{r.policy}</Badge> },
        { key: "s", header: "Status", cell: (r) => (r.balance <= Math.floor((r.lastTopUp * r.lowBalancePct) / 100) ? <Badge tone="red">Low</Badge> : <Badge tone="green">OK</Badge>) },
      ]} />}
      {tab === "events" && <DataTable list={events} empty={<EmptyState title="No usage recorded" />} columns={[
        { key: "s", header: "Subscription", cell: (r) => <span className="font-mono text-xs">{r.subscriptionNumber}</span> },
        ...(portal ? [] : [{ key: "c", header: "Customer", cell: (r: UsageEvent) => name(r.customerId) }]),
        { key: "m", header: "Metric", cell: (r) => r.metric },
        { key: "q", header: "Quantity", align: "right", cell: (r) => <span>{r.quantity}{r.overageUnits > 0 && <Badge tone="amber" className="ml-2">{r.overageUnits} overage</Badge>}</span> },
        { key: "d", header: "When", cell: (r) => dateTime(r.createdAt) },
      ]} />}
      {tab === "ledger" && <DataTable list={ledger} empty={<EmptyState title="No ledger entries" />} columns={[
        { key: "d", header: "When", cell: (r) => dateTime(r.createdAt) },
        ...(portal ? [] : [{ key: "c", header: "Customer", cell: (r: Tx) => name(r.customerId) }]),
        { key: "t", header: "Type", cell: (r) => <Badge tone={r.type === "topup" ? "green" : r.type === "overage" ? "amber" : "slate"}>{r.type}</Badge> },
        { key: "r", header: "Reference", cell: (r) => <span className="text-xs">{r.reference}</span> },
        { key: "a", header: "Credits", align: "right", cell: (r) => <span className={r.amount > 0 ? "text-emerald-700" : ""}>{r.amount > 0 ? "+" : ""}{r.amount}</span> },
        { key: "b", header: "Balance", align: "right", cell: (r) => r.balanceAfter },
      ]} />}
      <Modal open={useOpen} onClose={() => setUseOpen(false)} title={portal ? "Simulate usage" : "Record usage"} description="Consumes credits per the wallet policy. Duplicate idempotency keys are ignored." size="sm"
        footer={<><Button variant="secondary" onClick={() => setUseOpen(false)}>Cancel</Button><Button loading={busy} disabled={!u.subscriptionId} onClick={async () => {
          setBusy(true);
          try { const r = await api<{ balanceAfter: number; overageUnits: number; lowBalance: boolean }>("/api/usage", { body: { subscriptionId: u.subscriptionId, metric: u.metric, quantity: Number(u.quantity), idempotencyKey: `${u.subscriptionId}-${Date.now()}` } }); toast.success("Usage recorded", `Balance ${r.balanceAfter}${r.overageUnits ? ` · ${r.overageUnits} overage units will be billed` : ""}${r.lowBalance ? " · low balance" : ""}`); setUseOpen(false); reload(); }
          catch (e) { toast.error("Usage rejected", (e as Error).message); } finally { setBusy(false); }
        }}>Record</Button></>}>
        <div className="space-y-4">
          <Field label="Subscription" id="us"><Select id="us" value={u.subscriptionId} onChange={(e) => setU({ ...u, subscriptionId: e.target.value })} options={(subs.data?.items ?? []).map((s) => ({ value: s.id, label: `${s.number} · ${s.planName}${portal ? "" : ` · ${s.customerName}`}` }))} placeholder="Choose active subscription" /></Field>
          <div className="grid grid-cols-2 gap-3"><Field label="Metric" id="um"><Input id="um" value={u.metric} onChange={(e) => setU({ ...u, metric: e.target.value })} /></Field><Field label="Quantity" id="uq"><Input id="uq" type="number" min={1} value={u.quantity} onChange={(e) => setU({ ...u, quantity: e.target.value })} /></Field></div>
        </div>
      </Modal>
      <Modal open={topOpen} onClose={() => setTopOpen(false)} title={portal ? "Buy credits" : "Grant credits"} description={portal ? "Payment Simulator – no real money moves." : "Adds credits to the customer's wallet with a ledger entry."} size="sm"
        footer={<><Button variant="secondary" onClick={() => setTopOpen(false)}>Cancel</Button><Button loading={busy} disabled={!portal && !t.customerId} onClick={async () => {
          setBusy(true);
          try { await api("/api/credits/topup", { body: { customerId: portal ? undefined : t.customerId, credits: Number(t.credits) } }); toast.success(`${t.credits} credits added`); setTopOpen(false); reload(); }
          catch (e) { toast.error("Top-up failed", (e as Error).message); } finally { setBusy(false); }
        }}>Add credits</Button></>}>
        <div className="space-y-4">
          {!portal && <Field label="Customer" id="tc"><Select id="tc" value={t.customerId} onChange={(e) => setT({ ...t, customerId: e.target.value })} options={(customers.data?.items ?? []).map((c) => ({ value: c.id, label: c.name }))} placeholder="Choose customer" /></Field>}
          <Field label="Credits" id="tcr"><div className="flex gap-2">{["250", "500", "1000", "5000"].map((v) => <button key={v} type="button" onClick={() => setT({ ...t, credits: v })} className={cn("flex-1 rounded-xl border py-2 text-sm", t.credits === v ? "border-brand-600 bg-brand-50 font-semibold text-brand-700" : "border-slate-200")}>{v}</button>)}</div></Field>
        </div>
      </Modal>
      {!portal && user?.role !== "admin" && <p className="text-xs text-ink-muted">Updated {date(new Date().toISOString())}</p>}
    </div>
  );
}
