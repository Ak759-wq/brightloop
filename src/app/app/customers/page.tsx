"use client";
import { useRouter } from "next/navigation";
import { Users } from "lucide-react";
import { CrudListPage } from "@/components/CrudListPage";
import { customerFields } from "@/components/customerFields";
import { Badge } from "@/components/ui/primitives";
import { stateName, date } from "@/lib/client/format";

interface Customer { id: string; name: string; email: string; city: string; placeOfSupply: string | null; tags: string[]; status: string; createdAt: string; contactName?: string }

export default function CustomersPage() {
  const router = useRouter();
  return (
    <CrudListPage<Customer>
      title="Customers" singular="Customer" collection="customers" emptyIcon={<Users className="h-6 w-6" />}
      description="Everyone you bill, with their GST place of supply and contacts."
      searchPlaceholder="Search name, email or city…"
      filters={[{ key: "status", label: "Status", options: [{ value: "active", label: "Active" }, { value: "archived", label: "Archived" }] }]}
      onRowClick={(r) => router.push(`/app/customers/${r.id}`)}
      columns={[
        { key: "name", header: "Customer", cell: (r) => <div className="flex items-center gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">{r.name.slice(0, 2).toUpperCase()}</span><div className="min-w-0"><p className="truncate font-medium text-ink">{r.name}</p><p className="truncate text-xs text-ink-muted">{r.email}</p></div></div> },
        { key: "city", header: "City", hideOnMobile: true, cell: (r) => r.city || "—" },
        { key: "pos", header: "Place of supply", cell: (r) => (r.placeOfSupply ? stateName(r.placeOfSupply) : <Badge tone="amber">Not set</Badge>) },
        { key: "tags", header: "Tags", hideOnMobile: true, cell: (r) => <div className="flex flex-wrap gap-1">{r.tags?.map((t) => <Badge key={t} tone={t === "at-risk" ? "red" : "slate"}>{t}</Badge>)}</div> },
        { key: "since", header: "Since", hideOnMobile: true, cell: (r) => date(r.createdAt) },
      ]}
      fields={customerFields}
      defaults={{ country: "IN", tags: [] }}
    />
  );
}
