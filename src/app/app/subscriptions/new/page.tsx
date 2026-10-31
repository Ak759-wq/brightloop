"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError, useApi } from "@/lib/client/api";
import { useAuth } from "@/lib/client/auth";
import { PageHeader } from "@/components/shell/AppShell";
import { Button, Card, Field, Input, Select, Textarea, Callout } from "@/components/ui/primitives";
import { LineItemsEditor, PriceSummary, usePreview, type LineInput } from "@/components/billing/lines";
import { useToast } from "@/components/ui/toast";
import { intervalText, stateName } from "@/lib/client/format";
import { cn } from "@/lib/client/cn";

interface Plan { id: string; name: string; productId: string; minQuantity: number; interval: string; intervalCount: number; termPeriods: number | null; active: boolean }
interface Customer { id: string; name: string; placeOfSupply: string | null }
interface Discount { id: string; name: string; active: boolean }

function NewSub() {
  const sp = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const { user, org } = useAuth();
  const plans = useApi<{ items: Plan[] }>("/api/r/plans?active=true&limit=100");
  const customers = useApi<{ items: Customer[] }>("/api/r/customers?status=active&limit=100&orderBy=name&dir=asc");
  const discounts = useApi<{ items: Discount[] }>("/api/r/discounts?active=true&limit=100");
  const [customerId, setCustomerId] = useState(sp.get("customerId") ?? "");
  const [planId, setPlanId] = useState("");
  const [lines, setLines] = useState<LineInput[]>([]);
  const [discountIds, setDiscountIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState("");
  const [terms, setTerms] = useState("");
  const [notes, setNotes] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const plan = plans.data?.items.find((p) => p.id === planId);
  const customer = customers.data?.items.find((c) => c.id === customerId);
  useEffect(() => { if (plan) setLines([{ productId: plan.productId, variantIds: [], addonIds: [], quantity: plan.minQuantity }]); }, [planId]);
  useEffect(() => { if (org && !startDate) setStartDate(org.today); }, [org]);
  const { data, error } = usePreview(planId, customerId, lines, discountIds);
  async function save(status: "draft" | "quotation") {
    setBusy(status); setErrors({});
    try {
      const s = await api<{ id: string; number: string }>("/api/subscriptions", { body: { customerId, planId, items: lines, discountIds, startDate: startDate || null, paymentTermsDays: terms ? Number(terms) : undefined, notes, status, quoteValidUntil: status === "quotation" ? validUntil || null : null } });
      toast.success(`${s.number} created`, status === "quotation" ? "Saved as quotation" : "Saved as draft");
      router.push(`/app/subscriptions/${s.id}`);
    } catch (e) {
      if (e instanceof ApiError && e.fields) setErrors(e.fields);
      toast.error("Could not create subscription", (e as Error).message);
    } finally { setBusy(null); }
  }
  return (
    <div>
      <PageHeader title="New subscription" description="Pick a customer and plan; pricing, discounts and GST are calculated live by the billing engine." />
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Card className="space-y-5 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Customer" id="cust" error={errors.customerId}><Select id="cust" value={customerId} onChange={(e) => setCustomerId(e.target.value)} options={(customers.data?.items ?? []).map((c) => ({ value: c.id, label: c.name }))} placeholder="Choose customer" /></Field>
            <Field label="Plan" id="plan" error={errors.planId}><Select id="plan" value={planId} onChange={(e) => setPlanId(e.target.value)} options={(plans.data?.items ?? []).map((p) => ({ value: p.id, label: `${p.name} (${p.interval})` }))} placeholder="Choose plan" /></Field>
          </div>
          {customer && !customer.placeOfSupply && <Callout tone="amber">This customer has no GST place of supply. You can save a draft, but activation will be refused until it&apos;s set.</Callout>}
          {customer?.placeOfSupply && <p className="text-xs text-ink-muted">Place of supply: {stateName(customer.placeOfSupply)} → {customer.placeOfSupply === org?.sellerState ? "CGST + SGST" : "IGST"}</p>}
          {plan && (<>
            <div><p className="mb-2 text-xs font-medium text-slate-700">Lines {plan.minQuantity > 1 && <span className="font-normal text-ink-muted">(minimum {plan.minQuantity} units on the plan product)</span>}</p><LineItemsEditor lines={lines} onChange={setLines} lockFirstProduct minQuantity={plan.minQuantity} /></div>
            {user?.role !== "customer" && (
              <div>
                <p className="mb-2 text-xs font-medium text-slate-700">Discounts</p>
                <div className="flex flex-wrap gap-2">
                  {(discounts.data?.items ?? []).map((d) => { const on = discountIds.includes(d.id); return <button type="button" key={d.id} aria-pressed={on} onClick={() => setDiscountIds(on ? discountIds.filter((x) => x !== d.id) : [...discountIds, d.id])} className={cn("rounded-full border px-3 py-1 text-xs", on ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-200 hover:bg-slate-50")}>{d.name}</button>; })}
                </div>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Start date" id="start"><Input id="start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Field>
              <Field label="Payment terms (days)" id="terms" hint="Default 15"><Input id="terms" type="number" min={0} value={terms} onChange={(e) => setTerms(e.target.value)} /></Field>
              <Field label="Quotation valid until" id="valid"><Input id="valid" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} /></Field>
            </div>
            <Field label="Notes" id="notes"><Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
          </>)}
        </Card>
        <div className="space-y-4">
          <Card className="sticky top-20 p-5">
            <p className="mb-4 text-sm font-semibold">Price preview</p>
            <PriceSummary data={data} error={error} intervalLabel={plan ? intervalText(plan.interval, plan.intervalCount) : undefined} />
            <div className="mt-6 flex flex-col gap-2">
              <Button loading={busy === "quotation"} disabled={!customerId || !planId} onClick={() => save("quotation")}>Save as quotation</Button>
              <Button variant="secondary" loading={busy === "draft"} disabled={!customerId || !planId} onClick={() => save("draft")}>Save draft</Button>
            </div>
            <p className="mt-3 text-xs text-ink-muted">Next: confirm → activate. Activation generates the first invoice immediately.</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
export default function Page() { return <Suspense><NewSub /></Suspense>; }
