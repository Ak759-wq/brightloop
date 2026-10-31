"use client";
import Link from "next/link";
import { ArrowRight, CreditCard, Receipt, Repeat, Wallet } from "lucide-react";
import { useApi } from "@/lib/client/api";
import { useAuth } from "@/lib/client/auth";
import type { Invoice } from "@/lib/types";
import { PageHeader } from "@/components/shell/AppShell";
import { KpiCard, InsightCard } from "@/components/ui/kpi";
import { Button, Card, CardHeader, EmptyState, StatusPill } from "@/components/ui/primitives";
import { owedOf } from "@/components/billing/InvoiceView";
import { date, intervalText, money } from "@/lib/client/format";
import type { Sub } from "@/components/billing/SubscriptionView";

export default function PortalOverview() {
  const { user } = useAuth();
  const subs = useApi<{ items: Sub[] }>("/api/r/subscriptions?limit=50");
  const invs = useApi<{ items: Invoice[] }>("/api/r/invoices?limit=50");
  const wallet = useApi<{ items: { balance: number; lastTopUp: number; lowBalancePct: number }[] }>("/api/r/credit_wallets?limit=1");
  const active = (subs.data?.items ?? []).filter((s) => s.status === "active");
  const open = (invs.data?.items ?? []).filter((i) => !["draft", "cancelled", "paid"].includes(i.status) && owedOf(i) > 0);
  const due = open.reduce((s, i) => s + owedOf(i), 0);
  const next = active.map((s) => s.nextBillingDate).filter(Boolean).sort()[0];
  const w = wallet.data?.items[0];
  return (
    <div className="space-y-6">
      <PageHeader title={`Welcome, ${user?.name.split(" ")[0]}`} description="Your subscriptions, invoices and credits in one place." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Active subscriptions" icon={<Repeat className="h-4 w-4" />} loading={!subs.data} value={active.length} hint={next ? `Next invoice ${date(next)}` : "No upcoming invoices"} />
        <KpiCard label="Amount due" tone={open.some((i) => i.status === "overdue") ? "danger" : "default"} icon={<Receipt className="h-4 w-4" />} loading={!invs.data} value={money(due)} hint={`${open.length} unpaid invoice${open.length === 1 ? "" : "s"}`} />
        <KpiCard label="Recurring spend" icon={<CreditCard className="h-4 w-4" />} loading={!subs.data} value={money(active.reduce((s, x) => s + x.recurringAmount, 0))} hint="Per billing period, before GST" />
        <KpiCard label="Credits" icon={<Wallet className="h-4 w-4" />} loading={!wallet.data} value={(w?.balance ?? 0).toLocaleString("en-IN")} hint={w && w.balance <= Math.floor((w.lastTopUp * w.lowBalancePct) / 100) ? "Running low – top up" : "Prepaid usage credits"} />
      </div>
      {open.length > 0 && (
        <InsightCard title="Action needed" action={<Link href={`/portal/invoices/${open[0].id}`}><Button size="sm" variant="secondary" className="border-0">Pay {money(owedOf(open[0]))}<ArrowRight className="h-3.5 w-3.5" /></Button></Link>}>
          {open.some((i) => i.status === "overdue") ? `You have an overdue invoice (${open.find((i) => i.status === "overdue")!.number}). Pay now to avoid interruption.` : `Invoice ${open[0].number} for ${money(owedOf(open[0]))} is due on ${date(open[0].dueDate)}.`}
        </InsightCard>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Subscriptions" actions={<Link className="text-xs font-medium text-brand-600" href="/portal/subscriptions">Manage</Link>} />
          <ul className="mt-3 divide-y divide-slate-100">
            {(subs.data?.items ?? []).slice(0, 5).map((s) => <li key={s.id}><Link href={`/portal/subscriptions/${s.id}`} className="flex items-center justify-between px-5 py-3 text-sm hover:bg-slate-50"><span><b className="font-medium">{s.planName}</b><span className="block text-xs text-ink-muted">{money(s.recurringAmount)}{intervalText(s.interval, s.intervalCount)}</span></span><StatusPill status={s.status} /></Link></li>)}
            {subs.data && !subs.data.items.length && <li><EmptyState title="No subscriptions" action={<Link href="/portal/plans"><Button size="sm">Explore plans</Button></Link>} /></li>}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Recent invoices" actions={<Link className="text-xs font-medium text-brand-600" href="/portal/invoices">View all</Link>} />
          <ul className="mt-3 divide-y divide-slate-100">
            {(invs.data?.items ?? []).slice(0, 5).map((i) => <li key={i.id}><Link href={`/portal/invoices/${i.id}`} className="flex items-center justify-between px-5 py-3 text-sm hover:bg-slate-50"><span><span className="font-mono text-xs">{i.number}</span><span className="block text-xs text-ink-muted">Due {date(i.dueDate)}</span></span><span className="flex items-center gap-3"><span className="tabular-nums">{money(i.total)}</span><StatusPill status={i.status} /></span></Link></li>)}
            {invs.data && !invs.data.items.length && <li><EmptyState title="No invoices yet" /></li>}
          </ul>
        </Card>
      </div>
    </div>
  );
}
