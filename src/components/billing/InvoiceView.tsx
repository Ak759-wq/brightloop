"use client";
import Link from "next/link";
import { useState } from "react";
import { BadgeCheck, Ban, CreditCard, Download, FileMinus2, FlaskConical, Printer, Send, Undo2 } from "lucide-react";
import { api, useApi } from "@/lib/client/api";
import { useAuth } from "@/lib/client/auth";
import type { Invoice } from "@/lib/types";
import { canDo } from "@/lib/permissions";
import { bpToPct, date, dateTime, money, stateName } from "@/lib/client/format";
import { PageHeader } from "../shell/AppShell";
import { Badge, Button, Callout, Card, CardHeader, EmptyState, ErrorNote, Field, Input, Select, Skeleton, StatusPill, Textarea } from "../ui/primitives";
import { Modal, useConfirm } from "../ui/overlay";
import { useToast } from "../ui/toast";
import { downloadInvoicePdf } from "./pdf";
import { cn } from "@/lib/client/cn";

export const owedOf = (i: Pick<Invoice, "total" | "creditNoted" | "amountPaid" | "amountRefunded">) => Math.max(0, i.total - i.creditNoted - (i.amountPaid - i.amountRefunded));

interface Payment { id: string; reference: string; method: string; amount: number; amountRefunded: number; date: string; note: string; recordedBy: string }
interface Attempt { id: string; status: string; amount: number; reason?: string; attempt: number; createdAt: string; method?: string }

export function InvoiceView({ id, portal = false }: { id: string; portal?: boolean }) {
  const { user, org } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const inv = useApi<Invoice>(`/api/r/invoices/${id}`);
  const payments = useApi<{ items: Payment[] }>(`/api/r/payments?invoiceId=${id}&limit=50`);
  const attempts = useApi<{ items: Attempt[] }>(`/api/r/payment_attempts?invoiceId=${id}&limit=50`);
  const notes = useApi<{ items: { id: string; number: string; amount: number; reason: string; createdAt: string }[] }>(`/api/r/credit_notes?invoiceId=${id}&limit=20`);
  const [busy, setBusy] = useState<string | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [simOpen, setSimOpen] = useState(false);
  const [cnOpen, setCnOpen] = useState(false);
  const [refund, setRefund] = useState<Payment | null>(null);
  const reload = () => { inv.reload(); payments.reload(); attempts.reload(); notes.reload(); };
  if (inv.error) return <ErrorNote message={inv.error} onRetry={inv.reload} />;
  if (!inv.data || !user) return <div className="space-y-4"><Skeleton className="h-10 w-72" /><Skeleton className="h-[480px] w-full" /></div>;
  const i = inv.data;
  const owed = owedOf(i);
  const payable = !["draft", "cancelled", "paid"].includes(i.status) && owed > 0;
  const role = user.role;
  async function act(action: "confirm" | "cancel" | "send") {
    let reason: string | undefined;
    if (action === "cancel") {
      const r = await confirm({ title: `Cancel ${i.number}?`, body: "Cancelled invoices stay on record for audit but are no longer payable.", confirmLabel: "Cancel invoice", danger: true, requireReason: true });
      if (!r.ok) return; reason = r.reason;
    }
    if (action === "confirm") {
      const r = await confirm({ title: `Confirm ${i.number}?`, body: "Confirmed invoices are immutable. Corrections are made with credit notes.", confirmLabel: "Confirm invoice" });
      if (!r.ok) return;
    }
    setBusy(action);
    try {
      const r = await api<{ detail?: string }>(`/api/invoices/${id}/action`, { body: { action, reason } });
      toast.success(action === "send" ? "Invoice sent" : action === "confirm" ? "Invoice confirmed" : "Invoice cancelled", r.detail);
      reload();
    } catch (e) { toast.error("Action failed", (e as Error).message); } finally { setBusy(null); }
  }
  const sameState = i.customer.placeOfSupply === i.seller.state;
  return (
    <div className="space-y-6">
      <div className="no-print">
        <PageHeader title={i.number} description={<span className="flex flex-wrap items-center gap-2"><StatusPill status={i.status} />{i.kind !== "recurring" && <Badge tone="violet">{i.kind}</Badge>}{i.demoClock && <Badge tone="violet">Demo clock</Badge>}<span>{i.customer.name}</span>{i.sentAt && <span className="text-xs">· sent {dateTime(i.sentAt)}</span>}</span>}
          actions={<>
            {!portal && i.status === "draft" && canDo(role, "invoice.confirm") && <Button loading={busy === "confirm"} icon={<BadgeCheck className="h-4 w-4" />} onClick={() => act("confirm")}>Confirm</Button>}
            {!portal && !["draft", "cancelled"].includes(i.status) && <Button variant="secondary" loading={busy === "send"} icon={<Send className="h-4 w-4" />} onClick={() => act("send")}>Send</Button>}
            {!portal && payable && canDo(role, "payment.record") && <Button icon={<CreditCard className="h-4 w-4" />} onClick={() => setPayOpen(true)}>Record payment</Button>}
            {payable && <Button variant={portal ? "primary" : "outline"} icon={portal ? <CreditCard className="h-4 w-4" /> : <FlaskConical className="h-4 w-4" />} onClick={() => setSimOpen(true)}>{portal ? `Pay ${money(owed)}` : "Payment simulator"}</Button>}
            <Button variant="secondary" icon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>Print</Button>
            <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={() => downloadInvoicePdf(i)}>PDF</Button>
            {!portal && canDo(role, "invoice.credit_note") && !["draft", "cancelled"].includes(i.status) && <Button variant="ghost" icon={<FileMinus2 className="h-4 w-4" />} onClick={() => setCnOpen(true)}>Credit note</Button>}
            {!portal && i.status !== "cancelled" && i.amountPaid - i.amountRefunded === 0 && canDo(role, "invoice.cancel") && <Button variant="ghost" className="text-rose-600 hover:bg-rose-50" loading={busy === "cancel"} icon={<Ban className="h-4 w-4" />} onClick={() => act("cancel")}>Cancel</Button>}
          </>} />
        {i.status === "overdue" && <Callout tone="red" title="Overdue">This invoice was due on {date(i.dueDate)}. {i.failedAttempts > 0 && `${i.failedAttempts} failed payment attempt(s).`} {i.nextRetryOn && `Next reminder ${date(i.nextRetryOn)}.`} {i.dunningExhausted && "All retries are exhausted – staff have been alerted."}</Callout>}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <Card className="print-area overflow-hidden">
          <div className="flex flex-col gap-6 border-b border-slate-100 p-8 sm:flex-row sm:justify-between">
            <div>
              <p className="text-lg font-semibold">{i.seller.name}</p>
              <p className="mt-1 max-w-xs text-xs leading-relaxed text-ink-muted">{i.seller.address}</p>
              <p className="mt-1 text-xs text-ink-muted">GSTIN {i.seller.gstin} · {stateName(i.seller.state)}</p>
            </div>
            <div className="sm:text-right">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">Tax invoice</p>
              <p className="mt-1 font-mono text-lg font-semibold">{i.number}</p>
              <p className="mt-2 text-xs text-ink-muted">Issued {date(i.invoiceDate)} · Due <b className="text-ink">{date(i.dueDate)}</b></p>
              {i.periodStart && <p className="text-xs text-ink-muted">Service period {date(i.periodStart)} – {date(i.periodEnd)}</p>}
            </div>
          </div>
          <div className="grid gap-6 border-b border-slate-100 px-8 py-6 sm:grid-cols-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-soft">Bill to</p>
              <p className="mt-1 font-semibold">{i.customer.name}</p>
              <p className="text-xs text-ink-muted">{i.customer.email}</p>
              {i.customer.address && <p className="text-xs text-ink-muted">{i.customer.address}</p>}
              {i.customer.gstin && <p className="text-xs text-ink-muted">GSTIN {i.customer.gstin}</p>}
            </div>
            <div className="sm:text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-soft">Place of supply</p>
              <p className="mt-1 text-sm font-medium">{stateName(i.customer.placeOfSupply)}</p>
              <p className="text-xs text-ink-muted">{i.totals.taxTotal ? (sameState ? "Intra-state: CGST + SGST" : "Inter-state: IGST") : "No tax"}</p>
              {i.subscriptionNumber && <p className="mt-1 text-xs text-ink-muted">Subscription {portal ? i.subscriptionNumber : <Link className="text-brand-600 hover:underline" href={`/app/subscriptions/${i.subscriptionId}`}>{i.subscriptionNumber}</Link>}</p>}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm">
              <thead><tr className="text-left text-xs text-ink-muted"><th className="px-8 py-3 font-medium">Description</th><th className="px-3 py-3 text-right font-medium">Qty</th><th className="px-3 py-3 text-right font-medium">Unit</th><th className="px-3 py-3 text-right font-medium">Discount</th><th className="px-3 py-3 text-right font-medium">Tax</th><th className="px-8 py-3 text-right font-medium">Taxable</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {i.items.map((it, k) => (
                  <tr key={k}>
                    <td className="px-8 py-3"><p className="font-medium text-ink">{it.description}</p>{it.periodStart && <p className="text-xs text-ink-muted">{date(it.periodStart)} – {date(it.periodEnd)}</p>}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{it.quantity}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{money(it.unitPrice)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-emerald-700">{it.discount ? `− ${money(it.discount)}` : "—"}</td>
                    <td className="px-3 py-3 text-right text-xs text-ink-muted">{it.supply === "none" ? "—" : `${it.supply === "intra" ? "CGST+SGST" : "IGST"} ${bpToPct(it.taxRateBp)}`}<br />{money(it.tax)}</td>
                    <td className="px-8 py-3 text-right tabular-nums">{money(it.taxable)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end border-t border-slate-100 px-8 py-6">
            <dl className="w-full max-w-xs space-y-1.5 text-sm">
              <Row k="Subtotal" v={money(i.totals.subtotal)} />
              {i.discountsApplied.map((d) => <Row key={d.id} k={d.name} v={`− ${money(d.amount)}`} green />)}
              <Row k="Taxable value" v={money(i.totals.taxableTotal)} />
              {i.totals.cgst > 0 && <Row k="CGST" v={money(i.totals.cgst)} />}
              {i.totals.sgst > 0 && <Row k="SGST" v={money(i.totals.sgst)} />}
              {i.totals.igst > 0 && <Row k="IGST" v={money(i.totals.igst)} />}
              <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{money(i.totals.total)}</dd></div>
              {i.creditNoted > 0 && <Row k="Credits applied" v={`− ${money(i.creditNoted)}`} green />}
              <Row k="Paid" v={`− ${money(i.amountPaid - i.amountRefunded)}`} />
              <div className={cn("flex justify-between rounded-lg px-2 py-1.5 font-semibold", owed ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-800")}><dt>Balance due</dt><dd className="tabular-nums">{money(owed)}</dd></div>
            </dl>
          </div>
          <p className="px-8 pb-6 text-[11px] text-ink-soft">Prices, taxes and discounts are frozen at issue time and never recomputed.</p>
        </Card>
        <div className="no-print space-y-6">
          <Card>
            <CardHeader title="Payments" subtitle={`${money(i.amountPaid)} received`} />
            <ul className="mt-3 divide-y divide-slate-100">
              {(payments.data?.items ?? []).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 px-5 py-3 text-sm">
                  <span><b className="tabular-nums">{money(p.amount)}</b> <span className="text-xs capitalize text-ink-muted">· {p.method.replace("_", " ")}</span><span className="block text-xs text-ink-muted">{date(p.date)} · {p.reference}{p.amountRefunded ? ` · refunded ${money(p.amountRefunded)}` : ""}</span></span>
                  {!portal && canDo(role, "payment.refund") && p.amount > p.amountRefunded && <Button size="sm" variant="ghost" icon={<Undo2 className="h-3.5 w-3.5" />} onClick={() => setRefund(p)}>Refund</Button>}
                </li>
              ))}
              {payments.data && !payments.data.items.length && <li><EmptyState title="No payments yet" /></li>}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Payment attempts" subtitle="Includes failed and dunning reminders" />
            <ul className="mt-3 divide-y divide-slate-100 pb-2">
              {(attempts.data?.items ?? []).map((a) => (
                <li key={a.id} className="px-5 py-2.5 text-xs"><div className="flex items-center justify-between"><StatusPill status={a.status} /><span className="text-ink-muted">{dateTime(a.createdAt)}</span></div>{a.reason && <p className="mt-1 text-ink-muted">{a.reason}</p>}</li>
              ))}
              {attempts.data && !attempts.data.items.length && <li className="px-5 py-4 text-xs text-ink-muted">No attempts.</li>}
            </ul>
          </Card>
          {!!notes.data?.items.length && (
            <Card>
              <CardHeader title="Credit notes" />
              <ul className="mt-3 divide-y divide-slate-100 pb-2">{notes.data.items.map((n) => <li key={n.id} className="px-5 py-2.5 text-xs"><b>{n.number}</b> · {money(n.amount)}<p className="text-ink-muted">{n.reason}</p></li>)}</ul>
            </Card>
          )}
        </div>
      </div>
      {payOpen && <RecordPaymentModal invoice={i} owed={owed} today={org?.today ?? ""} onClose={() => setPayOpen(false)} onDone={reload} />}
      {simOpen && <SimulatorModal invoice={i} owed={owed} portal={portal} onClose={() => setSimOpen(false)} onDone={reload} />}
      {cnOpen && <AmountReasonModal title="Issue credit note" description={`Reduces what ${i.customer.name} owes. Max ${money(i.total - i.creditNoted)}.`} max={i.total - i.creditNoted} url={`/api/invoices/${id}/action`} extra={{ action: "credit_note" }} onClose={() => setCnOpen(false)} onDone={reload} />}
      {refund && <AmountReasonModal title={`Refund ${refund.reference}`} description={`Up to ${money(refund.amount - refund.amountRefunded)}. Refunds re-open the outstanding balance.`} max={refund.amount - refund.amountRefunded} url={`/api/payments/${refund.id}/refund`} onClose={() => setRefund(null)} onDone={reload} />}
    </div>
  );
}

function Row({ k, v, green }: { k: string; v: string; green?: boolean }) {
  return <div className={cn("flex justify-between", green ? "text-emerald-700" : "text-slate-600")}><dt>{k}</dt><dd className="tabular-nums">{v}</dd></div>;
}

export function RecordPaymentModal({ invoice, owed, today, onClose, onDone }: { invoice: Invoice; owed: number; today: string; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ method: "upi", amount: String(owed / 100), date: today, note: "", reference: "" });
  const [busy, setBusy] = useState(false);
  const amt = Math.round(Number(f.amount) * 100);
  const err = !amt || amt <= 0 ? "Enter an amount" : amt > owed ? `Max ${money(owed)}` : undefined;
  return (
    <Modal open onClose={onClose} title={`Record payment · ${invoice.number}`} description={`Outstanding ${money(owed)}`} size="md"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={busy} disabled={!!err} onClick={async () => {
        setBusy(true);
        try { await api("/api/payments", { body: { invoiceId: invoice.id, method: f.method, amount: amt, date: f.date, note: f.note, reference: f.reference } }); toast.success("Payment recorded", amt < owed ? `Partially paid – ${money(owed - amt)} still outstanding` : "Invoice fully paid"); onDone(); onClose(); }
        catch (e) { toast.error("Could not record payment", (e as Error).message); } finally { setBusy(false); }
      }}>Record {amt > 0 ? money(amt) : ""}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Method" id="pm"><Select id="pm" value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })} options={[{ value: "upi", label: "UPI" }, { value: "bank_transfer", label: "Bank transfer (NEFT/RTGS)" }, { value: "card", label: "Card" }, { value: "cash", label: "Cash" }, { value: "cheque", label: "Cheque" }]} /></Field>
        <Field label="Amount (₹)" id="pa" error={err}><Input id="pa" type="number" step="0.01" min="0" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
        <Field label="Payment date" id="pd"><Input id="pd" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        <Field label="Reference" id="pr" hint="UTR / cheque no."><Input id="pr" value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} /></Field>
        <div className="sm:col-span-2"><Field label="Note" id="pn"><Textarea id="pn" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field></div>
      </div>
    </Modal>
  );
}

export function SimulatorModal({ invoice, owed, portal, onClose, onDone }: { invoice: Invoice; owed: number; portal: boolean; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [outcome, setOutcome] = useState<"success" | "partial" | "fail">("success");
  const [partial, setPartial] = useState(String(Math.floor(owed / 2) / 100));
  const [reason, setReason] = useState("Card declined by issuer");
  const [busy, setBusy] = useState(false);
  return (
    <Modal open onClose={onClose} title={portal ? `Pay ${invoice.number}` : `Payment simulator · ${invoice.number}`} size="md"
      description={<span className="inline-flex items-center gap-1.5"><FlaskConical className="h-3.5 w-3.5" />Simulated gateway – no real money moves. Razorpay plugs in here when keys are configured.</span>}
      footer={<><Button variant="secondary" onClick={onClose}>Close</Button><Button loading={busy} variant={outcome === "fail" ? "danger" : "primary"} onClick={async () => {
        setBusy(true);
        try {
          const r = await api<{ outcome: string; reason?: string; nextRetryOn?: string | null }>("/api/payments/simulate", { body: { invoiceId: invoice.id, outcome, reason: outcome === "fail" ? reason : undefined, amount: outcome === "partial" ? Math.round(Number(partial) * 100) : undefined } });
          if (r.outcome === "fail") toast.error("Payment failed (simulated)", `${r.reason}. ${r.nextRetryOn ? `Retry reminder scheduled ${r.nextRetryOn}.` : "Retries exhausted."}`);
          else toast.success(r.outcome === "partial" ? "Partial payment captured" : "Payment successful");
          onDone(); onClose();
        } catch (e) { toast.error("Simulator error", (e as Error).message); } finally { setBusy(false); }
      }}>{outcome === "fail" ? "Simulate failure" : outcome === "partial" ? "Pay part" : `Pay ${money(owed)}`}</Button></>}>
      <div className="space-y-3">
        {(["success", "partial", "fail"] as const).map((o) => (
          <label key={o} className={cn("flex cursor-pointer items-start gap-3 rounded-xl border p-3", outcome === o ? "border-brand-500 bg-brand-50/50" : "border-slate-200")}>
            <input type="radio" name="outcome" className="mt-1 accent-brand-600" checked={outcome === o} onChange={() => setOutcome(o)} />
            <span className="text-sm"><b>{o === "success" ? "Success – full amount" : o === "partial" ? "Partial payment" : "Fail with reason"}</b>
              <span className="block text-xs text-ink-muted">{o === "success" ? `Captures ${money(owed)} and marks the invoice paid.` : o === "partial" ? "Captures part of the balance; invoice becomes partially paid." : "Records a failed attempt, notifies, schedules a dunning retry. Never marks paid."}</span>
            </span>
          </label>
        ))}
        {outcome === "partial" && <Field label="Amount (₹)" id="sp"><Input id="sp" type="number" step="0.01" value={partial} onChange={(e) => setPartial(e.target.value)} /></Field>}
        {outcome === "fail" && <Field label="Failure reason" id="sr"><Select id="sr" value={reason} onChange={(e) => setReason(e.target.value)} options={["Card declined by issuer", "Insufficient funds", "UPI mandate expired", "Bank server timeout", "Authentication (3-D Secure) failed"].map((x) => ({ value: x, label: x }))} /></Field>}
      </div>
    </Modal>
  );
}

function AmountReasonModal({ title, description, max, url, extra = {}, onClose, onDone }: { title: string; description: string; max: number; url: string; extra?: Record<string, unknown>; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const amt = Math.round(Number(amount) * 100);
  const err = amount && (amt <= 0 || amt > max) ? `Between ₹0.01 and ${money(max)}` : undefined;
  return (
    <Modal open onClose={onClose} title={title} description={description} size="sm"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={busy} disabled={!amt || !!err || !reason.trim()} onClick={async () => {
        setBusy(true);
        try { await api(url, { body: { ...extra, amount: amt, reason } }); toast.success("Done"); onDone(); onClose(); } catch (e) { toast.error("Failed", (e as Error).message); } finally { setBusy(false); }
      }}>Confirm</Button></>}>
      <div className="space-y-4">
        <Field label="Amount (₹)" id="ar-a" error={err}><Input id="ar-a" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <Field label="Reason" id="ar-r"><Textarea id="ar-r" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}
