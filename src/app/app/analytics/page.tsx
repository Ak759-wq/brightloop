"use client";
import { api, useApi } from "@/lib/client/api";
import type { Analytics } from "@/components/analyticsTypes";
import { PageHeader } from "@/components/shell/AppShell";
import { Badge, Button, Card, CardHeader, ErrorNote, Skeleton } from "@/components/ui/primitives";
import { KpiCard } from "@/components/ui/kpi";
import { AgeingBars, BridgeBars, Donut, MrrChart, RevenueChart } from "@/components/charts";
import { money, pct } from "@/lib/client/format";
import { Activity, Gauge, Percent, Users, RefreshCw } from "lucide-react";

const DEFS: [string, string][] = [
  ["MRR", "Sum of active subscriptions' recurring amount (pre-tax, after discounts) normalised to a month: yearly ÷ 12, weekly × 52 ÷ 12, daily × 365 ÷ 12. Paused subscriptions excluded."],
  ["ARR", "MRR × 12."],
  ["ARPC", "MRR ÷ customers with at least one active subscription."],
  ["Collected", "Payments recorded in the period, net of refunds (cash basis)."],
  ["Outstanding / overdue", "Total − credit notes − (paid − refunded) for confirmed invoices; overdue when today is after the due date."],
  ["Churn loss", "MRR of subscriptions closed in the last 30 days."],
  ["NRR / GRR", "Computed by the engine from MRR snapshots (start + expansion − contraction − churn) ÷ start; GRR caps at 100%. The bridge below is an estimate from the last 30 days of amendments and closures."],
  ["Payment success rate", "Succeeded ÷ (succeeded + failed) attempts; dunning reminders (pending) excluded."],
];

export default function AnalyticsPage() {
  const a = useApi<Analytics>("/api/analytics");
  const d = a.data;
  const b = d?.bridge;
  const nrr = b && b.start ? (b.start + b.expansion - b.contraction - b.churned) / b.start : null;
  const grr = b && b.start ? Math.min(1, (b.start - b.contraction - b.churned) / b.start) : null;
  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" description="Revenue intelligence with filters and definitions. Estimates and forecasts are labelled." actions={<Button variant="secondary" icon={<RefreshCw className="h-4 w-4" />} onClick={async () => { a.setData(await api<Analytics>("/api/analytics?fresh=1")); }}>Refresh</Button>} />
      {a.error && <ErrorNote message={a.error} onRetry={a.reload} />}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="MRR" icon={<Gauge className="h-4 w-4" />} loading={!d} value={money(d?.kpis.mrr ?? 0, true)} hint={d && `ARR ${money(d.kpis.arr, true)}`} />
        <KpiCard label="Customers" icon={<Users className="h-4 w-4" />} loading={!d} value={d?.kpis.activeCustomers ?? 0} hint={d && `ARPC ${money(d.kpis.arpc)}`} />
        <KpiCard label="Payment success rate" icon={<Percent className="h-4 w-4" />} loading={!d} value={pct(d?.kpis.successRate)} hint="Succeeded ÷ (succeeded + failed)" />
        <KpiCard label="NRR (30-day estimate)" icon={<Activity className="h-4 w-4" />} loading={!d} value={pct(nrr)} hint={`GRR ${pct(grr)}`} badge={<Badge tone="amber">Estimate</Badge>} />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card><CardHeader title="Revenue trend" subtitle="Invoiced (accrual) vs collected (cash), 12 months" /><div className="px-3 pb-4">{d ? <RevenueChart data={d.revenueTrend} /> : <Skeleton className="m-3 h-64" />}</div></Card>
        <Card><CardHeader title="MRR trend & forecast" subtitle="Reconstructed from start/close dates at current prices" actions={<><Badge tone="amber">Estimate</Badge><Badge tone="violet">Forecast dashed</Badge></>} /><div className="px-3 pb-4">{d ? <MrrChart data={d.mrrTrend} forecast={d.forecast} /> : <Skeleton className="m-3 h-64" />}</div>{d && <p className="px-5 pb-4 text-xs text-ink-muted">Forecast assumes the recent average monthly growth of {(d.forecastGrowth * 100).toFixed(1)}% continues. It is not a commitment.</p>}</Card>
        <Card><CardHeader title="Revenue bridge (last 30 days)" subtitle="Start → new + expansion − contraction − churn → today" actions={<Badge tone="amber">Estimate</Badge>} /><div className="px-3 pb-4">{b ? <BridgeBars data={[{ label: "Start", value: b.start }, { label: "New", value: b.newMrr }, { label: "Expansion", value: b.expansion }, { label: "Contraction", value: -b.contraction }, { label: "Churn", value: -b.churned }, { label: "Now", value: b.end }]} /> : <Skeleton className="m-3 h-56" />}</div></Card>
        <Card><CardHeader title="Receivables ageing" subtitle="Outstanding balance by days past due" /><div className="px-3 pb-4">{d ? <AgeingBars data={[{ bucket: "Current", amount: d.ageing.current }, { bucket: "1–30", amount: d.ageing.d1_30 }, { bucket: "31–60", amount: d.ageing.d31_60 }, { bucket: "61–90", amount: d.ageing.d61_90 }, { bucket: "90+", amount: d.ageing.d90_plus }]} /> : <Skeleton className="m-3 h-56" />}</div></Card>
        <Card className="p-5"><p className="mb-2 text-sm font-semibold">Top products by MRR</p>{d ? <Donut data={d.topProducts.map((p) => ({ name: p.name, value: p.mrr }))} center={String(d.topProducts.length)} sub="products" /> : <Skeleton className="h-56" />}</Card>
        <Card><CardHeader title="Subscriptions by status" /><div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3">{d && Object.entries(d.statusCounts).map(([s, n]) => <div key={s} className="rounded-xl bg-slate-50 p-3"><p className="text-xs capitalize text-ink-muted">{s}</p><p className="text-xl font-semibold tabular-nums">{n.toLocaleString("en-IN")}</p></div>)}</div>{d && <p className="px-5 pb-4 text-xs text-ink-muted">Computed over {Object.values(d.statusCounts).reduce((x, y) => x + y, 0).toLocaleString("en-IN")} subscriptions in {d.computedMs} ms (cached 30 s).</p>}</Card>
      </div>
      <Card className="p-5">
        <p className="text-sm font-semibold">Metric definitions</p>
        <dl className="mt-3 grid gap-x-8 gap-y-3 md:grid-cols-2">{DEFS.map(([t, x]) => <div key={t}><dt className="text-xs font-semibold text-ink">{t}</dt><dd className="text-xs text-ink-muted">{x}</dd></div>)}</dl>
      </Card>
    </div>
  );
}
