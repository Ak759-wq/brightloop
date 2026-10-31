"use client";
import { Layers, Plus, Trash2 } from "lucide-react";
import { CrudListPage } from "@/components/CrudListPage";
import { useOptions } from "@/components/crud";
import { Badge, Button, Input } from "@/components/ui/primitives";
import { date, intervalText, money, cap } from "@/lib/client/format";

interface Tier { upTo: number | null; unitAmount: number }
interface Plan { id: string; name: string; productId: string; pricingModel: string; price: number; tiers: Tier[]; interval: string; intervalCount: number; minQuantity: number; availableFrom: string | null; availableUntil: string | null; autoClose: boolean; closable: boolean; pausable: boolean; renewable: boolean; active: boolean; public: boolean; termPeriods: number | null }

function TiersEditor({ values, set }: { values: Record<string, unknown>; set: (n: string, v: unknown) => void }) {
  if (values.pricingModel !== "tiered" && values.pricingModel !== "volume") return null;
  const tiers = ((values.__extra as { tiers?: Tier[] })?.tiers ?? (values.tiersInit as Tier[]) ?? [{ upTo: 10, unitAmount: 0 }, { upTo: null, unitAmount: 0 }]) as Tier[];
  const update = (t: Tier[]) => set("__extra", { tiers: t });
  return (
    <div className="mt-5 rounded-xl border border-slate-200 p-4">
      <p className="text-sm font-semibold">{values.pricingModel === "tiered" ? "Graduated tiers" : "Volume tiers"}</p>
      <p className="mb-3 text-xs text-ink-muted">{values.pricingModel === "tiered" ? "Each unit is priced in the tier it falls into." : "All units are priced at the tier the total quantity reaches."} The last tier must be unbounded.</p>
      {tiers.map((t, i) => (
        <div key={i} className="mb-2 grid grid-cols-[1fr_1fr_auto] items-center gap-2">
          <Input aria-label="Up to" type="number" placeholder="∞ (leave blank)" value={t.upTo ?? ""} disabled={i === tiers.length - 1} onChange={(e) => update(tiers.map((x, j) => (j === i ? { ...x, upTo: e.target.value ? Number(e.target.value) : null } : x)))} />
          <Input aria-label="Unit price" type="number" step="0.01" placeholder="₹ per unit" value={t.unitAmount ? t.unitAmount / 100 : ""} onChange={(e) => update(tiers.map((x, j) => (j === i ? { ...x, unitAmount: Math.round(Number(e.target.value) * 100) } : x)))} />
          <button type="button" aria-label="Remove tier" disabled={tiers.length <= 1} onClick={() => update(tiers.filter((_, j) => j !== i))} className="p-2 text-slate-400 hover:text-rose-600 disabled:opacity-30"><Trash2 className="h-4 w-4" /></button>
        </div>
      ))}
      <Button type="button" size="sm" variant="soft" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => { const c = [...tiers]; c.splice(c.length - 1, 0, { upTo: (c[c.length - 2]?.upTo ?? 0) + 10, unitAmount: 0 }); update(c); }}>Add tier</Button>
    </div>
  );
}

export default function PlansPage() {
  const products = useOptions<{ id: string; name: string }>("products", (p) => p.name, "&active=true");
  return (
    <CrudListPage<Plan>
      title="Pricing Plans" singular="Plan" collection="plans" emptyIcon={<Layers className="h-6 w-6" />}
      description="What a plan costs, how often it bills, its minimum quantity, availability dates and lifecycle rules."
      filters={[{ key: "interval", label: "Intervals", options: ["daily", "weekly", "monthly", "yearly"].map((v) => ({ value: v, label: cap(v) })) }, { key: "active", label: "Status", options: [{ value: "true", label: "Active" }, { value: "false", label: "Archived" }] }]}
      columns={[
        { key: "name", header: "Plan", cell: (r) => <div><p className="font-medium text-ink">{r.name}</p><p className="text-xs text-ink-muted">{products.byId[r.productId]?.name}</p></div> },
        { key: "price", header: "Price", cell: (r) => r.pricingModel === "tiered" || r.pricingModel === "volume" ? <span>from {money(Math.min(...r.tiers.map((t) => t.unitAmount)))}<span className="text-ink-muted">/unit</span></span> : <span>{money(r.price)}<span className="text-ink-muted">{r.pricingModel === "per_seat" ? "/seat" : ""}{intervalText(r.interval, r.intervalCount)}</span></span> },
        { key: "model", header: "Model", hideOnMobile: true, cell: (r) => <Badge tone="violet">{cap(r.pricingModel)}</Badge> },
        { key: "min", header: "Min qty", hideOnMobile: true, cell: (r) => r.minQuantity },
        { key: "avail", header: "Availability", hideOnMobile: true, cell: (r) => <span className="text-xs text-ink-muted">{r.availableFrom || r.availableUntil ? `${date(r.availableFrom)} → ${date(r.availableUntil)}` : "Always"}</span> },
        { key: "rules", header: "Rules", hideOnMobile: true, cell: (r) => <div className="flex flex-wrap gap-1">{r.autoClose && <Badge tone="amber">Auto-close</Badge>}{r.pausable && <Badge>Pausable</Badge>}{r.renewable && <Badge>Renewable</Badge>}{!r.closable && <Badge tone="red">No early close</Badge>}{!r.public && <Badge tone="slate">Private</Badge>}</div> },
        { key: "status", header: "Status", cell: (r) => (r.active ? <Badge tone="green" dot>Active</Badge> : <Badge>Archived</Badge>) },
      ]}
      fields={[
        { name: "name", label: "Plan name", type: "text" },
        { name: "productId", label: "Product", type: "select", options: products.options },
        { name: "pricingModel", label: "Pricing model", type: "select", options: [{ value: "per_seat", label: "Per seat (price × quantity)" }, { value: "flat", label: "Flat (fixed price)" }, { value: "tiered", label: "Tiered (graduated)" }, { value: "volume", label: "Volume" }] },
        { name: "price", label: "Price", type: "money", showIf: (v) => v.pricingModel === "flat" || v.pricingModel === "per_seat", hint: "Per seat for per-seat plans" },
        { name: "interval", label: "Bills every", type: "select", options: ["daily", "weekly", "monthly", "yearly"].map((v) => ({ value: v, label: cap(v) })) },
        { name: "intervalCount", label: "Interval count", type: "number", hint: "3 + monthly = quarterly" },
        { name: "minQuantity", label: "Minimum quantity", type: "number" },
        { name: "termPeriods", label: "Term (billing periods)", type: "number", nullable: true, hint: "Sets expiry. Blank = open-ended" },
        { name: "availableFrom", label: "Available from", type: "date" },
        { name: "availableUntil", label: "Available until", type: "date" },
        { name: "description", label: "Description", type: "textarea" },
        { name: "features", label: "Features (comma separated)", type: "tags", span: 2 },
        { name: "autoClose", label: "Close automatically when the term ends", type: "switch" },
        { name: "closable", label: "Can be closed early", type: "switch" },
        { name: "pausable", label: "Can be paused", type: "switch" },
        { name: "renewable", label: "Can be renewed", type: "switch" },
        { name: "public", label: "Show in customer portal (Explore Plans)", type: "switch" },
        { name: "active", label: "Active", type: "switch" },
      ]}
      defaults={{ pricingModel: "per_seat", interval: "monthly", intervalCount: 1, minQuantity: 1, autoClose: false, closable: true, pausable: true, renewable: true, public: true, active: true, features: [] }}
      extraForm={(values, set) => <TiersEditor values={values} set={set} />}
    />
  );
}
