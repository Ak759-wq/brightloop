"use client";
import { Percent } from "lucide-react";
import { CrudListPage } from "@/components/CrudListPage";
import { useOptions } from "@/components/crud";
import { Badge } from "@/components/ui/primitives";
import { bpToPct, date, money } from "@/lib/client/format";
import { useAuth } from "@/lib/client/auth";

interface Discount { id: string; name: string; code: string; type: "fixed" | "percent"; value: number; scope: string; productIds: string[]; minQuantity: number | null; minAmount: number | null; startDate: string | null; endDate: string | null; usageLimit: number | null; usedCount: number; active: boolean }

export default function DiscountsPage() {
  const { org } = useAuth();
  const products = useOptions<{ id: string; name: string }>("products", (p) => p.name);
  const status = (d: Discount) => {
    if (!d.active) return <Badge>Inactive</Badge>;
    if (d.endDate && org && d.endDate < org.today) return <Badge tone="slate">Expired</Badge>;
    if (d.startDate && org && d.startDate > org.today) return <Badge tone="violet">Scheduled</Badge>;
    if (d.usageLimit != null && d.usedCount >= d.usageLimit) return <Badge tone="amber">Used up</Badge>;
    return <Badge tone="green" dot>Active</Badge>;
  };
  return (
    <CrudListPage<Discount>
      title="Discounts" singular="Discount" collection="discounts" emptyIcon={<Percent className="h-6 w-6" />}
      description="Only admins create discount rules. Attached discounts appear on the next invoice automatically and stop when they expire or run out."
      filters={[{ key: "active", label: "Status", options: [{ value: "true", label: "Active" }, { value: "false", label: "Inactive" }] }]}
      columns={[
        { key: "name", header: "Discount", cell: (r) => <div><p className="font-medium text-ink">{r.name}</p>{r.code && <p className="font-mono text-xs text-ink-muted">{r.code}</p>}</div> },
        { key: "value", header: "Value", cell: (r) => (r.type === "percent" ? bpToPct(r.value) : money(r.value)) },
        { key: "scope", header: "Applies to", cell: (r) => (r.scope === "subscription" ? "Whole subscription" : r.productIds.map((p) => products.byId[p]?.name ?? p).join(", ")), hideOnMobile: true },
        { key: "cond", header: "Conditions", hideOnMobile: true, cell: (r) => <span className="text-xs text-ink-muted">{[r.minQuantity && `≥ ${r.minQuantity} units`, r.minAmount && `≥ ${money(r.minAmount)}`, (r.startDate || r.endDate) && `${date(r.startDate)} → ${date(r.endDate)}`].filter(Boolean).join(" · ") || "None"}</span> },
        { key: "use", header: "Used", cell: (r) => `${r.usedCount}${r.usageLimit ? ` / ${r.usageLimit}` : ""}` },
        { key: "status", header: "Status", cell: status },
      ]}
      fields={[
        { name: "name", label: "Name", type: "text" },
        { name: "code", label: "Code (optional)", type: "text", placeholder: "WELCOME10", hint: "Customers can enter it at checkout" },
        { name: "type", label: "Type", type: "select", options: [{ value: "percent", label: "Percentage" }, { value: "fixed", label: "Fixed amount" }] },
        { name: "value", label: "Percentage", type: "percent", showIf: (v) => v.type === "percent" },
        { name: "value", label: "Amount", type: "money", showIf: (v) => v.type === "fixed" },
        { name: "scope", label: "Applies to", type: "select", options: [{ value: "subscription", label: "Whole subscription" }, { value: "product", label: "Specific products" }] },
        { name: "productIds", label: "Products", type: "multiselect", options: products.options, showIf: (v) => v.scope === "product" },
        { name: "minQuantity", label: "Minimum quantity", type: "number", nullable: true },
        { name: "minAmount", label: "Minimum purchase", type: "money", nullable: true },
        { name: "startDate", label: "Starts", type: "date" },
        { name: "endDate", label: "Ends", type: "date" },
        { name: "usageLimit", label: "Usage limit", type: "number", nullable: true, hint: "Blank = unlimited" },
        { name: "active", label: "Active", type: "switch" },
      ]}
      defaults={{ type: "percent", scope: "subscription", active: true, productIds: [] }}
    />
  );
}
