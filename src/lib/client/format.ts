import { formatMoney } from "@/lib/finance/money";
import { INDIAN_STATES } from "@/lib/finance/tax";

/** Compact INR: ₹950, ₹14.1K, ₹2.05L, ₹1.2Cr (Indian units, never the ambiguous "T"). */
function compactINR(paise: number) {
  const r = paise / 100, a = Math.abs(r), sign = r < 0 ? "-" : "";
  const f = (v: number, u: string) => `${sign}₹${v >= 100 ? Math.round(v) : Number(v.toFixed(v >= 10 ? 1 : 2))}${u}`;
  if (a >= 1e7) return f(a / 1e7, "Cr");
  if (a >= 1e5) return f(a / 1e5, "L");
  if (a >= 1e3) return f(a / 1e3, "K");
  return `${sign}₹${Math.round(a)}`;
}
export const money = (paise: number | null | undefined, compact = false) => (compact ? compactINR(paise ?? 0) : formatMoney(paise ?? 0, "INR"));
export const rupeesToPaise = (v: string | number) => Math.round(Number(v || 0) * 100);
export const paiseToRupees = (p: number | null | undefined) => (p == null ? "" : String(p / 100));

export function date(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? iso + "T00:00:00" : iso);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
export function dateTime(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
export function ago(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
export const pct = (v: number | null | undefined, digits = 1) => (v == null ? "—" : `${(v * 100).toFixed(digits)}%`);
export const bpToPct = (bp: number) => `${(bp / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}%`;
export const stateName = (code?: string | null) => (code ? `${INDIAN_STATES[code] ?? code} (${code})` : "Not set");
export const STATE_OPTIONS = Object.entries(INDIAN_STATES).map(([value, label]) => ({ value, label: `${label} (${value})` }));
export const cap = (s: string) => s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
export const intervalText = (interval: string, count = 1) => {
  const u = { daily: "day", weekly: "week", monthly: "month", yearly: "year" }[interval] ?? interval;
  return count === 1 ? `/${u}` : `/${count} ${u}s`;
};
