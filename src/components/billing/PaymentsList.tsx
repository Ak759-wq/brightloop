"use client";
import Link from "next/link";
import { useState } from "react";
import { CreditCard, Plus } from "lucide-react";
import { useApi, useList } from "@/lib/client/api";
import { useAuth } from "@/lib/client/auth";
import type { Invoice } from "@/lib/types";
import { PageHeader } from "@/components/shell/AppShell";
import { Button, EmptyState, Field, Select, Tabs, Badge, StatusPill } from "@/components/ui/primitives";
import { DataTable, Toolbar, useDebounced } from "@/components/ui/table";
import { Modal } from "@/components/ui/overlay";
import { RecordPaymentModal, owedOf } from "@/components/billing/InvoiceView";
import { date, dateTime, money, cap } from "@/lib/client/format";

interface Payment { id: string; reference: string; invoiceId: string; invoiceNumber: string; customerName: string; method: string; amount: number; amountRefunded: number; date: string; note: string; recordedBy: string }
interface Refund { id: string; invoiceNumber: string; customerName: string; amount: number; reason: string; createdAt: string }
interface Attempt { id: string; invoiceId: string; invoiceNumber: string; status: string; amount: number; reason?: string; createdAt: string }

export function PaymentsList({ portal = false }: { portal?: boolean }) {
  const { user, org } = useAuth();
  const [tab, setTab] = useState("payments");
  const [q, setQ] = useState("");
  const [method, setMethod] = useState("");
  const dq = useDebounced(q);
  const payments = useList<Payment>("payments", { q: dq, method });
  const refunds = useList<Refund>("refunds", {});
  const attempts = useList<Attempt>("payment_attempts", { status: "failed" });
  const open = useApi<{ items: Invoice[] }>(portal ? null : "/api/r/invoices?status=__in_open&limit=100");
  const [pick, setPick] = useState(false);
  const [invId, setInvId] = useState("");
  const [recording, setRecording] = useState<Invoice | null>(null);
  const base = portal ? "/portal" : "/app";
  return (
    <div>
      <PageHeader title="Payments" description={portal ? "Payments you have made." : "Every payment with method, amount, date and note against the right invoice."} actions={!portal && user?.role !== "customer" ? <Button icon={<Plus className="h-4 w-4" />} onClick={() => setPick(true)}>Record payment</Button> : undefined} />
      <div className="mb-4"><Tabs value={tab} onChange={setTab} tabs={[{ value: "payments", label: "Payments" }, { value: "failed", label: "Failed attempts" }, { value: "refunds", label: "Refunds" }]} /></div>
      {tab === "payments" && (
        <DataTable list={payments}
          toolbar={<Toolbar search={q} onSearch={setQ} placeholder="Search reference, invoice or customer…" filters={[{ key: "method", label: "Methods", options: ["upi", "bank_transfer", "card", "cash", "cheque", "simulator", "razorpay"].map((m) => ({ value: m, label: cap(m) })) }]} values={{ method }} onFilter={(_, v) => setMethod(v)} />}
          empty={<EmptyState icon={<CreditCard className="h-6 w-6" />} title="No payments recorded" />}
          columns={[
            { key: "r", header: "Reference", cell: (r) => <span className="font-mono text-xs">{r.reference}</span> },
            { key: "i", header: "Invoice", cell: (r) => <Link className="font-mono text-xs text-brand-600 hover:underline" href={`${base}/invoices/${r.invoiceId}`}>{r.invoiceNumber}</Link> },
            ...(portal ? [] : [{ key: "c", header: "Customer", cell: (r: Payment) => <span className="font-medium">{r.customerName}</span> }]),
            { key: "m", header: "Method", cell: (r) => <span><Badge tone={r.method === "simulator" ? "violet" : "slate"}>{cap(r.method)}</Badge>{r.method === "simulator" && <span className="ml-1 text-[11px] text-violet-700">Simulated</span>}</span> },
            { key: "d", header: "Date", cell: (r) => date(r.date) },
            { key: "n", header: "Note", hideOnMobile: true, cell: (r) => <span className="line-clamp-1 max-w-[200px] text-xs text-ink-muted">{r.note || "—"}</span> },
            { key: "a", header: "Amount", align: "right", cell: (r) => <span>{money(r.amount)}{r.amountRefunded > 0 && <span className="block text-xs text-rose-600">−{money(r.amountRefunded)} refunded</span>}</span> },
          ]} />
      )}
      {tab === "failed" && (
        <DataTable list={attempts} empty={<EmptyState title="No failed attempts" />}
          columns={[
            { key: "i", header: "Invoice", cell: (r) => <Link className="font-mono text-xs text-brand-600 hover:underline" href={`${base}/invoices/${r.invoiceId}`}>{r.invoiceNumber}</Link> },
            { key: "s", header: "Status", cell: (r) => <StatusPill status={r.status} /> },
            { key: "re", header: "Reason", cell: (r) => <span className="text-xs">{r.reason}</span> },
            { key: "d", header: "When", cell: (r) => dateTime(r.createdAt) },
            { key: "a", header: "Amount", align: "right", cell: (r) => money(r.amount) },
          ]} />
      )}
      {tab === "refunds" && (
        <DataTable list={refunds} empty={<EmptyState title="No refunds" />}
          columns={[
            { key: "i", header: "Invoice", cell: (r) => <span className="font-mono text-xs">{r.invoiceNumber}</span> },
            ...(portal ? [] : [{ key: "c", header: "Customer", cell: (r: Refund) => r.customerName }]),
            { key: "re", header: "Reason", cell: (r) => r.reason },
            { key: "d", header: "When", cell: (r) => dateTime(r.createdAt) },
            { key: "a", header: "Amount", align: "right", cell: (r) => money(r.amount) },
          ]} />
      )}
      <Modal open={pick} onClose={() => setPick(false)} title="Record payment" description="Choose the invoice the money is for." size="sm"
        footer={<><Button variant="secondary" onClick={() => setPick(false)}>Cancel</Button><Button disabled={!invId} onClick={() => { setRecording(open.data?.items.find((i) => i.id === invId) ?? null); setPick(false); }}>Continue</Button></>}>
        <Field label="Outstanding invoice" id="pinv"><Select id="pinv" value={invId} onChange={(e) => setInvId(e.target.value)} options={(open.data?.items ?? []).map((i) => ({ value: i.id, label: `${i.number} · ${i.customer.name} · ${money(owedOf(i))} due` }))} placeholder="Choose invoice" /></Field>
      </Modal>
      {recording && <RecordPaymentModal invoice={recording} owed={owedOf(recording)} today={org?.today ?? ""} onClose={() => setRecording(null)} onDone={() => { payments.reload(); open.reload(); }} />}
    </div>
  );
}
