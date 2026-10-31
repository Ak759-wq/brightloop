"use client";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from "recharts";
import { money } from "@/lib/client/format";

const BLUE = "#1f4ae8", CYAN = "#22d3ee", SLATE = "#cbd5e1";
export const PALETTE = ["#1f4ae8", "#22d3ee", "#93b4ff", "#6366f1", "#0ea5e9", "#a5b4fc", "#14b8a6"];
const monthLabel = (m: string) => new Date(m + "-01T00:00:00").toLocaleDateString("en-IN", { month: "short" });
const axis = { stroke: "#94a3b8", fontSize: 11, tickLine: false, axisLine: false } as const;

function TooltipBox({ active, payload, label, labelFmt }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string; labelFmt?: (l: string) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      {label && <p className="mb-1 font-medium text-ink">{labelFmt ? labelFmt(label) : label}</p>}
      {payload.map((p) => <p key={p.name} className="flex items-center gap-2 text-slate-600"><span className="h-2 w-2 rounded-full" style={{ background: p.color }} />{p.name}: <b className="text-ink">{money(p.value)}</b></p>)}
    </div>
  );
}

export function RevenueChart({ data, height = 280 }: { data: { month: string; invoiced: number; collected: number }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#eef2f7" />
        <XAxis dataKey="month" tickFormatter={monthLabel} {...axis} />
        <YAxis tickFormatter={(v) => money(v, true)} width={64} {...axis} />
        <Tooltip content={<TooltipBox labelFmt={(l) => new Date(l + "-01T00:00:00").toLocaleDateString("en-IN", { month: "long", year: "numeric" })} />} />
        <Line type="monotone" dataKey="invoiced" name="Invoiced" stroke={CYAN} strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
        <Line type="monotone" dataKey="collected" name="Collected" stroke={BLUE} strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function MrrChart({ data, forecast }: { data: { month: string; mrr: number }[]; forecast: { month: string; mrr: number }[] }) {
  const merged = [...data.map((d) => ({ month: d.month, mrr: d.mrr, forecast: null as number | null })), ...forecast.map((f) => ({ month: f.month, mrr: null as number | null, forecast: f.mrr }))];
  if (data.length && forecast.length) merged[data.length - 1].forecast = data[data.length - 1].mrr;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={merged} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
        <defs><linearGradient id="mrrFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={BLUE} stopOpacity={0.22} /><stop offset="100%" stopColor={BLUE} stopOpacity={0} /></linearGradient></defs>
        <CartesianGrid vertical={false} stroke="#eef2f7" />
        <XAxis dataKey="month" tickFormatter={monthLabel} {...axis} />
        <YAxis tickFormatter={(v) => money(v, true)} width={64} {...axis} />
        <Tooltip content={<TooltipBox labelFmt={monthLabel} />} />
        <Area type="monotone" dataKey="mrr" name="MRR (estimate)" stroke={BLUE} strokeWidth={2.5} fill="url(#mrrFill)" connectNulls={false} />
        <Area type="monotone" dataKey="forecast" name="Forecast" stroke={BLUE} strokeDasharray="5 5" strokeWidth={2} fill="transparent" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function Donut({ data, center, sub }: { data: { name: string; value: number }[]; center: string; sub?: string }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={68} outerRadius={96} paddingAngle={3} cornerRadius={8} stroke="none">
            {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
          </Pie>
          <Tooltip content={<TooltipBox />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold tracking-tight">{center}</span>
        {sub && <span className="text-xs text-ink-muted">{sub}</span>}
      </div>
      <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
        {data.map((d, i) => <li key={d.name} className="flex items-center gap-1.5 truncate"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} /><span className="truncate text-slate-600">{d.name}</span><span className="ml-auto font-medium">{Math.round((d.value / total) * 100)}%</span></li>)}
      </ul>
    </div>
  );
}

export function AgeingBars({ data }: { data: { bucket: string; amount: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#eef2f7" />
        <XAxis dataKey="bucket" {...axis} />
        <YAxis tickFormatter={(v) => money(v, true)} width={64} {...axis} />
        <Tooltip content={<TooltipBox />} cursor={{ fill: "#f1f5f9" }} />
        <Bar dataKey="amount" name="Outstanding" radius={[8, 8, 0, 0]}>
          {data.map((d, i) => <Cell key={i} fill={i === 0 ? SLATE : ["#93b4ff", "#5f8bfb", "#1f4ae8", "#e11d48"][Math.min(i - 1, 3)]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function BridgeBars({ data }: { data: { label: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#eef2f7" />
        <XAxis dataKey="label" {...axis} />
        <YAxis tickFormatter={(v) => money(v, true)} width={64} {...axis} />
        <ReferenceLine y={0} stroke="#cbd5e1" />
        <Tooltip content={<TooltipBox />} cursor={{ fill: "#f1f5f9" }} />
        <Bar dataKey="value" name="MRR" radius={[6, 6, 6, 6]}>
          {data.map((d, i) => <Cell key={i} fill={i === 0 || i === data.length - 1 ? BLUE : d.value >= 0 ? "#10b981" : "#f43f5e"} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
