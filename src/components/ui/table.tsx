"use client";
import { useEffect, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { cn } from "@/lib/client/cn";
import type { ListState } from "@/lib/client/api";
import { Button, Card, EmptyState, ErrorNote, Select, Skeleton } from "./primitives";

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
  align?: "left" | "right";
  hideOnMobile?: boolean;
}

export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

export interface FilterDef { key: string; label: string; options: { value: string; label: string }[] }

export function Toolbar({ search, onSearch, placeholder = "Search…", filters = [], values = {}, onFilter, actions }: { search?: string; onSearch?: (v: string) => void; placeholder?: string; filters?: FilterDef[]; values?: Record<string, string>; onFilter?: (k: string, v: string) => void; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        {onSearch && (
          <div className="relative w-full md:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input aria-label="Search" value={search} onChange={(e) => onSearch(e.target.value)} placeholder={placeholder} className="h-9 w-full rounded-full border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-500/10" />
          </div>
        )}
        {filters.map((f) => (
          <Select key={f.key} aria-label={f.label} className="h-9 w-auto rounded-full bg-slate-50 text-xs" value={values[f.key] ?? ""} onChange={(e) => onFilter?.(f.key, e.target.value)} options={f.options} placeholder={`All ${f.label.toLowerCase()}`} />
        ))}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function DataTable<T extends { id: string }>({ columns, list, onRowClick, empty, toolbar, footerNote }: { columns: Column<T>[]; list: ListState<T>; onRowClick?: (row: T) => void; empty?: ReactNode; toolbar?: ReactNode; footerNote?: ReactNode }) {
  return (
    <Card className="overflow-hidden">
      {toolbar}
      {list.error ? (
        <div className="p-5"><ErrorNote message={list.error} onRetry={list.reload} /></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="bg-slate-50/80 text-left text-xs font-medium text-ink-muted">
                {columns.map((c) => <th key={c.key} scope="col" className={cn("px-5 py-3 font-medium", c.align === "right" && "text-right", c.hideOnMobile && "hidden md:table-cell", c.className)}>{c.header}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.loading && !list.items.length
                ? Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>{columns.map((c) => <td key={c.key} className={cn("px-5 py-3.5", c.hideOnMobile && "hidden md:table-cell")}><Skeleton className="h-4 w-full max-w-[140px]" /></td>)}</tr>
                  ))
                : list.items.map((row) => (
                    <tr key={row.id} onClick={onRowClick ? () => onRowClick(row) : undefined} onKeyDown={onRowClick ? (e) => e.key === "Enter" && onRowClick(row) : undefined} tabIndex={onRowClick ? 0 : undefined}
                      className={cn("transition-colors", onRowClick && "cursor-pointer hover:bg-brand-50/40 focus:bg-brand-50/60 focus:outline-none", list.loading && "opacity-60")}>
                      {columns.map((c) => <td key={c.key} className={cn("px-5 py-3.5 align-middle text-slate-700", c.align === "right" && "text-right tabular-nums", c.hideOnMobile && "hidden md:table-cell", c.className)}>{c.cell(row)}</td>)}
                    </tr>
                  ))}
            </tbody>
          </table>
          {!list.loading && !list.items.length && (empty ?? <EmptyState title="Nothing here yet" description="Try clearing filters or adding a record." />)}
        </div>
      )}
      <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-xs text-ink-muted">
        <span>Page {list.page}{list.tookMs != null && <span className="ml-2 text-ink-soft">· {list.tookMs} ms</span>}{footerNote && <span className="ml-2">{footerNote}</span>}</span>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={list.prev} disabled={list.page <= 1 || list.loading} icon={<ChevronLeft className="h-3.5 w-3.5" />}>Prev</Button>
          <Button size="sm" variant="secondary" onClick={list.next} disabled={!list.hasNext || list.loading}>Next<ChevronRight className="h-3.5 w-3.5" /></Button>
        </div>
      </div>
    </Card>
  );
}
