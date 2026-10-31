"use client";
import { useState } from "react";
import { KeyRound, Mail } from "lucide-react";
import { useApi } from "@/lib/client/api";
import { useAuth } from "@/lib/client/auth";
import { PageHeader } from "@/components/shell/AppShell";
import { Button, Callout, Card, CardHeader, DescList } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { money, stateName } from "@/lib/client/format";

export default function Account() {
  const { user, resetPassword } = useAuth();
  const toast = useToast();
  const c = useApi<{ name: string; email: string; phone: string; company: string; gstin: string; billingAddress: string; city: string; placeOfSupply: string | null; creditBalance: number }>(user?.customerId ? `/api/r/customers/${user.customerId}` : null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-6">
      <PageHeader title="Account settings" description="Your login and billing profile." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <CardHeader className="px-0 pt-0" title="Login" icon={<KeyRound className="h-4 w-4" />} />
          <DescList items={[{ label: "Name", value: user?.name }, { label: "Email", value: user?.email }, { label: "Role", value: "Customer" }]} />
          <Button className="mt-5" variant="secondary" loading={busy} icon={<Mail className="h-4 w-4" />} onClick={async () => { setBusy(true); try { toast.success("Password reset", await resetPassword(user!.email)); } finally { setBusy(false); } }}>Email me a password reset link</Button>
        </Card>
        <Card className="p-5">
          <CardHeader className="px-0 pt-0" title="Billing profile" />
          {c.data && <DescList items={[{ label: "Company", value: c.data.name }, { label: "Billing email", value: c.data.email }, { label: "GSTIN", value: c.data.gstin || "—" }, { label: "Place of supply", value: stateName(c.data.placeOfSupply) }, { label: "Address", value: [c.data.billingAddress, c.data.city].filter(Boolean).join(", ") || "—" }, { label: "Account credit", value: money(c.data.creditBalance) }]} />}
          <div className="mt-5"><Callout>To change your GST details or place of supply, contact {"support@brightloop.demo"} – tax details are verified by our team before they affect invoices.</Callout></div>
        </Card>
      </div>
    </div>
  );
}
