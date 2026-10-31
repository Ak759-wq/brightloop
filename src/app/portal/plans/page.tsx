"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Sparkles } from "lucide-react";
import { api, useApi } from "@/lib/client/api";
import { PageHeader } from "@/components/shell/AppShell";
import { Badge, Button, Card, Field, Input, Skeleton } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { LineItemsEditor, PriceSummary, usePreview, type LineInput } from "@/components/billing/lines";
import { intervalText, money, cap } from "@/lib/client/format";

interface Plan { id: string; name: string; productId: string; description: string; features: string[]; pricingModel: string; price: number; tiers: { upTo: number | null; unitAmount: number }[]; interval: string; intervalCount: number; minQuantity: number }

export default function ExplorePlans() {
  const plans = useApi<{ items: Plan[] }>("/api/r/plans?limit=50");
  const [pick, setPick] = useState<Plan | null>(null);
  const [interval, setInterval] = useState("all");
  const ORDER = ["daily", "weekly", "monthly", "yearly"];
  const list = (plans.data?.items ?? []).filter((p) => interval === "all" || p.interval === interval).sort((a, b) => ORDER.indexOf(a.interval) - ORDER.indexOf(b.interval) || a.name.localeCompare(b.name));
  return (
    <div>
      <PageHeader title="Explore plans" description="Transparent pricing. GST is added based on your state." actions={<div className="flex gap-1 rounded-full border border-slate-200 bg-white p-1">{["all", "monthly", "yearly", "weekly", "daily"].map((i) => <button key={i} onClick={() => setInterval(i)} className={`rounded-full px-3 py-1.5 text-xs font-medium ${interval === i ? "bg-brand-600 text-white" : "text-slate-600"}`}>{cap(i)}</button>)}</div>} />
      {!plans.data ? <div className="grid gap-4 md:grid-cols-3"><Skeleton className="h-72" /><Skeleton className="h-72" /><Skeleton className="h-72" /></div> : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {list.map((p) => (
            <Card key={p.id} className="relative flex flex-col p-6 transition hover:-translate-y-0.5 hover:shadow-lift">
              <Badge tone="blue" className="absolute right-5 top-5"><Sparkles className="h-3 w-3" />{cap(p.interval)}</Badge>
              <p className="text-lg font-semibold">{p.name}</p>
              <p className="mt-1 min-h-[40px] text-sm text-ink-muted">{p.description}</p>
              <p className="mt-4 text-3xl font-semibold tracking-tight">
                {p.pricingModel === "tiered" || p.pricingModel === "volume" ? <>from {money(Math.min(...p.tiers.map((t) => t.unitAmount)))}</> : money(p.price)}
                <span className="text-sm font-normal text-ink-muted">{p.pricingModel !== "flat" ? "/seat" : ""}{intervalText(p.interval, p.intervalCount)}</span>
              </p>
              {p.minQuantity > 1 && <p className="text-xs text-ink-muted">Minimum {p.minQuantity} units</p>}
              <ul className="mt-5 flex-1 space-y-2 text-sm">{p.features.map((f) => <li key={f} className="flex items-center gap-2"><Check className="h-4 w-4 text-brand-600" />{f}</li>)}</ul>
              <Button className="mt-6 w-full" variant="primary" onClick={() => setPick(p)}>Choose {p.name}</Button>
            </Card>
          ))}
        </div>
      )}
      {pick && <SubscribeModal plan={pick} onClose={() => setPick(null)} />}
    </div>
  );
}

function SubscribeModal({ plan, onClose }: { plan: Plan; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [lines, setLines] = useState<LineInput[]>([{ productId: plan.productId, variantIds: [], addonIds: [], quantity: plan.minQuantity }]);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const { data, error } = usePreview(plan.id, undefined, lines.slice(0, 1));
  return (
    <Modal open onClose={onClose} title={`Subscribe to ${plan.name}`} description="Your first invoice is generated immediately; pay it from the invoice page." size="xl"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={busy} disabled={!!error} onClick={async () => {
        setBusy(true);
        try {
          const l = lines[0];
          const s = await api<{ id: string; number: string }>("/api/portal/subscribe", { body: { planId: plan.id, quantity: l.quantity, variantIds: l.variantIds, addonIds: l.addonIds, code: code || undefined } });
          toast.success(`You're subscribed! (${s.number})`, "Your first invoice is ready.");
          router.push(`/portal/subscriptions/${s.id}`);
        } catch (e) { toast.error("Could not subscribe", (e as Error).message); } finally { setBusy(false); }
      }}>Subscribe</Button></>}>
      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-4">
          <LineItemsEditor lines={lines.slice(0, 1)} onChange={(l) => setLines(l.slice(0, 1))} lockFirstProduct minQuantity={plan.minQuantity} />
          <Field label="Discount code (optional)" id="code" hint="Applied on your invoices"><Input id="code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="WELCOME10" /></Field>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4"><PriceSummary data={data} error={error} intervalLabel={intervalText(plan.interval, plan.intervalCount)} /><p className="mt-3 text-xs text-ink-muted">Discount codes are validated when you subscribe.</p></div>
      </div>
    </Modal>
  );
}
