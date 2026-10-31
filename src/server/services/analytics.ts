import { addDays, addMonthsAnchored, normalizeToMonthly, outstanding, paymentSuccessRate, projectMrr, receivablesAgeing, sum, deriveStatus } from "@/lib/finance";
import type { Invoice, Payment, Subscription } from "@/lib/types";
import type { Ctx } from "./core";

const cache = new Map<string, { at: number; data: Analytics }>();

export interface Analytics {
  today: string;
  kpis: {
    mrr: number; arr: number; activeSubs: number; pausedSubs: number; activeCustomers: number; arpc: number;
    collectedThisMonth: number; collectedLastMonth: number; outstanding: number; overdueAmount: number; overdueCount: number;
    successRate: number | null; churnedLast30: number; churnLossMrr: number; newLast30: number; draftQuotes: number;
  };
  revenueTrend: { month: string; invoiced: number; collected: number }[];
  mrrTrend: { month: string; mrr: number; estimate: true }[];
  forecast: { month: string; mrr: number }[];
  forecastGrowth: number;
  ageing: ReturnType<typeof receivablesAgeing>;
  bridge: { start: number; newMrr: number; expansion: number; contraction: number; churned: number; end: number; estimate: true };
  planMix: { name: string; mrr: number; count: number }[];
  topProducts: { name: string; mrr: number }[];
  statusCounts: Record<string, number>;
  repeatedFailures: { invoiceId: string; number: string; customer: string; attempts: number }[];
  renewalsThisWeek: { id: string; number: string; customer: string; endDate: string }[];
  overdueList: { id: string; number: string; customer: string; outstanding: number; dueDate: string }[];
  computedMs: number;
}

const monthKey = (iso: string) => iso.slice(0, 7);

export async function computeAnalytics(ctx: Ctx, opts: { fresh?: boolean } = {}): Promise<Analytics> {
  const key = `${ctx.org.id}_${ctx.today}`;
  const hit = cache.get(key);
  if (!opts.fresh && hit && Date.now() - hit.at < 30_000) return hit.data;
  const t0 = Date.now();
  const [subs, invoices, payments, attempts, amendments] = await Promise.all([
    ctx.store.all<Subscription>("subscriptions", [["orgId", "==", ctx.org.id]]),
    ctx.store.all<Invoice>("invoices", [["orgId", "==", ctx.org.id]]),
    ctx.store.all<Payment>("payments", [["orgId", "==", ctx.org.id]]),
    ctx.store.all<{ status: "succeeded" | "failed" | "pending"; invoiceId: string }>("payment_attempts", [["orgId", "==", ctx.org.id]]),
    ctx.store.all<{ createdAt: string; oldAmount: number; newAmount: number; subscriptionId: string }>("subscription_amendments", [["orgId", "==", ctx.org.id]]),
  ]);
  const today = ctx.today;
  const m = (s: Subscription) => normalizeToMonthly(s.recurringAmount, s.interval, s.intervalCount);
  const active = subs.filter((s) => s.status === "active");
  const mrr = sum(active.map(m));
  const activeCustomers = new Set(active.map((s) => s.customerId)).size;
  const thisMonth = monthKey(today);
  const lastMonth = monthKey(addMonthsAnchored(today.slice(0, 8) + "01", -1));
  const netPay = (p: Payment) => p.amount - (p.amountRefunded ?? 0);
  const collectedThisMonth = sum(payments.filter((p) => monthKey(p.date) === thisMonth).map(netPay));
  const collectedLastMonth = sum(payments.filter((p) => monthKey(p.date) === lastMonth).map(netPay));
  const live = invoices.filter((i) => i.status !== "draft" && i.status !== "cancelled").map((i) => ({ ...i, status: deriveStatus(i, today), owed: outstanding(i) }));
  const overdue = live.filter((i) => i.status === "overdue");
  const start30 = addDays(today, -30);
  const churned = subs.filter((s) => s.status === "closed" && s.closedAt && s.closedAt.slice(0, 10) >= start30);
  const newSubs = subs.filter((s) => s.activatedAt && s.activatedAt.slice(0, 10) >= start30 && s.startDate);

  // Revenue trend (12 months)
  const months: string[] = [];
  for (let i = 11; i >= 0; i--) months.push(monthKey(addMonthsAnchored(today.slice(0, 8) + "01", -i)));
  const revenueTrend = months.map((mo) => ({
    month: mo,
    invoiced: sum(live.filter((i) => monthKey(i.invoiceDate) === mo).map((i) => i.totals.total)),
    collected: sum(payments.filter((p) => monthKey(p.date) === mo).map(netPay)),
  }));
  // MRR trend ESTIMATE: a subscription counts in a month if it started on/before month end and was not closed before month start (current amounts)
  const mrrTrend = months.map((mo) => {
    const end = addDays(addMonthsAnchored(mo + "-01", 1), -1);
    const startMo = mo + "-01";
    const v = sum(subs.filter((s) => s.startDate && s.startDate <= end && ["active", "paused", "closed"].includes(s.status) && !(s.status === "paused") && (!s.closedAt || s.closedAt.slice(0, 10) >= startMo)).map(m));
    return { month: mo, mrr: v, estimate: true as const };
  });
  const proj = projectMrr(mrrTrend.slice(-4).map((x) => x.mrr), 3);
  const forecast = proj.projected.map((v, i) => ({ month: monthKey(addMonthsAnchored(today.slice(0, 8) + "01", i + 1)), mrr: v }));

  const recentAmend = amendments.filter((a) => a.createdAt.slice(0, 10) >= start30);
  const expansion = sum(recentAmend.filter((a) => a.newAmount > a.oldAmount).map((a) => a.newAmount - a.oldAmount));
  const contraction = sum(recentAmend.filter((a) => a.newAmount < a.oldAmount).map((a) => a.oldAmount - a.newAmount));
  const churnLossMrr = sum(churned.map(m));
  const newMrr = sum(newSubs.filter((s) => s.status === "active").map(m));
  const bridge = { start: mrr - newMrr - expansion + contraction + churnLossMrr, newMrr, expansion, contraction, churned: churnLossMrr, end: mrr, estimate: true as const };

  const planMap = new Map<string, { name: string; mrr: number; count: number }>();
  const prodMap = new Map<string, number>();
  for (const s of active) {
    const e = planMap.get(s.planId) ?? { name: s.planName, mrr: 0, count: 0 };
    e.mrr += m(s); e.count++;
    planMap.set(s.planId, e);
    const subTotal = sum(s.items.map((i) => i.amount)) || 1;
    for (const it of s.items) prodMap.set(it.productName, (prodMap.get(it.productName) ?? 0) + Math.round((m(s) * it.amount) / subTotal));
  }
  const statusCounts: Record<string, number> = {};
  subs.forEach((s) => (statusCounts[s.status] = (statusCounts[s.status] ?? 0) + 1));
  const failuresByInv = new Map<string, number>();
  attempts.filter((a) => a.status === "failed").forEach((a) => failuresByInv.set(a.invoiceId, (failuresByInv.get(a.invoiceId) ?? 0) + 1));
  const repeatedFailures = [...failuresByInv.entries()].filter(([, n]) => n >= 2).map(([id, n]) => {
    const inv = invoices.find((i) => i.id === id);
    return { invoiceId: id, number: inv?.number ?? id, customer: inv?.customer.name ?? "", attempts: n };
  });
  const weekEnd = addDays(today, 7);
  const data: Analytics = {
    today,
    kpis: {
      mrr, arr: mrr * 12, activeSubs: active.length, pausedSubs: statusCounts.paused ?? 0, activeCustomers, arpc: activeCustomers ? Math.round(mrr / activeCustomers) : 0,
      collectedThisMonth, collectedLastMonth, outstanding: sum(live.map((i) => i.owed)), overdueAmount: sum(overdue.map((i) => i.owed)), overdueCount: overdue.length,
      successRate: paymentSuccessRate(attempts), churnedLast30: churned.length, churnLossMrr, newLast30: newSubs.length,
      draftQuotes: (statusCounts.draft ?? 0) + (statusCounts.quotation ?? 0),
    },
    revenueTrend, mrrTrend, forecast, forecastGrowth: proj.growthRate,
    ageing: receivablesAgeing(live.map((i) => ({ dueDate: i.dueDate, outstanding: i.owed })), today),
    bridge,
    planMix: [...planMap.values()].sort((a, b) => b.mrr - a.mrr),
    topProducts: [...prodMap.entries()].map(([name, v]) => ({ name, mrr: v })).sort((a, b) => b.mrr - a.mrr).slice(0, 6),
    statusCounts,
    repeatedFailures,
    renewalsThisWeek: active.filter((s) => s.endDate && s.endDate >= today && s.endDate <= weekEnd).map((s) => ({ id: s.id, number: s.number, customer: s.customerName, endDate: s.endDate! })),
    overdueList: overdue.sort((a, b) => b.owed - a.owed).slice(0, 10).map((i) => ({ id: i.id, number: i.number, customer: i.customer.name, outstanding: i.owed, dueDate: i.dueDate })),
    computedMs: Date.now() - t0,
  };
  cache.set(key, { at: Date.now(), data });
  return data;
}

export function invalidateAnalytics() {
  cache.clear();
}
