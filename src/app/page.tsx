"use client";
import Link from "next/link";
import { BarChart3, CalendarClock, CreditCard, ReceiptIndianRupee, ShieldCheck, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/client/auth";
import { homeFor } from "@/components/shell/nav";
import { Logo } from "@/components/shell/Logo";
import { Hero } from "@/components/landing/Hero";

const FEATURES = [
  { icon: CalendarClock, title: "Billing that runs itself", body: "Daily, weekly, monthly or yearly cycles with month-end and leap-year handling. Idempotent runs, never billed twice." },
  { icon: ReceiptIndianRupee, title: "GST-ready invoices", body: "CGST + SGST or IGST from place of supply, HSN/SAC codes, credit notes and clean PDF-ready invoices." },
  { icon: CreditCard, title: "Payments & dunning", body: "Partial payments, refunds, retries and reminders, with every rupee reconciled against its invoice." },
  { icon: BarChart3, title: "Revenue intelligence", body: "MRR, ARR, NRR, churn and receivables ageing — computed from the ledger, not a spreadsheet." },
  { icon: Sparkles, title: "AI copilot", body: "Ask “who is overdue this week?” and get answers scoped to what your role is allowed to see." },
  { icon: ShieldCheck, title: "Roles & audit trail", body: "Admin, staff and customer portals with permission checks and an immutable audit log." },
];

export default function Landing() {
  const { user } = useAuth();
  const dash = user ? homeFor(user.role) : "/login";
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="absolute inset-x-0 top-0 z-40 border-b border-white/[0.06]">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link href="/" aria-label="Brightloop home"><Logo /></Link>
          <div className="hidden items-center gap-8 text-sm text-slate-300 md:flex">
            <a href="#features" className="hover:text-white">Features</a>
            <a href="#how" className="hover:text-white">How it works</a>
          </div>
          <div className="flex items-center gap-2">
            {user ? (
              <Link href={dash} className="rounded-full bg-white px-4 py-2 text-sm font-medium text-navy-900 hover:bg-blue-50">Dashboard</Link>
            ) : (
              <>
                <Link href="/login" className="rounded-full px-4 py-2 text-sm font-medium text-white hover:bg-white/10">Sign in</Link>
                <Link href="/register" className="rounded-full bg-white px-4 py-2 text-sm font-medium text-navy-900 hover:bg-blue-50">Get started</Link>
              </>
            )}
          </div>
        </nav>
      </header>

      <Hero signedIn={!!user} dashboardHref={dash} />

      <section id="features" className="mx-auto max-w-6xl px-6 py-24">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">Everything a subscription business runs on</p>
        <h2 className="mx-auto mt-3 max-w-2xl text-center text-3xl font-medium tracking-tight sm:text-4xl">From first quote to recognised revenue, in one place.</h2>
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-brand-900/5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><f.icon className="h-5 w-5" /></span>
              <h3 className="mt-4 font-medium">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="how" className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-8 rounded-[2rem] bg-navy-900 p-10 text-white sm:p-14 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div>
            <h2 className="text-3xl font-medium tracking-tight sm:text-4xl">Plant a plan. Watch it compound.</h2>
            <p className="mt-4 max-w-lg text-slate-300">Create products and pricing, send a quotation, confirm the subscription. Brightloop invoices on schedule, collects, retries and reports — so revenue keeps growing without you watching it.</p>
          </div>
          <ol className="space-y-4 text-sm">
            {["Build your catalog and plans", "Quote, confirm and activate", "Invoices and GST go out automatically", "Track MRR, churn and collections"].map((t, i) => (
              <li key={t} className="flex items-center gap-4"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 font-medium">{i + 1}</span>{t}</li>
            ))}
          </ol>
        </div>
        <div className="mt-12 flex flex-col items-center gap-4 text-center">
          <Link href={user ? dash : "/register"} className="rounded-full bg-brand-600 px-7 py-3 text-sm font-medium text-white shadow-lg shadow-brand-600/30 hover:bg-brand-700">{user ? "Open dashboard" : "Start for free"}</Link>
        </div>
      </section>

      <footer className="border-t border-slate-200 py-8 text-center text-xs text-ink-soft">© {new Date().getFullYear()} Brightloop · Subscriptions, billing &amp; revenue intelligence</footer>
    </div>
  );
}
