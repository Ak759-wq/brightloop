"use client";
import Link from "next/link";
import { useState } from "react";
import { Mail, Pencil, Phone, Plus, Wallet } from "lucide-react";
import { useApi } from "@/lib/client/api";
import { PageHeader } from "@/components/shell/AppShell";
import { Badge, Button, Card, CardHeader, Callout, DescList, EmptyState, ErrorNote, Skeleton, StatusPill } from "@/components/ui/primitives";
import { ResourceFormModal } from "@/components/crud";
import { customerFields } from "@/components/customerFields";
import { date, money, stateName } from "@/lib/client/format";
import { useAuth } from "@/lib/client/auth";

interface Customer { id: string; name: string; email: string; phone: string; company: string; gstin: string; billingAddress: string; city: string; placeOfSupply: string | null; tags: string[]; creditBalance: number; status: string; createdAt: string }

export default function CustomerDetail({ params }: { params: { id: string } }) {
  const { org } = useAuth();
  const c = useApi<Customer>(`/api/r/customers/${params.id}`);
  const subs = useApi<{ items: { id: string; number: string; planName: string; status: string; recurringAmount: number; nextBillingDate: string | null }[] }>(`/api/r/subscriptions?customerId=${params.id}&limit=50`);
  const invs = useApi<{ items: { id: string; number: string; status: string; total: number; amountPaid: number; dueDate: string; invoiceDate: string }[] }>(`/api/r/invoices?customerId=${params.id}&limit=10`);
  const contacts = useApi<{ items: { id: string; name: string; email: string; role: string }[] }>(`/api/r/customer_contacts?customerId=${params.id}&limit=20`);
  const wallet = useApi<{ items: { balance: number; lastTopUp: number }[] }>(`/api/r/credit_wallets?customerId=${params.id}&limit=1`);
  const [edit, setEdit] = useState(false);
  const [addContact, setAddContact] = useState(false);
  if (c.error) return <ErrorNote message={c.error} onRetry={c.reload} />;
  if (!c.data) return <Skeleton className="h-64 w-full" />;
  const cu = c.data;
  return (
    <div className="space-y-6">
      <PageHeader title={cu.name} description={<span className="flex flex-wrap items-center gap-3"><span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{cu.email}</span>{cu.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{cu.phone}</span>}{cu.tags?.map((t) => <Badge key={t} tone={t === "at-risk" ? "red" : "slate"}>{t}</Badge>)}</span>}
        actions={<><Button variant="secondary" icon={<Pencil className="h-4 w-4" />} onClick={() => setEdit(true)}>Edit</Button><Link href={`/app/subscriptions/new?customerId=${cu.id}`}><Button icon={<Plus className="h-4 w-4" />}>New subscription</Button></Link></>} />
      {!cu.placeOfSupply && <Callout tone="amber" title="Place of supply missing">Taxable invoices for this customer will be refused until a GST state is set. Brightloop never guesses tax jurisdiction.</Callout>}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <DescList cols={3} items={[
            { label: "Legal name", value: cu.company || "—" }, { label: "GSTIN", value: cu.gstin || "—" }, { label: "Place of supply", value: stateName(cu.placeOfSupply) },
            { label: "Tax treatment", value: cu.placeOfSupply ? (cu.placeOfSupply === org?.sellerState ? "Intra-state (CGST + SGST)" : "Inter-state (IGST)") : "Unknown" },
            { label: "Address", value: [cu.billingAddress, cu.city].filter(Boolean).join(", ") || "—" }, { label: "Customer since", value: date(cu.createdAt) },
          ]} />
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700"><Wallet className="h-4 w-4" />Balances</div>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-ink-muted">Account credit</span><b>{money(cu.creditBalance)}</b></div>
            <div className="flex justify-between"><span className="text-ink-muted">Usage credits</span><b>{wallet.data?.items[0]?.balance ?? 0}</b></div>
            <div className="flex justify-between"><span className="text-ink-muted">Outstanding</span><b>{money((invs.data?.items ?? []).filter((i) => !["draft", "cancelled"].includes(i.status)).reduce((s, i) => s + Math.max(0, i.total - i.amountPaid), 0))}</b></div>
          </div>
        </Card>
      </div>
      <Card>
        <CardHeader title="Subscriptions" />
        <div className="mt-3 divide-y divide-slate-100">
          {(subs.data?.items ?? []).map((s) => (
            <Link key={s.id} href={`/app/subscriptions/${s.id}`} className="flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-slate-50">
              <span><b className="font-mono text-xs">{s.number}</b> <span className="ml-2">{s.planName}</span></span>
              <span className="flex items-center gap-4"><span className="tabular-nums">{money(s.recurringAmount)}</span><span className="hidden text-xs text-ink-muted sm:inline">Next {date(s.nextBillingDate)}</span><StatusPill status={s.status} /></span>
            </Link>
          ))}
          {subs.data && !subs.data.items.length && <EmptyState title="No subscriptions" />}
        </div>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Recent invoices" actions={<Link className="text-xs font-medium text-brand-600" href={`/app/invoices?customerId=${cu.id}`}>View all</Link>} />
          <div className="mt-3 divide-y divide-slate-100">
            {(invs.data?.items ?? []).map((i) => (
              <Link key={i.id} href={`/app/invoices/${i.id}`} className="flex items-center justify-between px-5 py-3 text-sm hover:bg-slate-50">
                <span className="font-mono text-xs">{i.number}</span><span className="text-xs text-ink-muted">{date(i.invoiceDate)}</span><span className="tabular-nums">{money(i.total)}</span><StatusPill status={i.status} />
              </Link>
            ))}
            {invs.data && !invs.data.items.length && <EmptyState title="No invoices yet" />}
          </div>
        </Card>
        <Card>
          <CardHeader title="Contacts" actions={<Button size="sm" variant="soft" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setAddContact(true)}>Add</Button>} />
          <div className="mt-3 divide-y divide-slate-100">
            {(contacts.data?.items ?? []).map((ct) => <div key={ct.id} className="flex justify-between px-5 py-3 text-sm"><span><b>{ct.name}</b> <span className="text-ink-muted">· {ct.role}</span></span><span className="text-ink-muted">{ct.email}</span></div>)}
            {contacts.data && !contacts.data.items.length && <EmptyState title="No contacts" />}
          </div>
        </Card>
      </div>
      <ResourceFormModal open={edit} onClose={() => setEdit(false)} collection="customers" title="Edit customer" fields={customerFields} doc={cu as never} onSaved={() => c.reload()} />
      <ResourceFormModal open={addContact} onClose={() => setAddContact(false)} collection="customer_contacts" title="Add contact"
        fields={[{ name: "customerId", label: "Customer", type: "select", options: [{ value: cu.id, label: cu.name }] }, { name: "name", label: "Name", type: "text" }, { name: "email", label: "Email", type: "email" }, { name: "phone", label: "Phone", type: "text" }, { name: "role", label: "Role", type: "text", placeholder: "Finance" }]}
        defaults={{ customerId: cu.id }} onSaved={() => contacts.reload()} />
    </div>
  );
}
