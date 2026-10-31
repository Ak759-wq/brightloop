"use client";
import Link from "next/link";
import { useState } from "react";
import { MailCheck } from "lucide-react";
import { useAuth } from "@/lib/client/auth";
import { Button, Callout, Field, Input } from "@/components/ui/primitives";

export default function ForgotPage() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
      <p className="mt-1 text-sm text-ink-muted">We&apos;ll send a reset link to your registered email.</p>
      <form className="mt-8 space-y-4" onSubmit={async (e) => { e.preventDefault(); setBusy(true); try { setMsg(await resetPassword(email)); } finally { setBusy(false); } }}>
        {msg && <Callout tone="green" icon={<MailCheck className="h-4 w-4" />}>{msg}</Callout>}
        <Field label="Email" id="email"><Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Button type="submit" size="lg" className="w-full" loading={busy}>Send reset link</Button>
      </form>
      <p className="mt-5 text-center text-sm"><Link href="/login" className="font-medium text-brand-600 hover:underline">Back to sign in</Link></p>
    </div>
  );
}
