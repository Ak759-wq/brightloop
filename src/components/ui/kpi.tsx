"use client";
import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/client/cn";
import { Card, Skeleton } from "./primitives";

export function KpiCard({ label, value, icon, delta, deltaLabel, hint, loading, tone = "default", badge }: { label: string; value: ReactNode; icon?: ReactNode; delta?: number | null; deltaLabel?: ReactNode; hint?: ReactNode; loading?: boolean; tone?: "default" | "danger"; badge?: ReactNode }) {
  const up = (delta ?? 0) >= 0;
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          {icon && <span className={cn("flex h-9 w-9 items-center justify-center rounded-full", tone === "danger" ? "bg-rose-600 text-white" : "bg-navy-900 text-white")}>{icon}</span>}
          <span className="text-sm font-medium text-slate-700">{label}</span>
        </div>
        {badge}
      </div>
      {loading ? <Skeleton className="mt-4 h-8 w-32" /> : (
        <div className="mt-4 flex items-end justify-between gap-2">
          <span className="text-[28px] font-semibold leading-none tracking-tight text-ink tabular-nums">{value}</span>
          {delta != null && (
            <span className={cn("inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium", up ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700")}>
              {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}{Math.abs(delta * 100).toFixed(1)}%
            </span>
          )}
        </div>
      )}
      {(hint || deltaLabel) && <p className="mt-3 text-xs text-ink-muted">{deltaLabel ?? hint}</p>}
    </Card>
  );
}

export function InsightCard({ title = "AI Insight", children, action }: { title?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-700 via-brand-600 to-cyan-500 p-5 text-white shadow-lift">
      <div className="pointer-events-none absolute -bottom-16 -left-10 h-48 w-48 rotate-12 rounded-[40px] bg-white/10" />
      <div className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-white/10" />
      <div className="relative flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 backdrop-blur"><Sparkles className="h-4 w-4" /></span>
        <span className="text-[15px] font-semibold">{title}</span>
      </div>
      <div className="relative mt-4 text-[15px] font-medium leading-snug">{children}</div>
      {action && <div className="relative mt-4 flex justify-end">{action}</div>}
    </div>
  );
}
