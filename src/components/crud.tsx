"use client";
import { useEffect, useMemo, useState } from "react";
import { api, ApiError, useApi } from "@/lib/client/api";
import { STATE_OPTIONS } from "@/lib/client/format";
import { Button, Field, Input, Select, Switch, Textarea } from "./ui/primitives";
import { Modal } from "./ui/overlay";
import { useToast } from "./ui/toast";
import { cn } from "@/lib/client/cn";

export type FieldType = "text" | "email" | "number" | "money" | "signedMoney" | "percent" | "select" | "multiselect" | "switch" | "textarea" | "date" | "tags" | "state";
export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  options?: { value: string; label: string }[];
  placeholder?: string;
  hint?: string;
  span?: 1 | 2;
  showIf?: (v: Record<string, unknown>) => boolean;
  nullable?: boolean;
  description?: string;
}

/** Convert API values (paise / basis points) into form strings. */
export function toForm(fields: FieldDef[], doc: Record<string, unknown> | null): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    const v = doc?.[f.name];
    if (f.type === "money" || f.type === "signedMoney") out[f.name] = v == null ? "" : String((v as number) / 100);
    else if (f.type === "percent") out[f.name] = v == null ? "" : String((v as number) / 100);
    else if (f.type === "number") out[f.name] = v == null ? "" : String(v);
    else if (f.type === "switch") out[f.name] = v ?? true;
    else if (f.type === "multiselect") out[f.name] = (v as string[]) ?? [];
    else if (f.type === "tags") out[f.name] = ((v as string[]) ?? []).join(", ");
    else out[f.name] = v ?? "";
  }
  return out;
}

export function fromForm(fields: FieldDef[], values: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    if (f.showIf && !f.showIf(values)) { if (f.nullable) out[f.name] = null; continue; }
    const v = values[f.name];
    const empty = v === "" || v == null;
    switch (f.type) {
      case "money": case "signedMoney": out[f.name] = empty ? (f.nullable ? null : 0) : Math.round(Number(v) * 100); break;
      case "percent": out[f.name] = empty ? (f.nullable ? null : 0) : Math.round(Number(v) * 100); break;
      case "number": out[f.name] = empty ? (f.nullable ? null : 0) : Number(v); break;
      case "date": out[f.name] = empty ? null : v; break;
      case "select": case "state": out[f.name] = empty ? (f.nullable ? null : "") : v; break;
      case "tags": out[f.name] = String(v ?? "").split(",").map((s) => s.trim()).filter(Boolean); break;
      default: out[f.name] = v;
    }
  }
  return out;
}

export function FormFields({ fields, values, onChange, errors }: { fields: FieldDef[]; values: Record<string, unknown>; onChange: (name: string, v: unknown) => void; errors: Record<string, string> }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {fields.filter((f) => !f.showIf || f.showIf(values)).map((f) => {
        const id = `f-${f.name}`;
        const v = values[f.name];
        const err = errors[f.name];
        const span = f.span === 2 || f.type === "textarea" || f.type === "multiselect" || f.type === "switch" ? "sm:col-span-2" : "";
        if (f.type === "switch") return <div key={f.name + f.label} className={span}><Switch checked={!!v} onChange={(x) => onChange(f.name, x)} label={f.label} description={f.description} /></div>;
        return (
          <div key={f.name + f.label} className={span}>
            <Field label={f.label} id={id} error={err} hint={f.hint}>
              {f.type === "textarea" ? <Textarea id={id} value={String(v ?? "")} onChange={(e) => onChange(f.name, e.target.value)} placeholder={f.placeholder} />
                : f.type === "select" ? <Select id={id} value={String(v ?? "")} onChange={(e) => onChange(f.name, e.target.value)} options={f.options ?? []} placeholder={f.placeholder ?? "Select…"} />
                : f.type === "state" ? <Select id={id} value={String(v ?? "")} onChange={(e) => onChange(f.name, e.target.value)} options={STATE_OPTIONS} placeholder="Not configured" />
                : f.type === "multiselect" ? (
                  <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 p-2">
                    {(f.options ?? []).map((o) => {
                      const on = (v as string[]).includes(o.value);
                      return <button type="button" key={o.value} aria-pressed={on} onClick={() => onChange(f.name, on ? (v as string[]).filter((x) => x !== o.value) : [...(v as string[]), o.value])} className={cn("rounded-full border px-3 py-1 text-xs transition", on ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50")}>{o.label}</button>;
                    })}
                    {!f.options?.length && <span className="text-xs text-ink-muted">No options</span>}
                  </div>
                )
                : (
                  <div className="relative">
                    {(f.type === "money" || f.type === "signedMoney") && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-muted">₹</span>}
                    <Input id={id} invalid={!!err} type={f.type === "email" ? "email" : f.type === "date" ? "date" : ["number", "money", "signedMoney", "percent"].includes(f.type) ? "number" : "text"}
                      step={f.type === "money" || f.type === "signedMoney" ? "0.01" : f.type === "percent" ? "0.01" : undefined} min={f.type === "money" ? 0 : undefined}
                      className={cn((f.type === "money" || f.type === "signedMoney") && "pl-7", f.type === "percent" && "pr-8")} value={String(v ?? "")} onChange={(e) => onChange(f.name, e.target.value)} placeholder={f.placeholder} />
                    {f.type === "percent" && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-muted">%</span>}
                  </div>
                )}
            </Field>
          </div>
        );
      })}
    </div>
  );
}

export function ResourceFormModal({ open, onClose, collection, title, fields, doc, onSaved, extra, defaults }: {
  open: boolean; onClose: () => void; collection: string; title: string; fields: FieldDef[]; doc?: (Record<string, unknown> & { id: string }) | null;
  onSaved?: (d: Record<string, unknown>) => void; extra?: (values: Record<string, unknown>, set: (n: string, v: unknown) => void) => React.ReactNode; defaults?: Record<string, unknown>;
}) {
  const toast = useToast();
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setValues({ ...toForm(fields, doc ? doc : (defaults ?? null)), __extra: doc && Array.isArray(doc.tiers) && (doc.tiers as unknown[]).length ? { tiers: doc.tiers } : undefined }); setErrors({}); } }, [open, doc?.id]);
  const set = (n: string, v: unknown) => setValues((x) => ({ ...x, [n]: v }));
  async function save() {
    setBusy(true); setErrors({});
    try {
      const payload = { ...fromForm(fields, values), ...(values.__extra as Record<string, unknown> ?? {}) };
      const saved = await api<Record<string, unknown>>(doc ? `/api/r/${collection}/${doc.id}` : `/api/r/${collection}`, { method: doc ? "PATCH" : "POST", body: payload });
      toast.success(doc ? "Saved" : "Created", typeof saved.name === "string" ? saved.name : undefined);
      onSaved?.(saved);
      onClose();
    } catch (e) {
      if (e instanceof ApiError && e.fields) setErrors(e.fields);
      toast.error("Could not save", (e as Error).message);
    } finally { setBusy(false); }
  }
  return (
    <Modal open={open} onClose={onClose} title={title} size="lg" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={save}>{doc ? "Save changes" : "Create"}</Button></>}>
      <form onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <FormFields fields={fields} values={values} onChange={set} errors={errors} />
        {extra?.(values, set)}
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

/** Options for selects from a collection (first 100). */
export function useOptions<T extends { id: string }>(collection: string, label: (d: T) => string, params = "") {
  const { data, reload } = useApi<{ items: T[] }>(`/api/r/${collection}?limit=100${params}`);
  const items = data?.items ?? [];
  const options = useMemo(() => items.map((d) => ({ value: d.id, label: label(d) })), [data]);
  const byId = useMemo(() => Object.fromEntries(items.map((d) => [d.id, d])), [data]) as Record<string, T>;
  return { options, items, byId, reload };
}
