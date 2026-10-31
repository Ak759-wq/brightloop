"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldCheck, Users, UserRound } from "lucide-react";
import { useAuth } from "@/lib/client/auth";
import { Button, Field, Input, ErrorNote } from "@/components/ui/primitives";
import { homeFor } from "@/components/shell/nav";

const DEMOS = [
  { label: "Admin", email: "admin@brightloop.demo", password: "Admin@12345", icon: ShieldCheck },
  { label: "Staff", email: "staff@brightloop.demo", password: "Staff@12345", icon: Users },
  { label: "Customer", email: "customer@brightloop.demo", password: "Customer@123", icon: UserRound },
];

function LoginInner() {
  const { signIn, user, loading, modes } = useAuth();
  const router = useRouter();
  const next = useSearchParams().get("next");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => { if (!loading && user) router.replace(next && next.startsWith("/") ? next : homeFor(user.role)); }, [loading, user, next, router]);
  async function go(e: string, p: string, key: string) {
    setBusy(key); setError(null);
    try {
      const s = await signIn(e, p);
      router.replace(next && next.startsWith("/") ? next : homeFor(s.role));
    } catch (err) {
      setError((err as Error).message);
    } finally { setBusy(null); }
  }
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mt-1 text-sm text-ink-muted">Sign in to your Brightloop workspace.</p>
      <form className="mt-8 space-y-4" onSubmit={(e) => { e.preventDefault(); void go(email, password, "form"); }}>
        {error && <ErrorNote message={error} />}
        <Field label="Email" id="email"><Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" /></Field>
        <Field label="Password" id="password" hint={<Link href="/forgot-password" className="text-brand-600 hover:underline">Forgot password?</Link>}>
          <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Button type="submit" className="w-full" size="lg" loading={busy === "form"}>Sign in</Button>
      </form>
      <p className="mt-5 text-center text-sm text-ink-muted">New to Brightloop? <Link href="/register" className="font-medium text-brand-600 hover:underline">Create an account</Link></p>
      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Demo accounts</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {DEMOS.map((d) => (
            <Button key={d.label} variant="secondary" size="sm" loading={busy === d.label} icon={<d.icon className="h-3.5 w-3.5" />} onClick={() => go(d.email, d.password, d.label)}>{d.label}</Button>
          ))}
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-ink-soft">Auth: {modes?.auth === "firebase" ? "Firebase Authentication" : "local demo auth"} · Data: {modes?.backend === "firestore" ? "Firestore" : "local JSON store"}</p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return <Suspense><LoginInner /></Suspense>;
}
