"use client";
import { Landmark } from "lucide-react";
import { CrudListPage } from "@/components/CrudListPage";
import { Badge, Callout } from "@/components/ui/primitives";
import { bpToPct, stateName } from "@/lib/client/format";
import { useAuth } from "@/lib/client/auth";

interface TaxRule { id: string; name: string; rateBp: number; kind: string; hsnSac: string; isDefault: boolean }

export default function TaxesPage() {
  const { org } = useAuth();
  return (
    <CrudListPage<TaxRule>
      title="Taxes" singular="Tax rule" collection="tax_rules" archiveLabel="Delete" emptyIcon={<Landmark className="h-6 w-6" />}
      description="GST rules applied automatically on every invoice line."
      above={<div className="mb-4"><Callout title="How GST is decided">Seller state is <b>{stateName(org?.sellerState)}</b> (Settings). If the customer&apos;s configured place of supply is the same state, the rate is split into CGST + SGST; otherwise IGST is charged. A customer without a place of supply cannot be invoiced for taxable lines – it is never guessed.</Callout></div>}
      columns={[
        { key: "name", header: "Name", cell: (r) => <span className="font-medium text-ink">{r.name}</span> },
        { key: "rate", header: "Rate", cell: (r) => bpToPct(r.rateBp) },
        { key: "split", header: "Intra-state split", cell: (r) => r.kind === "GST" && r.rateBp ? `CGST ${bpToPct(r.rateBp / 2)} + SGST ${bpToPct(r.rateBp / 2)}` : "—", hideOnMobile: true },
        { key: "hsn", header: "HSN/SAC", cell: (r) => r.hsnSac || "—", hideOnMobile: true },
        { key: "def", header: "", cell: (r) => (r.isDefault ? <Badge tone="blue">Default</Badge> : null) },
      ]}
      fields={[
        { name: "name", label: "Name", type: "text", placeholder: "GST 18%" },
        { name: "rateBp", label: "Rate", type: "percent", placeholder: "18" },
        { name: "kind", label: "Kind", type: "select", options: [{ value: "GST", label: "GST (CGST/SGST or IGST)" }, { value: "NONE", label: "No tax / exempt" }] },
        { name: "hsnSac", label: "HSN / SAC code", type: "text" },
        { name: "isDefault", label: "Default rule", type: "switch", description: "Used for products without their own tax rule" },
      ]}
      defaults={{ kind: "GST", rateBp: 1800, isDefault: false }}
    />
  );
}
