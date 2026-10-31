"use client";
import { useEffect, useRef, useState } from "react";
import { Bot, KeyRound, SendHorizontal, Sparkles, ShieldCheck, Trash2 } from "lucide-react";
import { api } from "@/lib/client/api";
import { useAuth } from "@/lib/client/auth";
import { PageHeader } from "@/components/shell/AppShell";
import { Badge, Button, Card } from "@/components/ui/primitives";
import { cn } from "@/lib/client/cn";

interface Msg { role: "user" | "assistant"; text: string; tool?: string; forecast?: boolean; engine?: string }
const SUGGESTIONS = ["How much revenue did we collect this month?", "What is our MRR?", "Which invoices are overdue?", "Renewals this week", "Top products", "How much MRR did churn cost us?", "Any repeated payment failures?", "Revenue collected last month", "Projected MRR for the next 3 months", "Outstanding receivables"];

type Provider = "openai" | "gemini" | "openrouter";
interface LlmCfg { provider: Provider; apiKey: string; model?: string }
const STORE = "brightloop.assistant.llm";
const PROVIDERS: { id: Provider; label: string; hint: string }[] = [
  { id: "openai", label: "OpenAI", hint: "gpt-4o-mini" },
  { id: "gemini", label: "Google Gemini", hint: "gemini-2.0-flash" },
  { id: "openrouter", label: "OpenRouter", hint: "openai/gpt-4o-mini" },
];

function KeyPanel({ cfg, onChange }: { cfg: LlmCfg | null; onChange: (c: LlmCfg | null) => void }) {
  const [provider, setProvider] = useState<Provider>(cfg?.provider ?? "openai");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(cfg?.model ?? "");
  const hint = PROVIDERS.find((p) => p.id === provider)!.hint;
  return (
    <Card className="h-fit p-5">
      <p className="flex items-center gap-2 text-sm font-semibold"><KeyRound className="h-4 w-4 text-brand-600" />Use your own AI key</p>
      {cfg ? (
        <div className="mt-3 space-y-2 text-xs text-ink-muted">
          <p><span className="font-medium text-ink">{PROVIDERS.find((p) => p.id === cfg.provider)!.label}</span> key ending <code>…{cfg.apiKey.slice(-4)}</code>{cfg.model ? <> · model <code>{cfg.model}</code></> : null}</p>
          <Button variant="secondary" size="sm" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => onChange(null)}>Remove key</Button>
        </div>
      ) : (
        <form className="mt-3 space-y-2" onSubmit={(e) => { e.preventDefault(); if (apiKey.trim().length >= 10) { onChange({ provider, apiKey: apiKey.trim(), model: model.trim() || undefined }); setApiKey(""); } }}>
          <label className="block text-xs font-medium text-slate-700" htmlFor="llm-provider">Provider</label>
          <select id="llm-provider" value={provider} onChange={(e) => setProvider(e.target.value as Provider)} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm">
            {PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <label className="block text-xs font-medium text-slate-700" htmlFor="llm-key">API key</label>
          <input id="llm-key" type="password" autoComplete="off" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-… / AIza…" className="h-9 w-full rounded-lg border border-slate-200 px-2 text-sm" />
          <label className="block text-xs font-medium text-slate-700" htmlFor="llm-model">Model <span className="font-normal text-ink-soft">(optional)</span></label>
          <input id="llm-model" value={model} onChange={(e) => setModel(e.target.value)} placeholder={hint} className="h-9 w-full rounded-lg border border-slate-200 px-2 text-sm" />
          <Button type="submit" size="sm" disabled={apiKey.trim().length < 10}>Save key</Button>
        </form>
      )}
      <p className="mt-3 text-[11px] leading-relaxed text-ink-muted">Stored only in this browser and sent with each question over HTTPS. The server uses it for that request and never saves or logs it. The model only picks which permission-checked tool to run, so it never sees your raw data.</p>
    </Card>
  );
}

export default function AssistantPage() {
  const [llm, setLlm] = useState<LlmCfg | null>(null);
  useEffect(() => { try { const v = localStorage.getItem(STORE); if (v) setLlm(JSON.parse(v)); } catch { /* ignore */ } }, []);
  const saveLlm = (c: LlmCfg | null) => { setLlm(c); if (c) localStorage.setItem(STORE, JSON.stringify(c)); else localStorage.removeItem(STORE); };
  const { modes } = useAuth();
  const [msgs, setMsgs] = useState<Msg[]>([{ role: "assistant", text: "Hi! I answer billing questions using whitelisted, permission-checked queries on your live data. I never invent numbers – every figure comes from a tool result." }]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth" }), [msgs]);
  async function ask(question: string) {
    if (!question.trim()) return;
    setMsgs((m) => [...m, { role: "user", text: question }]);
    setQ(""); setBusy(true);
    try {
      const r = await api<{ answer: string; tool: string; forecast?: boolean; engine: string; llmError?: string }>("/api/assistant", { body: llm ? { question, llm } : { question } });
      setMsgs((m) => [...m, { role: "assistant", text: r.answer, tool: r.tool, forecast: r.forecast, engine: r.llmError ? `${r.engine} · AI key issue: ${r.llmError}` : r.engine }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: "assistant", text: `Sorry – ${(e as Error).message}` }]);
    } finally { setBusy(false); }
  }
  return (
    <div>
      <PageHeader title="AI Assistant" description="Ask about revenue, MRR, overdue invoices, renewals, churn and failures." actions={<Badge tone={llm || modes?.llm ? "green" : "slate"}><ShieldCheck className="h-3 w-3" />{llm ? "Your AI key + whitelisted tools" : modes?.llm ? "LLM tool selection + whitelisted tools" : "Deterministic intent parser (add a key for AI)"}</Badge>} />
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <Card className="flex h-[calc(100vh-15rem)] min-h-[480px] flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto p-5" aria-live="polite">
            {msgs.map((m, i) => (
              <div key={i} className={cn("flex gap-3", m.role === "user" && "justify-end")}>
                {m.role === "assistant" && <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-600 to-cyan-400 text-white"><Bot className="h-4 w-4" /></span>}
                <div className={cn("max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed", m.role === "user" ? "bg-brand-600 text-white" : "bg-slate-100 text-ink")}>
                  {m.forecast && <Badge tone="amber" className="mb-1">Forecast – estimate</Badge>}
                  <p>{m.text}</p>
                  {m.tool && <p className="mt-1.5 text-[11px] text-ink-muted">Source: <code>{m.tool}</code> tool · {m.engine}</p>}
                </div>
              </div>
            ))}
            {busy && <div className="flex gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100"><Sparkles className="h-4 w-4 animate-pulse text-brand-600" /></span><div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-ink-muted">Querying…</div></div>}
            <div ref={end} />
          </div>
          <form className="flex gap-2 border-t border-slate-100 p-3" onSubmit={(e) => { e.preventDefault(); void ask(q); }}>
            <input aria-label="Ask a question" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. revenue collected 2026-10-01 to 2026-10-31" className="h-11 flex-1 rounded-full border border-slate-200 px-4 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10" />
            <Button type="submit" size="lg" loading={busy} icon={<SendHorizontal className="h-4 w-4" />}>Ask</Button>
          </form>
        </Card>
        <div className="space-y-6">
        <KeyPanel cfg={llm} onChange={saveLlm} />
        <Card className="h-fit p-5">
          <p className="text-sm font-semibold">Try asking</p>
          <div className="mt-3 flex flex-wrap gap-2">{SUGGESTIONS.map((s) => <button key={s} onClick={() => ask(s)} className="rounded-full border border-slate-200 px-3 py-1.5 text-left text-xs text-slate-600 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700">{s}</button>)}</div>
          <p className="mt-5 text-xs leading-relaxed text-ink-muted">Guardrails: only whitelisted query tools, role-checked server-side (customers only see their own data), no raw database access. Forecasts are always labelled.</p>
        </Card>
        </div>
      </div>
    </div>
  );
}
