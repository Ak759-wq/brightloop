"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FileText } from "lucide-react";
import { useApi, useList } from "@/lib/client/api";
import type { Invoice } from "@/lib/types";
import { PageHeader } from "@/components/shell/AppShell";
import { Badge, EmptyState, StatusPill, Tabs } from "@/components/ui/primitives";
import { DataTable, Toolbar, useDebounced } from "@/components/ui/table";
import { KpiCard } from "@/components/ui/kpi";
import { owedOf } from "@/components/billing/InvoiceView";
import { date, money } from "@/lib/client/format";
import { AlertTriangle, CircleDollarSign, Clock3 } from "lucide-react";

function Inner({ portal = false }: { portal?: boolean }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [tab, setTab] = useState("all");
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const customerId = sp.get("customerId") ?? undefined;
  const statusParam = tab === "all" ? undefined : tab === "open" ? "__in_open" : tab;
  const list = useList<Invoice>("invoices", { q: dq, status: statusParam, customerId });
  const analytics = useApi<{ kpis: { outstanding: number; overdueAmount: number; overdueCount: number; collectedThisMonth: number } }>(portal ? null : "/api/analytics");
  const base = portal ? "/portal" : "/app";
  return (
    <div>
      <PageHeader title="Invoices" description={portal ? "Your invoices. Pay outstanding ones securely from the invoice page." : "Generated from subscriptions with customer details, lines, taxes and totals. Draft → Confirmed → Paid."} />
      {!portal && (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <KpiCard label="Outstanding" icon={<Clock3 className="h-4 w-4" />} value={money(analytics.data?.kpis.outstanding ?? 0, true)} loading={!analytics.data} hint="Confirmed, partially paid and overdue" />
          <KpiCard label="Overdue" tone="danger" icon={<AlertTriangle className="h-4 w-4" />} value={money(analytics.data?.kpis.overdueAmount ?? 0, true)} loading={!analytics.data} hint={`${analytics.data?.kpis.overdueCount ?? 0} invoices past due date`} />
          <KpiCard label="Collected this month" icon={<CircleDollarSign className="h-4 w-4" />} value={money(analytics.data?.kpis.collectedThisMonth ?? 0, true)} loading={!analytics.data} hint="Net of refunds" />
        </div>
      )}
      <div className="mb-4 overflow-x-auto"><Tabs value={tab} onChange={setTab} tabs={[{ value: "all", label: "All" }, { value: "open", label: "Outstanding" }, { value: "overdue", label: "Overdue" }, { value: "partially_paid", label: "Partially paid" }, { value: "paid", label: "Paid" }, { value: "draft", label: "Draft" }, { value: "cancelled", label: "Cancelled" }]} /></div>
      <DataTable list={list} onRowClick={(r) => router.push(`${base}/invoices/${r.id}`)}
        toolbar={<Toolbar search={q} onSearch={setQ} placeholder="Search invoice number or customer…" actions={customerId ? <Badge tone="blue">Filtered by customer</Badge> : undefined} />}
        empty={<EmptyState icon={<FileText className="h-6 w-6" />} title="No invoices" description="Invoices appear here automatically on each billing date." />}
        columns={[
          { key: "n", header: "Invoice", cell: (r) => <div><span className="font-mono text-xs font-medium text-ink">{r.number}</span>{r.kind !== "recurring" && <Badge tone="violet" className="ml-2">{r.kind}</Badge>}</div> },
          ...(portal ? [] : [{ key: "c", header: "Customer", cell: (r: Invoice) => <span className="font-medium text-ink">{r.customer.name}</span> }]),
          { key: "d", header: "Issued", hideOnMobile: true, cell: (r) => date(r.invoiceDate) },
          { key: "due", header: "Due", cell: (r) => date(r.dueDate) },
          { key: "t", header: "Total", align: "right", cell: (r) => money(r.total) },
          { key: "o", header: "Balance", align: "right", cell: (r) => (["draft", "cancelled"].includes(r.status) ? "—" : <span className={owedOf(r) ? "font-medium text-ink" : "text-ink-muted"}>{money(owedOf(r))}</span>) },
          { key: "s", header: "Status", cell: (r) => <StatusPill status={r.status} /> },
        ]} />
    </div>
  );
}
export function InvoicesList({ portal = false }: { portal?: boolean }) { return <Suspense><Inner portal={portal} /></Suspense>; }
