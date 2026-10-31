"use client";
import { useState, type ReactNode } from "react";
import { Pencil, Plus, Archive } from "lucide-react";
import { api, useList } from "@/lib/client/api";
import { useAuth } from "@/lib/client/auth";
import { canWrite } from "@/lib/permissions";
import { PageHeader } from "./shell/AppShell";
import { Button, EmptyState } from "./ui/primitives";
import { DataTable, Toolbar, useDebounced, type Column, type FilterDef } from "./ui/table";
import { ResourceFormModal, type FieldDef } from "./crud";
import { useConfirm } from "./ui/overlay";
import { useToast } from "./ui/toast";

export function CrudListPage<T extends { id: string; name?: string }>({ title, description, collection, columns, fields, filters = [], searchPlaceholder, singular, defaults, onRowClick, rowActions, headerActions, extraForm, fixedParams = {}, emptyIcon, archiveLabel = "Archive", above }: {
  title: string; description?: string; collection: string; columns: Column<T>[]; fields: FieldDef[]; filters?: FilterDef[]; searchPlaceholder?: string; singular: string;
  defaults?: Record<string, unknown>; onRowClick?: (row: T) => void; rowActions?: (row: T, reload: () => void) => ReactNode; headerActions?: ReactNode;
  extraForm?: (values: Record<string, unknown>, set: (n: string, v: unknown) => void) => ReactNode; fixedParams?: Record<string, string>; emptyIcon?: ReactNode; archiveLabel?: string; above?: ReactNode;
}) {
  const { user } = useAuth();
  const writable = !!user && canWrite(user.role, collection);
  const [q, setQ] = useState("");
  const [fv, setFv] = useState<Record<string, string>>({});
  const dq = useDebounced(q);
  const list = useList<T>(collection, { q: dq, ...fv, ...fixedParams });
  const [editing, setEditing] = useState<T | null>(null);
  const [creating, setCreating] = useState(false);
  const confirm = useConfirm();
  const toast = useToast();
  const actionCol: Column<T> = {
    key: "_actions", header: "", align: "right", className: "w-[1%] whitespace-nowrap",
    cell: (row) => (
      <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
        {rowActions?.(row, list.reload)}
        {writable && <Button size="sm" variant="ghost" aria-label={`Edit ${row.name ?? singular}`} icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditing(row)}>Edit</Button>}
        {writable && <Button size="sm" variant="ghost" aria-label={`${archiveLabel} ${row.name ?? singular}`} icon={<Archive className="h-3.5 w-3.5" />} onClick={async () => {
          const r = await confirm({ title: `${archiveLabel} ${singular}?`, body: `“${row.name ?? row.id}” will be ${archiveLabel === "Delete" ? "deleted" : "archived and hidden from new sales. Existing records keep their history"}.`, confirmLabel: archiveLabel, danger: true });
          if (!r.ok) return;
          try { await api(`/api/r/${collection}/${row.id}`, { method: "DELETE" }); toast.success(`${singular} ${archiveLabel === "Delete" ? "deleted" : "archived"}`); list.reload(); } catch (e) { toast.error("Failed", (e as Error).message); }
        }} />}
      </div>
    ),
  };
  return (
    <div>
      <PageHeader title={title} description={description} actions={<>{headerActions}{writable && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>New {singular.toLowerCase()}</Button>}</>} />
      {above}
      <DataTable columns={[...columns, actionCol]} list={list} onRowClick={onRowClick}
        toolbar={<Toolbar search={q} onSearch={setQ} placeholder={searchPlaceholder} filters={filters} values={fv} onFilter={(k, v) => setFv((x) => ({ ...x, [k]: v }))} />}
        empty={<EmptyState icon={emptyIcon} title={q || Object.values(fv).some(Boolean) ? "No matches" : `No ${title.toLowerCase()} yet`} description={q ? "Try a different search (prefix of a word or email)." : writable ? `Create your first ${singular.toLowerCase()} to get started.` : undefined} action={writable && !q ? <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>New {singular.toLowerCase()}</Button> : undefined} />} />
      <ResourceFormModal open={creating || !!editing} onClose={() => { setCreating(false); setEditing(null); }} collection={collection} title={editing ? `Edit ${singular.toLowerCase()}` : `New ${singular.toLowerCase()}`} fields={fields} doc={editing as never} defaults={defaults} onSaved={() => list.reload()} extra={extraForm} />
    </div>
  );
}
