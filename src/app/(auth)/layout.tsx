import type { ReactNode } from "react";
import { Logo } from "@/components/shell/Logo";
import { CheckCircle2 } from "lucide-react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden overflow-hidden bg-navy-900 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-brand-600/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-10 h-96 w-96 rounded-full bg-cyan-500/20 blur-3xl" />
        <Logo />
        <div className="relative max-w-md">
          <h2 className="text-4xl font-semibold leading-tight tracking-tight">The digital backbone of a subscription business.</h2>
          <p className="mt-4 text-slate-300">Plans, subscriptions, GST invoices, payments and revenue intelligence – in one place, without spreadsheets.</p>
          <ul className="mt-8 space-y-3 text-sm text-slate-200">
            {["Billing runs on schedule – nothing billed twice or skipped", "CGST/SGST vs IGST from configured place of supply", "MRR, ARR, churn and receivables you can trust"].map((t) => (
              <li key={t} className="flex items-center gap-2.5"><CheckCircle2 className="h-4 w-4 text-cyan-300" />{t}</li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-slate-500">© Brightloop Software · Hackathon build</p>
      </div>
      <div className="flex items-center justify-center bg-canvas px-5 py-10">
        <div className="w-full max-w-[420px]">
          <div className="mb-8 lg:hidden"><Logo dark /></div>
          {children}
        </div>
      </div>
    </div>
  );
}
