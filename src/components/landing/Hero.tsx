"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, CheckCircle2, Sparkles, Zap } from "lucide-react";
import { AuroraCanvas } from "./AuroraCanvas";
import { LogoMark } from "@/components/shell/Logo";

function useCountUp(target: number, ms = 1600, delay = 600) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setV(target); return; }
    let raf = 0; const start = performance.now() + delay;
    const tick = (now: number) => {
      const k = Math.min(1, Math.max(0, (now - start) / ms));
      setV(target * (1 - Math.pow(1 - k, 4)));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms, delay]);
  return v;
}

const inr = (n: number) => "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });

const EVENTS = [
  { who: "Northwind Labs", what: "Invoice INV-2026-000412 paid", amt: 24780, tone: "emerald" },
  { who: "Kavya Foods", what: "Upgraded CRM → Yearly (prorated)", amt: 61200, tone: "blue" },
  { who: "Orbit Media", what: "Renewal billed · GST 18% (IGST)", amt: 14160, tone: "cyan" },
  { who: "Lumen Health", what: "Retry succeeded after dunning", amt: 8850, tone: "emerald" },
  { who: "Sahyadri Tech", what: "Usage overage · 12,400 API calls", amt: 3720, tone: "blue" },
] as const;

function LiveFeed() {
  const [i, setI] = useState(0);
  useEffect(() => { const id = setInterval(() => setI((x) => x + 1), 2600); return () => clearInterval(id); }, []);
  const rows = [0, 1, 2].map((k) => ({ ...EVENTS[(i + k) % EVENTS.length], key: i + k }));
  return (
    <ul className="space-y-2">
      {rows.map((r, k) => (
        <li key={r.key} className="hero-feed-row flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2" style={{ opacity: 1 - k * 0.25 }}>
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${r.tone === "emerald" ? "bg-emerald-400" : r.tone === "cyan" ? "bg-cyan-300" : "bg-blue-400"} shadow-[0_0_10px_currentColor]`} />
          <span className="min-w-0 flex-1 truncate text-[11px] text-slate-300"><span className="font-medium text-white">{r.who}</span> · {r.what}</span>
          <span className="text-[11px] font-medium tabular-nums text-emerald-300">+{inr(r.amt)}</span>
        </li>
      ))}
    </ul>
  );
}

const CHART = "M0,120 C40,112 60,118 90,100 C120,82 140,92 170,76 C200,60 225,70 255,52 C285,34 310,44 340,30 C370,18 395,24 420,12";

function DashboardMock() {
  const mrr = useCountUp(1984320);
  const nrr = useCountUp(112.4, 1600, 800);
  const subs = useCountUp(1286, 1600, 700);
  return (
    <div className="relative rounded-[22px] border border-white/10 bg-[#0b1226]/70 p-2 shadow-[0_40px_120px_-20px_rgba(31,74,232,0.55)] backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-0 rounded-[22px] bg-[linear-gradient(180deg,rgba(255,255,255,0.08),transparent_30%)]" />
      <div className="flex items-center gap-1.5 px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" /><span className="h-2.5 w-2.5 rounded-full bg-white/15" /><span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <span className="mx-auto rounded-md bg-white/[0.04] px-3 py-0.5 text-[10px] text-slate-400">app.brightloop.in/overview</span>
      </div>
      <div className="grid grid-cols-[150px_1fr] gap-2 max-md:grid-cols-1">
        <aside className="rounded-2xl bg-white/[0.025] p-3 max-md:hidden">
          <div className="flex items-center gap-2"><LogoMark size={18} /><span className="text-[11px] font-semibold text-white">Brightloop</span></div>
          <div className="mt-4 space-y-1">
            {["Overview", "Subscriptions", "Invoices", "Payments", "Analytics", "Copilot"].map((x, i) => (
              <div key={x} className={`rounded-md px-2 py-1.5 text-[10.5px] ${i === 0 ? "bg-blue-500/20 text-white" : "text-slate-400"}`}>{x}</div>
            ))}
          </div>
        </aside>
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            {[
              { k: "MRR", v: inr(mrr), d: "+8.2%" },
              { k: "Net revenue retention", v: `${nrr.toFixed(1)}%`, d: "+3.1 pts" },
              { k: "Active subscriptions", v: Math.round(subs).toLocaleString("en-IN"), d: "+64" },
            ].map((s) => (
              <div key={s.k} className="rounded-2xl bg-white/[0.03] p-3">
                <p className="truncate text-[10px] text-slate-400">{s.k}</p>
                <p className="mt-1 text-[15px] font-semibold tabular-nums text-white sm:text-lg">{s.v}</p>
                <p className="text-[10px] text-emerald-300">{s.d}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-[1.5fr_1fr] gap-2 max-sm:grid-cols-1">
            <div className="rounded-2xl bg-white/[0.03] p-3">
              <div className="flex items-center justify-between"><p className="text-[10.5px] text-slate-300">Recurring revenue</p><p className="text-[10px] text-slate-500">12 months</p></div>
              <svg viewBox="0 0 420 130" className="mt-2 h-[120px] w-full overflow-visible">
                <defs>
                  <linearGradient id="hero-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3a66f5" stopOpacity=".45" /><stop offset="1" stopColor="#3a66f5" stopOpacity="0" /></linearGradient>
                  <linearGradient id="hero-line" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#5f8bfb" /><stop offset="1" stopColor="#22d3ee" /></linearGradient>
                </defs>
                {[30, 60, 90].map((y) => <line key={y} x1="0" x2="420" y1={y} y2={y} stroke="white" strokeOpacity=".05" />)}
                <path d={`${CHART} L420,130 L0,130 Z`} fill="url(#hero-area)" className="hero-area" />
                <path d={CHART} fill="none" stroke="url(#hero-line)" strokeWidth="2.5" strokeLinecap="round" className="hero-line" pathLength={1} />
                <circle r="4" fill="#22d3ee" className="hero-dot"><animateMotion dur="5s" repeatCount="indefinite" path={CHART} keyPoints="0;1" keyTimes="0;1" calcMode="linear" /></circle>
                <circle r="10" fill="#22d3ee" opacity=".25" className="hero-dot"><animateMotion dur="5s" repeatCount="indefinite" path={CHART} /></circle>
              </svg>
            </div>
            <div className="rounded-2xl bg-white/[0.03] p-3">
              <div className="mb-2 flex items-center justify-between"><p className="text-[10.5px] text-slate-300">Billing run · live</p><span className="flex items-center gap-1 text-[10px] text-emerald-300"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />running</span></div>
              <LiveFeed />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const WORDS = ["Recurring", "revenue,"];
const GRAD = ["on", "autopilot."];

export function Hero({ signedIn, dashboardHref }: { signedIn: boolean; dashboardHref: string }) {
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = root.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const set = (x: number, y: number) => { el.style.setProperty("--mx", x.toFixed(3)); el.style.setProperty("--my", y.toFixed(3)); };
    const onMove = (e: PointerEvent) => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => set(e.clientX / window.innerWidth - 0.5, e.clientY / window.innerHeight - 0.5)); };
    const onScroll = () => el.style.setProperty("--sp", Math.min(1, window.scrollY / 500).toFixed(3));
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true }); onScroll();
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, []);

  return (
    <section ref={root} className="relative isolate overflow-hidden bg-navy-950 pb-32 pt-32 text-white sm:pt-36" style={{ backgroundImage: "radial-gradient(60% 50% at 50% 0%, rgba(58,102,245,.35), transparent 70%), radial-gradient(40% 40% at 50% 85%, rgba(34,211,238,.18), transparent 70%)", ["--mx" as string]: 0, ["--my" as string]: 0, ["--sp" as string]: 0 }}>
      <div className="hero-aurora pointer-events-none absolute inset-0 -z-30" aria-hidden><span /><span /><span /></div>
      <AuroraCanvas className="absolute inset-0 -z-20 h-full w-full" />
      <div className="hero-grid pointer-events-none absolute inset-0 -z-10" />
      <div className="hero-beam pointer-events-none absolute left-[18%] top-0 -z-10 h-40 w-px" />
      <div className="hero-beam pointer-events-none absolute left-[82%] top-0 -z-10 h-40 w-px [animation-delay:-3s]" />

      <div className="mx-auto max-w-5xl px-6 text-center">
        <Link href="#features" className="hero-badge group relative mx-auto inline-flex items-center gap-2 rounded-full bg-white/[0.04] px-4 py-1.5 text-xs text-slate-200 backdrop-blur" style={{ animationDelay: "0ms" }}>
          <span className="hero-badge-border" aria-hidden />
          <Sparkles className="h-3.5 w-3.5 text-cyan-300" /> AI revenue copilot is here
          <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
        </Link>
        <h1 className="mt-7 text-[clamp(2.6rem,7vw,5.4rem)] font-semibold leading-[1.02] tracking-[-0.045em]">
          {WORDS.map((w, i) => <span key={w} className="hero-word inline-block" style={{ animationDelay: `${120 + i * 90}ms` }}>{w}&nbsp;</span>)}
          <br className="max-sm:hidden" />
          {GRAD.map((w, i) => (
            <span key={w} className="hero-word hero-gradient-text inline-block" style={{ animationDelay: `${320 + i * 90}ms` }}>{w}{i === 0 ? "\u00a0" : ""}</span>
          ))}
        </h1>
        <p className="hero-fade mx-auto mt-6 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg" style={{ animationDelay: "560ms" }}>
          Plans, subscriptions, GST invoices, payments and revenue analytics in one place. Brightloop bills on schedule, collects, retries and reports, so you never touch a spreadsheet again.
        </p>
        <div className="hero-fade mt-9 flex flex-wrap items-center justify-center gap-3" style={{ animationDelay: "680ms" }}>
          <Link href={signedIn ? dashboardHref : "/register"} className="hero-cta group relative inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-navy-900 transition hover:-translate-y-0.5">
            {signedIn ? "Open dashboard" : "Start for free"} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </Link>
          {!signedIn && (
            <Link href="/login" className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-6 py-3 text-sm font-medium text-white backdrop-blur transition hover:bg-white/10">Sign in</Link>
          )}
        </div>
        <div className="hero-fade mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-slate-400" style={{ animationDelay: "800ms" }}>
          {["GST-compliant invoices", "Idempotent billing runs", "No card required"].map((t) => (
            <span key={t} className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-cyan-300" />{t}</span>
          ))}
        </div>
      </div>

      <div className="hero-stage relative mx-auto mt-16 max-w-6xl px-4 sm:px-6">
        <div className="hero-mock">
          <DashboardMock />
        </div>
        <div className="hero-float hero-float-a absolute -top-12 left-10 hidden rounded-2xl border border-white/10 bg-white/[0.06] p-3 text-left shadow-2xl backdrop-blur-xl lg:block">
          <p className="flex items-center gap-1.5 text-[11px] text-slate-300"><Zap className="h-3.5 w-3.5 text-amber-300" />Proration</p>
          <p className="mt-1 text-sm font-semibold">₹2,316.13 credited</p>
          <p className="text-[10px] text-slate-400">Upgrade mid-cycle · 17 of 30 days</p>
        </div>
        <div className="hero-float hero-float-b absolute -bottom-14 right-10 hidden rounded-2xl border border-white/10 bg-white/[0.06] p-3 text-left shadow-2xl backdrop-blur-xl lg:block">
          <p className="text-[11px] text-slate-300">Tax split · Karnataka → Karnataka</p>
          <div className="mt-1.5 flex gap-2 text-xs font-medium"><span className="rounded-md bg-blue-500/20 px-2 py-0.5">CGST 9%</span><span className="rounded-md bg-cyan-400/20 px-2 py-0.5">SGST 9%</span></div>
        </div>
      </div>
    </section>
  );
}
