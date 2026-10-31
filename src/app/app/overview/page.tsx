"use client";
import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, ArrowRight, CircleDollarSign, Play, Repeat, TrendingUp, Clock3 } from "lucide-react";
import { api, useApi } from "@/lib/client/api";
import { useAuth } from "@/lib/client/auth";
import type { Invoice } from "@/lib/types";
import type { Analytics } from "@/components/analyticsTypes";
import { PageHeader } from "@/components/shell/AppShell";
import { KpiCard, InsightCard } from "@/components/ui/kpi";
import { Badge, Button, Card, CardHeader, EmptyState, ErrorNote, Skeleton, StatusPill } from "@/components/ui/primitives";
import { Donut, RevenueChart } from "@/components/charts";
import { useToast } from "@/components/ui/toast";
import { date, money, pct } from "@/lib/client/format";

function insight(a: Analytics): string {
  const aged = a.ageing.d31_60 + a.ageing.d61_90 + a.ageing.d90_plus;
  if (a.kpis.overdueCount > 0) return `${a.kpis.overdueCount} invoices worth ${money(a.kpis.overdueAmount)} are overdue${aged ? `, and ${money(aged)} is more than 30 days late` : ""}. Chasing the top three would recover ${money(a.overdueList.slice(0, 3).reduce((s, o) => s + o.outstanding, 0))}.`;
  if (a.kpis.churnedLast30) return `${a.kpis.churnedLast30} subscriptions closed in 30 days, costing ${money(a.kpis.churnLossMrr)} of MRR. Consider a retention offer for at-risk accounts.`;
  return `Collections are healthy: ${pct(a.kpis.successRate)} payment success rate and no overdue invoices.`;
}

export default function OverviewPage() {
  const { user, org } = useAuth();
  const toast = useToast();
  const a = useApi<Analytics>("/api/analytics");
  const latest = useApi<{ items: Invoice[] }>("/api/r/invoices?limit=6");
  const [running, setRunning] = useState(false);
  const k = a.data?.kpis;
  const delta = k && k.collectedLastMonth ? (k.collectedThisMonth - k.collectedLastMonth) / k.collectedLastMonth : null;
  return (
    <div className="space-y-6">
      <PageHeader title={`Good ${new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"}, ${user?.name.split(" ")[0]}`} description="Your recurring revenue at a glance – subscriptions, collections and what needs attention."
        actions={user?.role === "admin" ? <Button variant="secondary" loading={running} icon={<Play className="h-4 w-4" />} onClick={async () => {
          setRunning(true);
          try { const r = await api<{ status: string; invoicesCreated: number; overdueMarked: number; duplicates: number; durationMs: number }>("/api/billing/run", { body: {} }); toast.success(r.status === "locked" ? "A billing run is already in progress" : `Billing run complete in ${r.durationMs} ms`, `${r.invoicesCreated} invoices created · ${r.overdueMarked} marked overdue · ${r.duplicates} duplicates prevented`); a.reload(); latest.reload(); }
          catch (e) { toast.error("Billing run failed", (e as Error).message); } finally { setRunning(false); }
        }}>Run billing now</Button> : undefined} />
      {a.error && <ErrorNote message={a.error} onRetry={a.reload} />}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="MRR" icon={<TrendingUp className="h-4 w-4" />} loading={!k} value={money(k?.mrr ?? 0, true)} deltaLabel={k && <>ARR <b className="text-ink">{money(k.arr, true)}</b> · ARPC {money(k.arpc, true)}</>} />
        <KpiCard label="Active subscriptions" icon={<Repeat className="h-4 w-4" />} loading={!k} value={k?.activeSubs.toLocaleString("en-IN") ?? 0} deltaLabel={k && <><span className="text-emerald-600">+{k.newLast30} new</span> · <span className="text-rose-600">{k.churnedLast30} churned</span> in 30 days</>} />
        <KpiCard label="Collected this month" icon={<CircleDollarSign className="h-4 w-4" />} loading={!k} value={money(k?.collectedThisMonth ?? 0, true)} delta={delta} deltaLabel={k && <>vs {money(k.collectedLastMonth, true)} last month</>} />
        <KpiCard label="Overdue" tone="danger" icon={<AlertTriangle className="h-4 w-4" />} loading={!k} value={money(k?.overdueAmount ?? 0, true)} deltaLabel={k && <>{k.overdueCount} invoices · {money(k.outstanding, true)} total outstanding</>} />
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Revenue – invoiced vs collected" subtitle="Last 12 months, from issued invoices and recorded payments" actions={<Link href="/app/analytics" className="text-xs font-medium text-brand-600 hover:underline">Full analytics</Link>} />
          <div className="px-3 pb-4 pt-2">{a.data ? <RevenueChart height={360} data={a.data.revenueTrend} /> : <Skeleton className="m-2 h-[260px]" />}</div>
        </Card>
        <div className="space-y-6">
          {a.data ? <InsightCard title="Insight" action={<Link href={user?.role === "admin" ? "/app/assistant" : "/app/invoices"}><Button size="sm" variant="secondary" className="border-0">{user?.role === "admin" ? "Ask the assistant" : "View invoices"}<ArrowRight className="h-3.5 w-3.5" /></Button></Link>}>{insight(a.data)}<p className="mt-2 text-xs font-normal text-white/70">Computed from your billing data – no guesses.</p></InsightCard> : <Skeleton className="h-48" />}
          <Card className="p-5">
            <p className="text-sm font-semibold">MRR by plan</p>
            {a.data ? (a.data.planMix.length ? <Donut data={a.data.planMix.slice(0, 6).map((p) => ({ name: p.name, value: p.mrr }))} center={money(a.data.kpis.mrr, true)} sub="MRR" /> : <EmptyState title="No active revenue yet" />) : <Skeleton className="mt-3 h-56" />}
          </Card>
        </div>
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="overflow-hidden xl:col-span-2">
          <CardHeader title="Latest invoices" actions={<Link href="/app/invoices" className="text-xs font-medium text-brand-600 hover:underline">View all</Link>} />
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead><tr className="bg-slate-50/80 text-left text-xs text-ink-muted"><th className="px-5 py-2.5 font-medium">Invoice</th><th className="px-5 py-2.5 font-medium">Customer</th><th className="px-5 py-2.5 text-right font-medium">Amount</th><th className="px-5 py-2.5 font-medium">Date</th><th className="px-5 py-2.5 font-medium">Status</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {(latest.data?.items ?? []).map((i) => (
                  <tr key={i.id} className="hover:bg-slate-50"><td className="px-5 py-3"><Link href={`/app/invoices/${i.id}`} className="font-mono text-xs font-medium text-brand-600 hover:underline">{i.number}</Link></td><td className="px-5 py-3 font-medium">{i.customer.name}</td><td className="px-5 py-3 text-right tabular-nums">{money(i.total)}</td><td className="px-5 py-3 text-ink-muted">{date(i.invoiceDate)}</td><td className="px-5 py-3"><StatusPill status={i.status} /></td></tr>
                ))}
                {!latest.data && Array.from({ length: 5 }).map((_, n) => <tr key={n}><td colSpan={5} className="px-5 py-3"><Skeleton className="h-4" /></td></tr>)}
              </tbody>
            </table>
          </div>
        </Card>
        <Card>
          <CardHeader title="Needs attention" icon={<Clock3 className="h-4 w-4" />} />
          <ul className="mt-3 divide-y divide-slate-100 pb-2 text-sm">
            {a.data?.overdueList.slice(0, 4).map((o) => <li key={o.id}><Link href={`/app/invoices/${o.id}`} className="flex items-center justify-between px-5 py-2.5 hover:bg-slate-50"><span><b className="font-medium">{o.customer}</b><span className="block text-xs text-ink-muted">{o.number} · due {date(o.dueDate)}</span></span><Badge tone="red">{money(o.outstanding, true)}</Badge></Link></li>)}
            {a.data?.repeatedFailures.slice(0, 2).map((f) => <li key={f.invoiceId}><Link href={`/app/invoices/${f.invoiceId}`} className="flex items-center justify-between px-5 py-2.5 hover:bg-slate-50"><span><b className="font-medium">{f.customer}</b><span className="block text-xs text-ink-muted">{f.number}</span></span><Badge tone="amber">{f.attempts} failed</Badge></Link></li>)}
            {a.data?.renewalsThisWeek.slice(0, 3).map((r) => <li key={r.id}><Link href={`/app/subscriptions/${r.id}`} className="flex items-center justify-between px-5 py-2.5 hover:bg-slate-50"><span><b className="font-medium">{r.customer}</b><span className="block text-xs text-ink-muted">{r.number} ends {date(r.endDate)}</span></span><Badge tone="violet">Renewal</Badge></Link></li>)}
            {a.data && !a.data.overdueList.length && !a.data.repeatedFailures.length && !a.data.renewalsThisWeek.length && <li><EmptyState title="All clear" description="Nothing overdue, failing or renewing this week." /></li>}
          </ul>
          {k && <p className="border-t border-slate-100 px-5 py-3 text-xs text-ink-muted">Business date {org?.today}{org?.demoDate ? " (demo clock)" : ""} · computed in {a.data?.computedMs} ms</p>}
        </Card>
      </div>
    </div>
  );
}
