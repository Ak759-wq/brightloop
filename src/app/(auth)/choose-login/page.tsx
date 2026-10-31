import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, UserRound } from "lucide-react";

const OPTIONS = [
  {
    href: "/customer/login",
    title: "Customer",
    body: "Manage your subscriptions, invoices, payments and account.",
    icon: UserRound,
  },
  {
    href: "/team/login",
    title: "Admin / Staff",
    body: "Manage the Brightloop workspace, customers, billing and reports.",
    icon: BriefcaseBusiness,
  },
];

export default function ChooseLoginPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">How will you use Brightloop?</h1>
      <p className="mt-1 text-sm text-ink-muted">Choose the account type to continue to the correct sign-in page.</p>
      <div className="mt-8 space-y-3">
        {OPTIONS.map(({ href, title, body, icon: Icon }) => (
          <Link key={href} href={href} className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-300 hover:shadow-md">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><Icon className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{title}</span>
              <span className="mt-1 block text-sm text-ink-muted">{body}</span>
            </span>
            <ArrowRight className="h-4 w-4 text-ink-soft transition group-hover:translate-x-0.5 group-hover:text-brand-600" />
          </Link>
        ))}
      </div>
      <p className="mt-6 text-center text-sm text-ink-muted">Already have a customer account? <Link href="/customer/login" className="font-medium text-brand-600 hover:underline">Customer sign in</Link></p>
    </div>
  );
}
