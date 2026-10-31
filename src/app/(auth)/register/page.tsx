"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { useAuth } from "@/lib/client/auth";
import { GoogleButton, OrDivider } from "@/components/auth/GoogleButton";
import { homeFor } from "@/components/shell/nav";
import { registerSchema } from "@/lib/schemas";
import { STATE_OPTIONS } from "@/lib/client/format";
import { Button, ErrorNote, Field, Input, Select } from "@/components/ui/primitives";

const RULES = [
  { test: (p: string) => p.length > 8, label: "More than 8 characters" },
  { test: (p: string) => /[A-Z]/.test(p), label: "An uppercase letter" },
  { test: (p: string) => /[a-z]/.test(p), label: "A lowercase letter" },
  { test: (p: string) => /[^A-Za-z0-9]/.test(p), label: "A special character" },
];

export default function RegisterPage() {
  const { signUp } = useAuth();
  const [googleError, setGoogleError] = useState<string | null>(null);
  const router = useRouter();
  const [f, setF] = useState({ name: "", email: "", password: "", company: "", placeOfSupply: "29" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const r = registerSchema.safeParse(f);
    if (!r.success) {
      const errs: Record<string, string> = {};
      r.error.issues.forEach((i) => (errs[String(i.path[0])] ??= i.message));
      setErrors(errs);
      return;
    }
    setErrors({}); setBusy(true); setError(null);
    try {
      await signUp(r.data);
      router.replace("/portal/overview");
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
      <p className="mt-1 text-sm text-ink-muted">Manage your subscriptions and invoices without emailing anyone.</p>
      <div className="mt-8">
        <GoogleButton label="Sign up with Google" onDone={(s) => router.replace(homeFor(s.role))} onError={(m) => setGoogleError(m)} />
        {googleError && <p className="mt-2 text-sm text-red-600">{googleError}</p>}
      </div>
      <OrDivider />
      <form className="space-y-4" onSubmit={submit} noValidate>
        {error && <ErrorNote message={error} />}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" id="name" error={errors.name}><Input id="name" value={f.name} onChange={set("name")} invalid={!!errors.name} autoComplete="name" /></Field>
          <Field label="Company" id="company"><Input id="company" value={f.company} onChange={set("company")} autoComplete="organization" /></Field>
        </div>
        <Field label="Work email" id="email" error={errors.email}><Input id="email" type="email" value={f.email} onChange={set("email")} invalid={!!errors.email} autoComplete="email" /></Field>
        <Field label="State (place of supply for GST)" id="pos"><Select id="pos" value={f.placeOfSupply} onChange={set("placeOfSupply")} options={STATE_OPTIONS} /></Field>
        <Field label="Password" id="password" error={errors.password}>
          <Input id="password" type="password" value={f.password} onChange={set("password")} invalid={!!errors.password} autoComplete="new-password" />
          <ul className="mt-2 grid grid-cols-2 gap-1">
            {RULES.map((r) => {
              const ok = r.test(f.password);
              return <li key={r.label} className={`flex items-center gap-1.5 text-xs ${ok ? "text-emerald-600" : "text-ink-muted"}`}>{ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}{r.label}</li>;
            })}
          </ul>
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={busy}>Create account</Button>
      </form>
      <p className="mt-5 text-center text-sm text-ink-muted">Already have an account? <Link href="/customer/login" className="font-medium text-brand-600 hover:underline">Customer sign in</Link></p>
    </div>
  );
}
