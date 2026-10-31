"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/client/auth";
import type { AuthEntry } from "@/lib/auth-entry";
import { Button, Field, Input, ErrorNote } from "@/components/ui/primitives";
import { homeFor } from "@/components/shell/nav";
import { GoogleButton, OrDivider } from "@/components/auth/GoogleButton";

export function LoginForm({ entry }: { entry?: AuthEntry }) {
  const { signIn, user, loading } = useAuth();
  const router = useRouter();
  const next = useSearchParams().get("next");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const title = entry === "team" ? "Admin & Staff sign in" : "Welcome back";
  const subtitle = entry === "team" ? "Sign in to manage your Brightloop workspace." : "Sign in to your Brightloop account.";

  useEffect(() => {
    if (!loading && user) router.replace(next && next.startsWith("/") ? next : homeFor(user.role));
  }, [loading, user, next, router]);

  async function go(e: string, p: string, key: string) {
    setBusy(key); setError(null);
    try {
      const s = await signIn(e, p, entry);
      router.replace(next && next.startsWith("/") ? next : homeFor(s.role));
    } catch (err) {
      setError((err as Error).message);
    } finally { setBusy(null); }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>
      <div className="mt-8">
        <GoogleButton entry={entry} onDone={(s) => router.replace(next && next.startsWith("/") ? next : homeFor(s.role))} onError={setError} />
      </div>
      <OrDivider />
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void go(email, password, "form"); }}>
        {error && <ErrorNote message={error} />}
        <Field label="Email" id="email"><Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" /></Field>
        <Field label="Password" id="password" hint={<Link href="/forgot-password" className="text-brand-600 hover:underline">Forgot password?</Link>}>
          <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Button type="submit" className="w-full" size="lg" loading={busy === "form"}>Sign in</Button>
      </form>
      {entry === "team" ? (
        <p className="mt-5 text-center text-sm text-ink-muted">Customer? <Link href="/customer/login" className="font-medium text-brand-600 hover:underline">Customer sign in</Link></p>
      ) : (
        <p className="mt-5 text-center text-sm text-ink-muted">New to Brightloop? <Link href="/register" className="font-medium text-brand-600 hover:underline">Create an account</Link></p>
      )}
    </div>
  );
}

export function LoginPage({ entry }: { entry?: AuthEntry }) {
  return <Suspense><LoginForm entry={entry} /></Suspense>;
}
