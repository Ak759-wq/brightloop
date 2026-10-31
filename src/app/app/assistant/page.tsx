"use client";
import { useEffect, useRef, useState } from "react";
import { Bot, SendHorizontal, Sparkles, ShieldCheck } from "lucide-react";
import { api } from "@/lib/client/api";
import { useAuth } from "@/lib/client/auth";
import { PageHeader } from "@/components/shell/AppShell";
import { Badge, Button, Card } from "@/components/ui/primitives";
import { cn } from "@/lib/client/cn";

interface Msg { role: "user" | "assistant"; text: string; tool?: string; forecast?: boolean; engine?: string }
const SUGGESTIONS = ["How much revenue did we collect this month?", "What is our MRR?", "Which invoices are overdue?", "Renewals this week", "Top products", "How much MRR did churn cost us?", "Any repeated payment failures?", "Revenue collected last month", "Projected MRR for the next 3 months", "Outstanding receivables"];

export default function AssistantPage() {
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
      const r = await api<{ answer: string; tool: string; forecast?: boolean; engine: string }>("/api/assistant", { body: { question } });
      setMsgs((m) => [...m, { role: "assistant", text: r.answer, tool: r.tool, forecast: r.forecast, engine: r.engine }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: "assistant", text: `Sorry – ${(e as Error).message}` }]);
    } finally { setBusy(false); }
  }
  return (
    <div>
      <PageHeader title="AI Assistant" description="Ask about revenue, MRR, overdue invoices, renewals, churn and failures." actions={<Badge tone={modes?.llm ? "green" : "slate"}><ShieldCheck className="h-3 w-3" />{modes?.llm ? "LLM tool selection + whitelisted tools" : "Deterministic intent parser (no LLM key)"}</Badge>} />
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
        <Card className="h-fit p-5">
          <p className="text-sm font-semibold">Try asking</p>
          <div className="mt-3 flex flex-wrap gap-2">{SUGGESTIONS.map((s) => <button key={s} onClick={() => ask(s)} className="rounded-full border border-slate-200 px-3 py-1.5 text-left text-xs text-slate-600 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700">{s}</button>)}</div>
          <p className="mt-5 text-xs leading-relaxed text-ink-muted">Guardrails: only whitelisted query tools, role-checked server-side (customers only see their own data), no raw database access. Forecasts are always labelled.</p>
        </Card>
      </div>
    </div>
  );
}
