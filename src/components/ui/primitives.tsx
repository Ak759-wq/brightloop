"use client";
import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { Loader2, Inbox } from "lucide-react";
import { cn } from "@/lib/client/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline" | "soft";
const variants: Record<Variant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 shadow-sm shadow-brand-600/20",
  secondary: "bg-white text-ink border border-slate-200 hover:bg-slate-50 shadow-card",
  outline: "border border-brand-200 text-brand-700 hover:bg-brand-50",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-ink",
  danger: "bg-rose-600 text-white hover:bg-rose-700",
  soft: "bg-brand-50 text-brand-700 hover:bg-brand-100",
};
const sizes = { sm: "h-8 px-3 text-xs gap-1.5", md: "h-10 px-4 text-sm gap-2", lg: "h-11 px-5 text-sm gap-2" };

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: keyof typeof sizes;
  loading?: boolean;
  icon?: ReactNode;
}
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = "primary", size = "md", loading, icon, className, children, disabled, ...rest }, ref) {
  return (
    <button ref={ref} disabled={disabled || loading} className={cn("inline-flex items-center justify-center rounded-full font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap", variants[variant], sizes[size], className)} {...rest}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});

export function IconButton({ label, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button aria-label={label} title={label} className={cn("inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-ink", className)} {...rest}>
      {children}
    </button>
  );
}

export function Card({ className, children, ...rest }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-2xl border border-slate-200/70 bg-white shadow-card", className)} {...rest}>{children}</div>;
}

export function CardHeader({ title, subtitle, icon, actions, className }: { title: ReactNode; subtitle?: ReactNode; icon?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-3 px-5 pt-5", className)}>
      <div className="flex items-center gap-3 min-w-0">
        {icon && <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy-900 text-white">{icon}</span>}
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-semibold text-ink">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

const pillTone: Record<string, string> = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  amber: "bg-amber-50 text-amber-700 ring-amber-600/20",
  red: "bg-rose-50 text-rose-700 ring-rose-600/15",
  blue: "bg-brand-50 text-brand-700 ring-brand-600/15",
  slate: "bg-slate-100 text-slate-600 ring-slate-500/15",
  violet: "bg-violet-50 text-violet-700 ring-violet-600/15",
  cyan: "bg-cyan-50 text-cyan-700 ring-cyan-600/15",
};
export function Badge({ tone = "slate", children, className, dot = false }: { tone?: keyof typeof pillTone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap", pillTone[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}

const STATUS_TONES: Record<string, keyof typeof pillTone> = {
  active: "green", paid: "green", succeeded: "green", success: "green", completed: "green", accepted: "green",
  draft: "slate", archived: "slate", closed: "slate", cancelled: "slate", skipped: "slate", inactive: "slate",
  quotation: "violet", sent: "violet", confirmed: "blue", running: "blue", pending: "amber", paused: "amber",
  partially_paid: "cyan", overdue: "red", failed: "red", locked: "amber", expired: "slate",
};
export function StatusPill({ status, label }: { status: string; label?: string }) {
  return <Badge tone={STATUS_TONES[status] ?? "slate"} dot>{label ?? status.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())}</Badge>;
}

export function Label({ htmlFor, children, hint }: { htmlFor?: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 flex items-center justify-between text-xs font-medium text-slate-700">
      <span>{children}</span>
      {hint && <span className="font-normal text-ink-soft">{hint}</span>}
    </label>
  );
}

const fieldBase = "w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-ink placeholder:text-ink-soft transition focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10 disabled:bg-slate-50 disabled:text-slate-500";
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(function Input({ className, invalid, ...rest }, ref) {
  return <input ref={ref} aria-invalid={invalid || undefined} className={cn(fieldBase, "h-10", invalid && "border-rose-400 focus:border-rose-500 focus:ring-rose-500/10", className)} {...rest} />;
});
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cn(fieldBase, "min-h-[80px] py-2", className)} {...rest} />;
});
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string }[]; placeholder?: string }>(function Select({ className, options, placeholder, ...rest }, ref) {
  return (
    <select ref={ref} className={cn(fieldBase, "h-10 pr-8", className)} {...rest}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
});

export function Field({ label, error, hint, children, id }: { label: string; error?: string; hint?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <div>
      <Label htmlFor={id} hint={hint}>{label}</Label>
      {children}
      {error && <p className="mt-1 text-xs text-rose-600" role="alert">{error}</p>}
    </div>
  );
}

export function Switch({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-slate-200 px-3 py-2.5 hover:bg-slate-50">
      <span>
        <span className="block text-sm font-medium text-ink">{label}</span>
        {description && <span className="block text-xs text-ink-muted">{description}</span>}
      </span>
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={cn("relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition", checked ? "bg-brand-600" : "bg-slate-300")}>
        <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition", checked ? "left-[18px]" : "left-0.5")} />
      </button>
    </label>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("relative overflow-hidden rounded-lg bg-slate-100", className)}><div className="absolute inset-0 -translate-x-full animate-[shimmer_1.4s_infinite] bg-gradient-to-r from-transparent via-white/70 to-transparent" /></div>;
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-5 w-5 animate-spin text-brand-600", className)} aria-label="Loading" />;
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">{icon ?? <Inbox className="h-6 w-6" />}</div>
      <p className="text-sm font-semibold text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
      <span>{message}</span>
      {onRetry && <Button size="sm" variant="secondary" onClick={onRetry}>Retry</Button>}
    </div>
  );
}

export function Callout({ tone = "blue", title, children, icon }: { tone?: "blue" | "amber" | "red" | "green"; title?: string; children: ReactNode; icon?: ReactNode }) {
  const t = { blue: "border-brand-200 bg-brand-50/60 text-brand-900", amber: "border-amber-200 bg-amber-50 text-amber-900", red: "border-rose-200 bg-rose-50 text-rose-900", green: "border-emerald-200 bg-emerald-50 text-emerald-900" }[tone];
  return (
    <div className={cn("flex gap-3 rounded-xl border px-4 py-3 text-sm", t)}>
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div>{title && <p className="font-semibold">{title}</p>}<div className={title ? "mt-0.5 opacity-90" : ""}>{children}</div></div>
    </div>
  );
}

export function Tabs({ tabs, value, onChange }: { tabs: { value: string; label: string; count?: number }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div role="tablist" className="inline-flex flex-wrap gap-1 rounded-full border border-slate-200 bg-white p-1 shadow-card">
      {tabs.map((t) => (
        <button key={t.value} role="tab" aria-selected={value === t.value} onClick={() => onChange(t.value)} className={cn("rounded-full px-3.5 py-1.5 text-xs font-medium transition", value === t.value ? "bg-brand-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100")}>
          {t.label}{t.count != null && <span className={cn("ml-1.5 rounded-full px-1.5 text-[10px]", value === t.value ? "bg-white/20" : "bg-slate-100")}>{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function DescList({ items, cols = 2 }: { items: { label: string; value: ReactNode }[]; cols?: 2 | 3 | 4 }) {
  return (
    <dl className={cn("grid gap-x-6 gap-y-4", cols === 2 ? "sm:grid-cols-2" : cols === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-4")}>
      {items.map((i) => (
        <div key={i.label} className="min-w-0">
          <dt className="text-xs text-ink-muted">{i.label}</dt>
          <dd className="mt-0.5 truncate text-sm font-medium text-ink">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}
