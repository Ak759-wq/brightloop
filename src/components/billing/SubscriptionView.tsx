"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpDown, Check, FilePlus2, Gift, History, Pause, Play, RefreshCw, Send, XCircle, BadgeCheck, Zap, Undo2 } from "lucide-react";
import { api, useApi } from "@/lib/client/api";
import { useAuth } from "@/lib/client/auth";
import { allowedActions, compareDates, periodAt, prorate, type SubAction, type SubStatus } from "@/lib/finance";
import { cn } from "@/lib/client/cn";
import { date, dateTime, intervalText, money } from "@/lib/client/format";
import { PageHeader } from "../shell/AppShell";
import { Badge, Button, Callout, Card, CardHeader, DescList, EmptyState, ErrorNote, Select, Skeleton, StatusPill, Textarea } from "../ui/primitives";
import { Modal, useConfirm } from "../ui/overlay";
import { useToast } from "../ui/toast";
import { LineItemsEditor, PriceSummary, usePreview, type LineInput } from "./lines";

interface Item { productId: string; productName: string; variantIds: string[]; variantLabel?: string; addonIds: string[]; quantity: number; unitPrice: number; amount: number }
export interface Sub {
  id: string; number: string; customerId: string; customerName: string; planId: string; planName: string; status: SubStatus; items: Item[]; discountIds: string[];
  startDate: string | null; endDate: string | null; anchorDate: string | null; nextBillingDate: string | null; currentPeriodStart: string | null; interval: string; intervalCount: number;
  paymentTermsDays: number; recurringAmount: number; subtotal: number; quoteValidUntil: string | null; version: number; pastDue?: boolean; closeReason?: string | null; notes?: string; createdAt: string;
}
interface Plan { id: string; name: string; productId: string; pausable: boolean; closable: boolean; renewable: boolean; interval: string; intervalCount: number; minQuantity: number; public: boolean; active: boolean }

const STEPS: SubStatus[] = ["draft", "quotation", "confirmed", "active", "closed"];

function Stepper({ status }: { status: SubStatus }) {
  const idx = status === "paused" ? 3 : STEPS.indexOf(status);
  return (
    <ol className="flex flex-wrap items-center gap-2" aria-label="Subscription lifecycle">
      {STEPS.map((s, i) => {
        const done = i < idx, cur = i === idx;
        return (
          <li key={s} className="flex items-center gap-2">
            <span className={cn("flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium", cur ? "bg-brand-600 text-white" : done ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-500")}>
              {done ? <Check className="h-3 w-3" /> : <span className="text-[10px]">{i + 1}</span>}
              {s === "active" && status === "paused" ? "Paused" : s.charAt(0).toUpperCase() + s.slice(1)}
            </span>
            {i < STEPS.length - 1 && <span className="h-px w-4 bg-slate-200" />}
          </li>
        );
      })}
    </ol>
  );
}

const ACTION_META: Record<SubAction, { label: string; icon: typeof Play; variant: "primary" | "secondary" | "dangerSoft" }> = {
  send_quotation: { label: "Send quotation", icon: Send, variant: "primary" },
  revert_to_draft: { label: "Back to draft", icon: Undo2, variant: "secondary" },
  confirm: { label: "Confirm", icon: BadgeCheck, variant: "primary" },
  activate: { label: "Activate & bill", icon: Zap, variant: "primary" },
  pause: { label: "Pause", icon: Pause, variant: "secondary" },
  resume: { label: "Resume", icon: Play, variant: "primary" },
  renew: { label: "Renew", icon: RefreshCw, variant: "secondary" },
  close: { label: "Cancel subscription", icon: XCircle, variant: "dangerSoft" },
};

export function SubscriptionView({ id, portal = false }: { id: string; portal?: boolean }) {
  const { user, org } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const sub = useApi<Sub>(`/api/r/subscriptions/${id}`);
  const plan = useApi<Plan>(sub.data ? `/api/r/plans/${sub.data.planId}` : null);
  const invoices = useApi<{ items: { id: string; number: string; status: string; total: number; invoiceDate: string; kind: string; periodStart: string | null; periodEnd: string | null }[] }>(`/api/r/invoices?subscriptionId=${id}&limit=24`);
  const versions = useApi<{ items: { id: string; version: number; reason: string; actor: string; createdAt: string }[] }>(`/api/r/subscription_versions?subscriptionId=${id}&limit=30`);
  const amendments = useApi<{ items: { id: string; fromPlan: string; toPlan: string; oldAmount: number; newAmount: number; kind: string; proration: { net: number; remainingDays: number; totalDays: number } | null; createdAt: string }[] }>(`/api/r/subscription_amendments?subscriptionId=${id}&limit=20`);
  const [busy, setBusy] = useState<string | null>(null);
  const [changeOpen, setChangeOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const reloadAll = () => { sub.reload(); invoices.reload(); versions.reload(); amendments.reload(); };

  if (sub.error) return <ErrorNote message={sub.error} onRetry={sub.reload} />;
  if (!sub.data) return <div className="space-y-4"><Skeleton className="h-10 w-72" /><Skeleton className="h-48 w-full" /></div>;
  const s = sub.data;
  const flags = plan.data ? { pausable: plan.data.pausable, closable: plan.data.closable, renewable: plan.data.renewable } : undefined;
  let actions = allowedActions(s.status, flags);
  if (portal) actions = actions.filter((a) => ["pause", "resume", "close", "renew", ...(s.status === "quotation" ? ["confirm"] : [])].includes(a));
  const staff = !portal;
  const base = portal ? "/portal" : "/app";

  async function run(action: SubAction, extra: Record<string, unknown> = {}) {
    if (action === "close") { setCancelOpen(true); return; }
    if (action === "pause") {
      const r = await confirm({ title: "Pause subscription?", body: "No invoices are generated while paused. Resume any time.", confirmLabel: "Pause" });
      if (!r.ok) return;
    }
    setBusy(action);
    try {
      await api(`/api/subscriptions/${id}/action`, { body: { action, ...extra } });
      toast.success(`${ACTION_META[action].label} – done`, action === "activate" ? "The first invoice was generated." : undefined);
      reloadAll();
    } catch (e) { toast.error("Action failed", (e as Error).message); } finally { setBusy(null); }
  }

  return (
    <div className="space-y-6">
      <PageHeader title={`${s.planName}`} description={<span className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs">{s.number}</span><StatusPill status={s.status} />{s.pastDue && <Badge tone="red">Past due</Badge>}{staff && <>· <Link href={`/app/customers/${s.customerId}`} className="font-medium text-brand-600 hover:underline">{s.customerName}</Link></>}</span>}
        actions={<>
          {actions.map((a) => { const m = ACTION_META[a]; return <Button key={a} variant={m.variant} loading={busy === a} icon={<m.icon className="h-4 w-4" />} onClick={() => run(a)}>{portal && a === "confirm" ? "Accept quotation" : m.label}</Button>; })}
          {["active", "draft", "quotation", "confirmed"].includes(s.status) && <Button variant="secondary" icon={<ArrowUpDown className="h-4 w-4" />} onClick={() => setChangeOpen(true)}>{portal ? "Upgrade / downgrade" : "Change plan / lines"}</Button>}
          {staff && ["active", "confirmed"].includes(s.status) && <Button variant="ghost" icon={<FilePlus2 className="h-4 w-4" />} loading={busy === "inv"} onClick={async () => { setBusy("inv"); try { const inv = await api<{ id: string; number: string }>(`/api/subscriptions/${id}/invoice`, { body: {} }); toast.success(`Draft ${inv.number} created`); invoices.reload(); } catch (e) { toast.error("Could not create invoice", (e as Error).message); } finally { setBusy(null); } }}>Draft invoice</Button>}
        </>} />
      <Card className="p-5"><Stepper status={s.status} />
        {s.status === "quotation" && s.quoteValidUntil && <p className="mt-3 text-xs text-ink-muted">Quotation valid until <b>{date(s.quoteValidUntil)}</b>{org && compareDates(org.today, s.quoteValidUntil) > 0 && <Badge tone="red" className="ml-2">Expired</Badge>}</p>}
        {s.status === "closed" && s.closeReason && <p className="mt-3 text-xs text-ink-muted">Closed: {s.closeReason}</p>}
      </Card>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <DescList cols={3} items={[
            { label: "Customer", value: s.customerName }, { label: "Plan", value: s.planName }, { label: "Billing", value: `${money(s.recurringAmount)} ${intervalText(s.interval, s.intervalCount)} + tax` },
            { label: "Start date", value: date(s.startDate) }, { label: "Expiry date", value: s.endDate ? date(s.endDate) : "Open-ended" }, { label: "Next invoice", value: date(s.nextBillingDate) },
            { label: "Payment terms", value: `Net ${s.paymentTermsDays} days` }, { label: "Version", value: `v${s.version}` }, { label: "Created", value: date(s.createdAt) },
          ]} />
        </Card>
        <Card className="p-5">
          <p className="text-sm font-semibold">Recurring charge</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">{money(s.recurringAmount)}</p>
          <p className="text-xs text-ink-muted">{intervalText(s.interval, s.intervalCount)}, before tax, after discounts</p>
          {s.subtotal !== s.recurringAmount && <p className="mt-2 text-xs text-emerald-700">Saving {money(s.subtotal - s.recurringAmount)} per period</p>}
        </Card>
      </div>
      <Card className="overflow-hidden">
        <CardHeader title="Order lines" subtitle="Unit prices include variant and add-on deltas" />
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead><tr className="bg-slate-50 text-left text-xs text-ink-muted"><th className="px-5 py-2.5 font-medium">Product</th><th className="px-5 py-2.5 text-right font-medium">Qty</th><th className="px-5 py-2.5 text-right font-medium">Unit price</th><th className="px-5 py-2.5 text-right font-medium">Amount</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {s.items.map((it, i) => <tr key={i}><td className="px-5 py-3"><p className="font-medium">{it.productName}</p>{it.variantLabel && <p className="text-xs text-ink-muted">{it.variantLabel}</p>}</td><td className="px-5 py-3 text-right tabular-nums">{it.quantity}</td><td className="px-5 py-3 text-right tabular-nums">{money(it.unitPrice)}</td><td className="px-5 py-3 text-right tabular-nums">{money(it.amount)}</td></tr>)}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Invoices" />
          <div className="mt-3 divide-y divide-slate-100">
            {(invoices.data?.items ?? []).map((i) => (
              <Link key={i.id} href={`${base}/invoices/${i.id}`} className="flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-slate-50">
                <span><span className="font-mono text-xs">{i.number}</span>{i.kind !== "recurring" && <Badge tone="violet" className="ml-2">{i.kind}</Badge>}<span className="block text-xs text-ink-muted">{i.periodStart ? `${date(i.periodStart)} – ${date(i.periodEnd)}` : date(i.invoiceDate)}</span></span>
                <span className="flex items-center gap-3"><span className="tabular-nums">{money(i.total)}</span><StatusPill status={i.status} /></span>
              </Link>
            ))}
            {invoices.data && !invoices.data.items.length && <EmptyState title="No invoices yet" description="Invoices are generated automatically on each billing date once active." />}
          </div>
        </Card>
        <Card>
          <CardHeader title="History" icon={<History className="h-4 w-4" />} subtitle="Every change creates a new version" />
          <ol className="mt-3 space-y-0 px-5 pb-5">
            {(amendments.data?.items ?? []).map((a) => (
              <li key={a.id} className="mb-3 rounded-xl border border-violet-100 bg-violet-50/50 px-3 py-2 text-xs">
                <b className="capitalize">{a.kind}</b>: {a.fromPlan} → {a.toPlan} · {money(a.oldAmount)} → {money(a.newAmount)}
                {a.proration && <span className="block text-ink-muted">Proration {a.proration.remainingDays}/{a.proration.totalDays} days, net {a.proration.net >= 0 ? `charge ${money(a.proration.net)}` : `credit ${money(-a.proration.net)}`}</span>}
              </li>
            ))}
            {(versions.data?.items ?? []).sort((a, b) => b.version - a.version).map((v) => (
              <li key={v.id} className="relative border-l border-slate-200 pb-4 pl-4 last:pb-0">
                <span className="absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-brand-500" />
                <p className="text-sm"><b>v{v.version}</b> · <span className="capitalize">{v.reason}</span></p>
                <p className="text-xs text-ink-muted">{v.actor} · {dateTime(v.createdAt)}</p>
              </li>
            ))}
          </ol>
        </Card>
      </div>
      {changeOpen && plan.data && <ChangeModal sub={s} currentPlan={plan.data} portal={portal} onClose={() => setChangeOpen(false)} onDone={reloadAll} />}
      {cancelOpen && <CancelModal sub={s} canOffer={!!org?.retentionDiscountId && !s.discountIds.includes(org.retentionDiscountId) && s.status === "active"} onClose={() => setCancelOpen(false)} onDone={reloadAll} />}
      {user?.role === "staff" && <p className="text-xs text-ink-soft">Staff can manage lifecycle and invoices; discounts and taxes are admin-only.</p>}
    </div>
  );
}

function ChangeModal({ sub, currentPlan, portal, onClose, onDone }: { sub: Sub; currentPlan: Plan; portal: boolean; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const { org } = useAuth();
  const plans = useApi<{ items: Plan[] }>("/api/r/plans?active=true&limit=100");
  const [planId, setPlanId] = useState(sub.planId);
  const [lines, setLines] = useState<LineInput[]>(sub.items.map((i) => ({ productId: i.productId, variantIds: i.variantIds, addonIds: i.addonIds, quantity: i.quantity })));
  const [busy, setBusy] = useState(false);
  const target = plans.data?.items.find((p) => p.id === planId) ?? currentPlan;
  const compatible = (plans.data?.items ?? []).filter((p) => p.interval === sub.interval && p.intervalCount === sub.intervalCount && (!portal || p.public));
  const { data, error } = usePreview(planId, sub.customerId, lines, sub.discountIds);
  const est = useMemo(() => {
    if (sub.status !== "active" || !data?.preview || !sub.anchorDate || !sub.currentPeriodStart || !org) return null;
    try {
      const p = periodAt(sub.anchorDate, sub.interval as never, sub.intervalCount, sub.currentPeriodStart);
      return prorate({ periodStart: p.start, periodEndExclusive: p.endExclusive, changeDate: org.today, oldAmount: sub.recurringAmount, newAmount: data.preview.totals.taxableTotal });
    } catch { return null; }
  }, [data, sub, org]);
  return (
    <Modal open onClose={onClose} title={portal ? "Upgrade or downgrade" : "Change plan or lines"} description="Mid-cycle changes are prorated by day." size="xl"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={busy} disabled={!!error || !data?.preview} onClick={async () => {
        setBusy(true);
        try {
          const r = await api<{ proration: { net: number } | null; prorationInvoiceId: string | null }>(`/api/subscriptions/${sub.id}/change`, { body: { planId, items: lines } });
          toast.success("Subscription updated", r.proration ? (r.proration.net > 0 ? `Proration invoice raised for ${money(r.proration.net)} + tax` : r.proration.net < 0 ? `${money(-r.proration.net)} credited to the account` : undefined) : undefined);
          onDone(); onClose();
        } catch (e) { toast.error("Change failed", (e as Error).message); } finally { setBusy(false); }
      }}>Apply change</Button></>}>
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <Select aria-label="Plan" value={planId} onChange={(e) => { const p = compatible.find((x) => x.id === e.target.value); setPlanId(e.target.value); if (p && p.productId !== lines[0]?.productId) setLines([{ productId: p.productId, variantIds: [], addonIds: [], quantity: Math.max(p.minQuantity, lines[0]?.quantity ?? 1) }, ...lines.slice(1)]); }} options={compatible.map((p) => ({ value: p.id, label: p.name }))} />
          <LineItemsEditor lines={lines} onChange={setLines} lockFirstProduct minQuantity={target.minQuantity} />
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <PriceSummary data={data} error={error} intervalLabel={intervalText(sub.interval, sub.intervalCount)} />
          {est && (
            <div className="mt-4 rounded-xl border border-brand-200 bg-white p-3 text-xs">
              <p className="font-semibold text-ink">Proration estimate ({est.remainingDays} of {est.totalDays} days left)</p>
              <p className="mt-1 text-ink-muted">Credit for unused time {money(est.credit)} · new plan for the rest of the period {money(est.charge)}</p>
              <p className={cn("mt-1 font-semibold", est.net >= 0 ? "text-ink" : "text-emerald-700")}>{est.net > 0 ? `You'll be invoiced ${money(est.net)} + tax now` : est.net < 0 ? `${money(-est.net)} will be credited to your account` : "No charge"}</p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

function CancelModal({ sub, canOffer, onClose, onDone }: { sub: Sub; canOffer: boolean; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [preset, setPreset] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const finalReason = [preset, reason].filter(Boolean).join(" – ");
  const go = async (accept: boolean) => {
    setBusy(accept ? "offer" : "cancel");
    try {
      await api(`/api/subscriptions/${sub.id}/action`, { body: { action: "close", reason: finalReason || "Accepted retention offer", acceptRetentionOffer: accept } });
      toast.success(accept ? "Offer applied – thanks for staying!" : "Subscription cancelled");
      onDone(); onClose();
    } catch (e) { toast.error("Failed", (e as Error).message); } finally { setBusy(null); }
  };
  return (
    <Modal open onClose={onClose} title={`Cancel ${sub.planName}?`} description="Billing stops immediately. Existing invoices remain payable." size="md"
      footer={<><Button variant="secondary" onClick={onClose}>Keep subscription</Button><Button variant="danger" loading={busy === "cancel"} disabled={!finalReason} onClick={() => go(false)}>Cancel subscription</Button></>}>
      <div className="space-y-4">
        {canOffer && (
          <Callout tone="blue" icon={<Gift className="h-4 w-4" />} title="Before you go – 20% off your next invoices">
            <p>Stay and we&apos;ll apply our retention discount automatically. This is optional – you can still cancel below.</p>
            <Button size="sm" className="mt-2" loading={busy === "offer"} onClick={() => go(true)}>Accept offer and stay</Button>
          </Callout>
        )}
        <div>
          <p className="mb-2 text-xs font-medium text-slate-700">Reason (required)</p>
          <div className="flex flex-wrap gap-2">
            {["Too expensive", "Missing features", "Switching provider", "No longer needed", "Business closed"].map((r) => (
              <button key={r} type="button" aria-pressed={preset === r} onClick={() => setPreset(preset === r ? "" : r)} className={cn("rounded-full border px-3 py-1 text-xs", preset === r ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 hover:bg-slate-50")}>{r}</button>
            ))}
          </div>
          <Textarea className="mt-3" aria-label="Additional details" placeholder="Anything else? (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}
