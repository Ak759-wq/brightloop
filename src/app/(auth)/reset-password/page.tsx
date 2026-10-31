"use client";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/client/api";
import { passwordIssues } from "@/lib/schemas";
import { Button, Callout, ErrorNote, Field, Input } from "@/components/ui/primitives";

function Inner() {
  const sp = useSearchParams();
  const [pw, setPw] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const issues = pw ? passwordIssues(pw) : [];
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
      <p className="mt-1 text-sm text-ink-muted">Local-mode reset. With Firebase configured, the emailed Firebase link is used instead.</p>
      {done ? <div className="mt-8"><Callout tone="green">Password updated. <Link className="font-semibold underline" href="/customer/login">Sign in</Link></Callout></div> : (
        <form className="mt-8 space-y-4" onSubmit={async (e) => { e.preventDefault(); setError(null); try { await api("/api/auth/local/reset", { body: { email: sp.get("email"), token: sp.get("token"), password: pw } }); setDone(true); } catch (err) { setError((err as Error).message); } }}>
          {error && <ErrorNote message={error} />}
          <Field label="New password" id="pw" error={issues[0]}><Input id="pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
          <Button type="submit" size="lg" className="w-full" disabled={!pw || issues.length > 0}>Update password</Button>
        </form>
      )}
    </div>
  );
}
export default function ResetPage() { return <Suspense><Inner /></Suspense>; }
