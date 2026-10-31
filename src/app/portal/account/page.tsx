"use client";
import { useState } from "react";
import { KeyRound, Mail } from "lucide-react";
import { api, useApi } from "@/lib/client/api";
import { useAuth } from "@/lib/client/auth";
import { PageHeader } from "@/components/shell/AppShell";
import { Button, Callout, Card, CardHeader, DescList, Field, Input, Select } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { money, stateName, STATE_OPTIONS } from "@/lib/client/format";

export default function Account() {
  const { user, resetPassword } = useAuth();
  const toast = useToast();
  const c = useApi<{ name: string; email: string; phone: string; company: string; gstin: string; billingAddress: string; city: string; placeOfSupply: string | null; creditBalance: number }>(user?.customerId ? "/api/portal/profile" : null);
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState({ name: "", phone: "", company: "", gstin: "", billingAddress: "", city: "", placeOfSupply: "" });
  const [editing, setEditing] = useState(false);
  const startEdit = () => {
    if (!c.data) return;
    setEdit({ name: c.data.name, phone: c.data.phone, company: c.data.company, gstin: c.data.gstin, billingAddress: c.data.billingAddress, city: c.data.city, placeOfSupply: c.data.placeOfSupply ?? "" });
    setEditing(true);
  };
  const save = async () => {
    setBusy(true);
    try {
      await api("/api/portal/profile", { method: "PATCH", body: { ...edit, placeOfSupply: edit.placeOfSupply || null } });
      await c.reload();
      setEditing(false);
      toast.success("Profile updated");
    } catch (e) { toast.error("Could not update profile", (e as Error).message); } finally { setBusy(false); }
  };
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
          {c.data && !editing && <><DescList items={[{ label: "Company", value: c.data.name }, { label: "Billing email", value: c.data.email }, { label: "GSTIN", value: c.data.gstin || "—" }, { label: "Place of supply", value: stateName(c.data.placeOfSupply) }, { label: "Address", value: [c.data.billingAddress, c.data.city].filter(Boolean).join(", ") || "—" }, { label: "Account credit", value: money(c.data.creditBalance) }]} /><Button className="mt-5" variant="secondary" onClick={startEdit}>Edit billing profile</Button></>}
          {editing && <div className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2"><Field label="Name" id="profile-name"><Input id="profile-name" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field><Field label="Phone" id="profile-phone"><Input id="profile-phone" value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} /></Field></div>
            <Field label="Company" id="profile-company"><Input id="profile-company" value={edit.company} onChange={(e) => setEdit({ ...edit, company: e.target.value })} /></Field>
            <div className="grid gap-4 sm:grid-cols-2"><Field label="GSTIN" id="profile-gstin"><Input id="profile-gstin" value={edit.gstin} onChange={(e) => setEdit({ ...edit, gstin: e.target.value.toUpperCase() })} /></Field><Field label="Place of supply" id="profile-pos"><Select id="profile-pos" value={edit.placeOfSupply} onChange={(e) => setEdit({ ...edit, placeOfSupply: e.target.value })} options={STATE_OPTIONS} placeholder="Choose state" /></Field></div>
            <Field label="Billing address" id="profile-address"><Input id="profile-address" value={edit.billingAddress} onChange={(e) => setEdit({ ...edit, billingAddress: e.target.value })} /></Field>
            <Field label="City" id="profile-city"><Input id="profile-city" value={edit.city} onChange={(e) => setEdit({ ...edit, city: e.target.value })} /></Field>
            <div className="flex gap-2"><Button loading={busy} onClick={() => void save()}>Save changes</Button><Button variant="secondary" onClick={() => setEditing(false)}>Cancel</Button></div>
          </div>}
          <div className="mt-5"><Callout>To change your GST details or place of supply, contact {"support@brightloop.demo"} – tax details are verified by our team before they affect invoices.</Callout></div>
        </Card>
      </div>
    </div>
  );
}
