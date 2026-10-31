"use client";
import { useState } from "react";
import { Boxes, Layers3, Plus, Trash2 } from "lucide-react";
import { CrudListPage } from "@/components/CrudListPage";
import { useOptions } from "@/components/crud";
import { Badge, Button, Input, Select, EmptyState } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { api, useApi } from "@/lib/client/api";
import { money, cap } from "@/lib/client/format";
import { useAuth } from "@/lib/client/auth";

interface Product { id: string; name: string; type: string; salesPrice: number; costPrice?: number; notes: string; taxRuleId: string | null; active: boolean; usageMetric?: string | null }
interface Variant { id: string; productId: string; attribute: string; value: string; priceDelta: number; active: boolean }
interface Addon { id: string; productId: string | null; name: string; price: number; active: boolean }

function VariantsModal({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const toast = useToast();
  const { user } = useAuth();
  const admin = user?.role === "admin";
  const variants = useApi<{ items: Variant[] }>(product ? `/api/r/product_variants?productId=${product.id}&active=true&limit=100` : null);
  const addons = useApi<{ items: Addon[] }>(product ? `/api/r/product_addons?active=true&limit=100` : null);
  const [v, setV] = useState({ attribute: "Brand", value: "", delta: "" });
  const [a, setA] = useState({ name: "", price: "" });
  if (!product) return null;
  const add = async (col: string, body: unknown, reload: () => void) => {
    try { await api(`/api/r/${col}`, { body }); toast.success("Added"); reload(); } catch (e) { toast.error("Could not add", (e as Error).message); }
  };
  const del = async (col: string, id: string, reload: () => void) => { await api(`/api/r/${col}/${id}`, { method: "DELETE" }); reload(); };
  const relevantAddons = (addons.data?.items ?? []).filter((x) => !x.productId || x.productId === product.id);
  return (
    <Modal open onClose={onClose} title={`${product.name} · variants & add-ons`} description={`Base sales price ${money(product.salesPrice)}. Variant deltas and add-ons are added per unit.`} size="lg">
      <h4 className="mb-2 text-sm font-semibold">Variants</h4>
      <div className="overflow-hidden rounded-xl border border-slate-200">
        {(variants.data?.items ?? []).map((x) => (
          <div key={x.id} className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5 text-sm last:border-0">
            <span><span className="text-ink-muted">{x.attribute}:</span> <b>{x.value}</b></span>
            <span className="flex items-center gap-3"><span className="tabular-nums">{x.priceDelta >= 0 ? "+" : ""}{money(x.priceDelta)}</span>{admin && <button aria-label="Remove variant" onClick={() => del("product_variants", x.id, variants.reload)} className="text-slate-400 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>}</span>
          </div>
        ))}
        {!variants.data?.items.length && <p className="px-4 py-4 text-sm text-ink-muted">No variants. Example: Brand = Odoo adds ₹560.</p>}
      </div>
      {admin && (
        <form className="mt-3 grid grid-cols-[1fr_1fr_110px_auto] gap-2" onSubmit={(e) => { e.preventDefault(); void add("product_variants", { productId: product.id, attribute: v.attribute, value: v.value, priceDelta: Math.round(Number(v.delta || 0) * 100), active: true }, variants.reload); setV({ ...v, value: "", delta: "" }); }}>
          <Input aria-label="Attribute" value={v.attribute} onChange={(e) => setV({ ...v, attribute: e.target.value })} placeholder="Attribute" />
          <Input aria-label="Value" value={v.value} onChange={(e) => setV({ ...v, value: e.target.value })} placeholder="Value (e.g. Odoo)" required />
          <Input aria-label="Price delta" type="number" step="0.01" value={v.delta} onChange={(e) => setV({ ...v, delta: e.target.value })} placeholder="+₹" />
          <Button type="submit" variant="soft" icon={<Plus className="h-4 w-4" />}>Add</Button>
        </form>
      )}
      <h4 className="mb-2 mt-6 text-sm font-semibold">Add-ons available for this product</h4>
      <div className="overflow-hidden rounded-xl border border-slate-200">
        {relevantAddons.map((x) => (
          <div key={x.id} className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5 text-sm last:border-0">
            <span><b>{x.name}</b> {!x.productId && <Badge className="ml-1">All products</Badge>}</span>
            <span className="flex items-center gap-3"><span className="tabular-nums">+{money(x.price)} / unit</span>{admin && <button aria-label="Remove add-on" onClick={() => del("product_addons", x.id, addons.reload)} className="text-slate-400 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>}</span>
          </div>
        ))}
        {!relevantAddons.length && <EmptyState title="No add-ons" />}
      </div>
      {admin && (
        <form className="mt-3 grid grid-cols-[1fr_110px_auto] gap-2" onSubmit={(e) => { e.preventDefault(); void add("product_addons", { productId: product.id, name: a.name, price: Math.round(Number(a.price || 0) * 100), active: true }, addons.reload); setA({ name: "", price: "" }); }}>
          <Input aria-label="Add-on name" value={a.name} onChange={(e) => setA({ ...a, name: e.target.value })} placeholder="Add-on name" required />
          <Input aria-label="Add-on price" type="number" step="0.01" min="0" value={a.price} onChange={(e) => setA({ ...a, price: e.target.value })} placeholder="₹ / unit" required />
          <Button type="submit" variant="soft" icon={<Plus className="h-4 w-4" />}>Add</Button>
        </form>
      )}
    </Modal>
  );
}

export default function ProductsPage() {
  const taxes = useOptions<{ id: string; name: string }>("tax_rules", (t) => t.name);
  const [variantsFor, setVariantsFor] = useState<Product | null>(null);
  const { user } = useAuth();
  return (
    <>
      <CrudListPage<Product>
        title="Products" singular="Product" collection="products" emptyIcon={<Boxes className="h-6 w-6" />}
        description="Everything Brightloop sells: name, type, sales price, cost price and notes, with variants and add-ons."
        searchPlaceholder="Search products…"
        filters={[{ key: "type", label: "Types", options: [{ value: "software", label: "Software" }, { value: "service", label: "Service" }, { value: "goods", label: "Goods" }] }, { key: "active", label: "Status", options: [{ value: "true", label: "Active" }, { value: "false", label: "Archived" }] }]}
        columns={[
          { key: "name", header: "Product", cell: (r) => <div><p className="font-medium text-ink">{r.name}</p><p className="line-clamp-1 max-w-xs text-xs text-ink-muted">{r.notes}</p></div> },
          { key: "type", header: "Type", cell: (r) => <Badge tone="blue">{cap(r.type)}</Badge> },
          { key: "price", header: "Sales price", align: "right", cell: (r) => money(r.salesPrice) },
          ...(user?.role === "admin" ? [{ key: "cost", header: "Cost price", align: "right" as const, hideOnMobile: true, cell: (r: Product) => <span className="text-ink-muted">{money(r.costPrice ?? 0)}</span> }, { key: "margin", header: "Margin", align: "right" as const, hideOnMobile: true, cell: (r: Product) => r.salesPrice ? `${Math.round(((r.salesPrice - (r.costPrice ?? 0)) / r.salesPrice) * 100)}%` : "—" }] : []),
          { key: "tax", header: "Tax", hideOnMobile: true, cell: (r) => taxes.byId[r.taxRuleId ?? ""]?.name ?? "Default" },
          { key: "status", header: "Status", cell: (r) => (r.active ? <Badge tone="green" dot>Active</Badge> : <Badge>Archived</Badge>) },
        ]}
        rowActions={(row) => <Button size="sm" variant="ghost" icon={<Layers3 className="h-3.5 w-3.5" />} onClick={() => setVariantsFor(row)}>Variants</Button>}
        fields={[
          { name: "name", label: "Name", type: "text" },
          { name: "type", label: "Type", type: "select", options: [{ value: "software", label: "Software" }, { value: "service", label: "Service" }, { value: "goods", label: "Goods" }] },
          { name: "salesPrice", label: "Sales price", type: "money" },
          { name: "costPrice", label: "Cost price (admin only)", type: "money" },
          { name: "taxRuleId", label: "Tax rule", type: "select", options: taxes.options, placeholder: "Use default tax rule", nullable: true },
          { name: "usageMetric", label: "Usage metric (optional)", type: "text", placeholder: "api_calls", nullable: true },
          { name: "notes", label: "Notes", type: "textarea" },
          { name: "active", label: "Active", type: "switch", description: "Inactive products can't be added to new subscriptions" },
        ]}
        defaults={{ type: "software", active: true }}
      />
      <VariantsModal product={variantsFor} onClose={() => setVariantsFor(null)} />
    </>
  );
}
