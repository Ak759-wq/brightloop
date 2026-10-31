"use client";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/client/cn";

type Tone = "success" | "error" | "info";
interface T { id: number; tone: Tone; title: string; body?: string }
const Ctx = createContext<(tone: Tone, title: string, body?: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<T[]>([]);
  const push = useCallback((tone: Tone, title: string, body?: string) => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x.slice(-3), { id, tone, title, body }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), tone === "error" ? 7000 : 4500);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-2">
        {items.map((t) => (
          <div key={t.id} className="pointer-events-auto flex animate-fade-in items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-lg">
            {t.tone === "success" ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : t.tone === "error" ? <XCircle className="h-5 w-5 text-rose-600" /> : <Info className="h-5 w-5 text-brand-600" />}
            <div className="min-w-0 flex-1">
              <p className={cn("text-sm font-semibold", t.tone === "error" ? "text-rose-700" : "text-ink")}>{t.title}</p>
              {t.body && <p className="mt-0.5 text-xs text-ink-muted">{t.body}</p>}
            </div>
            <button aria-label="Dismiss" onClick={() => setItems((x) => x.filter((i) => i.id !== t.id))} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const push = useContext(Ctx);
  return {
    success: (title: string, body?: string) => push("success", title, body),
    error: (title: string, body?: string) => push("error", title, body),
    info: (title: string, body?: string) => push("info", title, body),
  };
}
