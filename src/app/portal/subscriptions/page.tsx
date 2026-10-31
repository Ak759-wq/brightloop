"use client";
import Link from "next/link";
import { Repeat, ShoppingBag } from "lucide-react";
import { useApi } from "@/lib/client/api";
import { PageHeader } from "@/components/shell/AppShell";
import { Button, Card, EmptyState, Skeleton, StatusPill } from "@/components/ui/primitives";
import { date, intervalText, money } from "@/lib/client/format";
import type { Sub } from "@/components/billing/SubscriptionView";

export default function MySubs() {
  const subs = useApi<{ items: Sub[] }>("/api/r/subscriptions?limit=50");
  return (
    <div>
      <PageHeader title="My subscriptions" description="Pause, resume, upgrade, downgrade or cancel – no emails needed." actions={<Link href="/portal/plans"><Button icon={<ShoppingBag className="h-4 w-4" />}>Explore plans</Button></Link>} />
      {!subs.data ? <div className="grid gap-4 md:grid-cols-2"><Skeleton className="h-40" /><Skeleton className="h-40" /></div> : subs.data.items.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {subs.data.items.map((s) => (
            <Link key={s.id} href={`/portal/subscriptions/${s.id}`}>
              <Card className="h-full p-5 transition hover:-translate-y-0.5 hover:shadow-lift">
                <div className="flex items-start justify-between"><div><p className="font-semibold">{s.planName}</p><p className="font-mono text-xs text-ink-muted">{s.number}</p></div><StatusPill status={s.status} /></div>
                <p className="mt-4 text-2xl font-semibold tabular-nums">{money(s.recurringAmount)}<span className="text-sm font-normal text-ink-muted">{intervalText(s.interval, s.intervalCount)} + GST</span></p>
                <p className="mt-1 text-xs text-ink-muted">{s.items.map((i) => `${i.quantity} × ${i.productName}`).join(" · ")}</p>
                <div className="mt-4 flex justify-between border-t border-slate-100 pt-3 text-xs text-ink-muted"><span>Next invoice {date(s.nextBillingDate)}</span><span>{s.endDate ? `Ends ${date(s.endDate)}` : "Open-ended"}</span></div>
              </Card>
            </Link>
          ))}
        </div>
      ) : <Card><EmptyState icon={<Repeat className="h-6 w-6" />} title="No subscriptions yet" description="Pick a plan to get started." action={<Link href="/portal/plans"><Button size="sm">Explore plans</Button></Link>} /></Card>}
    </div>
  );
}
