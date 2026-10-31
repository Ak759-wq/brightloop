"use client";
import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { api, useApi } from "@/lib/client/api";
import { useDebounced } from "../ui/table";
import { Button, Input, Select, Skeleton, Callout } from "../ui/primitives";
import { money, bpToPct } from "@/lib/client/format";
import { cn } from "@/lib/client/cn";

export interface LineInput { productId: string; variantIds: string[]; addonIds: string[]; quantity: number }
interface Product { id: string; name: string; salesPrice: number }
interface Variant { id: string; productId: string; attribute: string; value: string; priceDelta: number }
interface Addon { id: string; productId: string | null; name: string; price: number }

export function useCatalog() {
  const products = useApi<{ items: Product[] }>("/api/r/products?active=true&limit=100");
  const variants = useApi<{ items: Variant[] }>("/api/r/product_variants?active=true&limit=200");
  const addons = useApi<{ items: Addon[] }>("/api/r/product_addons?active=true&limit=100");
  return { products: products.data?.items ?? [], variants: variants.data?.items ?? [], addons: addons.data?.items ?? [], ready: !!products.data };
}

export function LineItemsEditor({ lines, onChange, lockFirstProduct, minQuantity = 1 }: { lines: LineInput[]; onChange: (l: LineInput[]) => void; lockFirstProduct?: boolean; minQuantity?: number }) {
  const cat = useCatalog();
  const update = (i: number, patch: Partial<LineInput>) => onChange(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  if (!cat.ready) return <Skeleton className="h-24 w-full" />;
  return (
    <div className="space-y-3">
      {lines.map((line, i) => {
        const vs = cat.variants.filter((v) => v.productId === line.productId);
        const attrs = Array.from(new Set(vs.map((v) => v.attribute)));
        const ads = cat.addons.filter((a) => !a.productId || a.productId === line.productId);
        return (
          <div key={i} className="rounded-xl border border-slate-200 p-3">
            <div className="grid gap-2 sm:grid-cols-[1fr_110px_auto]">
              <Select aria-label="Product" value={line.productId} disabled={lockFirstProduct && i === 0} onChange={(e) => update(i, { productId: e.target.value, variantIds: [], addonIds: [] })} options={cat.products.map((p) => ({ value: p.id, label: `${p.name} · ${money(p.salesPrice)}` }))} placeholder="Choose product" />
              <Input aria-label="Quantity" type="number" min={i === 0 ? minQuantity : 1} value={line.quantity} onChange={(e) => update(i, { quantity: Math.max(1, Math.floor(Number(e.target.value) || 1)) })} />
              <Button type="button" variant="ghost" aria-label="Remove line" disabled={i === 0} onClick={() => onChange(lines.filter((_, j) => j !== i))} icon={<Trash2 className="h-4 w-4" />} />
            </div>
            {(attrs.length > 0 || ads.length > 0) && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {attrs.map((attr) => {
                  const current = vs.find((v) => v.attribute === attr && line.variantIds.includes(v.id));
                  return (
                    <Select key={attr} aria-label={attr} className="h-8 w-auto rounded-full text-xs" value={current?.id ?? ""} onChange={(e) => update(i, { variantIds: [...line.variantIds.filter((id) => vs.find((v) => v.id === id)?.attribute !== attr), ...(e.target.value ? [e.target.value] : [])] })}
                      options={vs.filter((v) => v.attribute === attr).map((v) => ({ value: v.id, label: `${attr}: ${v.value}${v.priceDelta ? ` (+${money(v.priceDelta)})` : ""}` }))} placeholder={`${attr}: default`} />
                  );
                })}
                {ads.map((a) => {
                  const on = line.addonIds.includes(a.id);
                  return <button type="button" key={a.id} aria-pressed={on} onClick={() => update(i, { addonIds: on ? line.addonIds.filter((x) => x !== a.id) : [...line.addonIds, a.id] })} className={cn("rounded-full border px-3 py-1 text-xs transition", on ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50")}>+ {a.name} ({money(a.price)})</button>;
                })}
              </div>
            )}
          </div>
        );
      })}
      <Button type="button" size="sm" variant="soft" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => onChange([...lines, { productId: "", variantIds: [], addonIds: [], quantity: 1 }])}>Add line</Button>
    </div>
  );
}

export interface Preview {
  items: { productName: string; variantLabel?: string; quantity: number; unitPrice: number; amount: number }[];
  preview: null | { totals: { subtotal: number; discountTotal: number; taxableTotal: number; cgst: number; sgst: number; igst: number; taxTotal: number; total: number }; items: { taxRateBp: number; supply: string }[]; applied: { name: string; amount: number }[] };
  taxError: string | null;
  assumedIntraState: boolean;
}

export function usePreview(planId: string, customerId: string | undefined, lines: LineInput[], discountIds: string[] = []) {
  const [data, setData] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const key = useDebounced(JSON.stringify({ planId, customerId, lines, discountIds }), 350);
  useEffect(() => {
    const p = JSON.parse(key) as { planId: string; customerId?: string; lines: LineInput[]; discountIds: string[] };
    if (!p.planId || !p.lines.length || p.lines.some((l) => !l.productId)) { setData(null); return; }
    api<Preview>("/api/pricing/preview", { body: { planId: p.planId, customerId: p.customerId || undefined, items: p.lines, discountIds: p.discountIds } })
      .then((d) => { setData(d); setError(null); })
      .catch((e) => { setData(null); setError((e as Error).message); });
  }, [key]);
  return { data, error };
}

export function PriceSummary({ data, error, intervalLabel }: { data: Preview | null; error: string | null; intervalLabel?: string }) {
  if (error) return <Callout tone="red">{error}</Callout>;
  if (!data) return <p className="text-sm text-ink-muted">Choose a plan and products to see live pricing.</p>;
  const t = data.preview?.totals;
  return (
    <div className="space-y-3 text-sm">
      {data.items.map((it, i) => (
        <div key={i} className="flex justify-between gap-3">
          <span className="min-w-0"><span className="block truncate font-medium text-ink">{it.productName}</span><span className="block text-xs text-ink-muted">{it.variantLabel ? `${it.variantLabel} · ` : ""}{it.quantity} × {money(it.unitPrice)}</span></span>
          <span className="tabular-nums">{money(it.amount)}</span>
        </div>
      ))}
      <div className="space-y-1.5 border-t border-dashed border-slate-200 pt-3">
        {t ? (<>
          <Row label="Subtotal" value={money(t.subtotal)} />
          {data.preview!.applied.map((a) => <Row key={a.name} label={a.name} value={`− ${money(a.amount)}`} tone="green" />)}
          {t.cgst > 0 && <Row label={`CGST ${bpToPct((data.preview!.items[0]?.taxRateBp ?? 0) / 2)}`} value={money(t.cgst)} />}
          {t.sgst > 0 && <Row label={`SGST ${bpToPct((data.preview!.items[0]?.taxRateBp ?? 0) / 2)}`} value={money(t.sgst)} />}
          {t.igst > 0 && <Row label="IGST" value={money(t.igst)} />}
          <div className="flex justify-between pt-1 text-base font-semibold"><span>Total {intervalLabel && <span className="text-xs font-normal text-ink-muted">{intervalLabel}</span>}</span><span className="tabular-nums">{money(t.total)}</span></div>
          {data.assumedIntraState && <p className="text-xs text-ink-muted">Tax shown as intra-state until a customer is chosen.</p>}
        </>) : <Callout tone="amber">{data.taxError}</Callout>}
      </div>
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "green" }) {
  return <div className={cn("flex justify-between", tone === "green" ? "text-emerald-700" : "text-slate-600")}><span>{label}</span><span className="tabular-nums">{value}</span></div>;
}
