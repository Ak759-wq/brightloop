"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus, Repeat } from "lucide-react";
import { useApi, useList } from "@/lib/client/api";
import { PageHeader } from "@/components/shell/AppShell";
import { Badge, Button, EmptyState, StatusPill, Tabs } from "@/components/ui/primitives";
import { DataTable, Toolbar, useDebounced } from "@/components/ui/table";
import { date, intervalText, money } from "@/lib/client/format";
import type { Sub } from "@/components/billing/SubscriptionView";

const TABS = ["all", "active", "paused", "confirmed", "quotation", "draft", "closed"];

export default function SubscriptionsPage() {
  const router = useRouter();
  const [tab, setTab] = useState("all");
  const [q, setQ] = useState("");
  const [planId, setPlanId] = useState("");
  const dq = useDebounced(q);
  const plans = useApi<{ items: { id: string; name: string }[] }>("/api/r/plans?limit=100");
  const list = useList<Sub>("subscriptions", { q: dq, status: tab === "all" ? undefined : tab, planId });
  return (
    <div>
      <PageHeader title="Subscriptions" description="Every subscription with its number, customer, plan, dates, terms and where it stands." actions={<Link href="/app/subscriptions/new"><Button icon={<Plus className="h-4 w-4" />}>New subscription</Button></Link>} />
      <div className="mb-4 overflow-x-auto"><Tabs tabs={TABS.map((t) => ({ value: t, label: t === "all" ? "All" : t.charAt(0).toUpperCase() + t.slice(1) }))} value={tab} onChange={setTab} /></div>
      <DataTable list={list} onRowClick={(r) => router.push(`/app/subscriptions/${r.id}`)}
        toolbar={<Toolbar search={q} onSearch={setQ} placeholder="Search number, customer or plan…" filters={[{ key: "planId", label: "Plans", options: (plans.data?.items ?? []).map((p) => ({ value: p.id, label: p.name })) }]} values={{ planId }} onFilter={(_, v) => setPlanId(v)} />}
        empty={<EmptyState icon={<Repeat className="h-6 w-6" />} title="No subscriptions match" description="Change the filters or create a new subscription." />}
        columns={[
          { key: "number", header: "Number", cell: (r) => <span className="font-mono text-xs font-medium text-ink">{r.number}</span> },
          { key: "customer", header: "Customer", cell: (r) => <span className="font-medium text-ink">{r.customerName}</span> },
          { key: "plan", header: "Plan", hideOnMobile: true, cell: (r) => r.planName },
          { key: "amount", header: "Recurring", align: "right", cell: (r) => <span>{money(r.recurringAmount)}<span className="text-xs text-ink-muted">{intervalText(r.interval, r.intervalCount)}</span></span> },
          { key: "start", header: "Start", hideOnMobile: true, cell: (r) => date(r.startDate) },
          { key: "next", header: "Next invoice", hideOnMobile: true, cell: (r) => date(r.nextBillingDate) },
          { key: "status", header: "Status", cell: (r) => <span className="flex items-center gap-1"><StatusPill status={r.status} />{r.pastDue && <Badge tone="red">Past due</Badge>}</span> },
        ]} />
    </div>
  );
}
