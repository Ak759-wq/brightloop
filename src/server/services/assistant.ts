import { addDays, addMonthsAnchored, formatMoney, outstanding, sum } from "@/lib/finance";
import type { Invoice, Payment, Role, Subscription } from "@/lib/types";
import { computeAnalytics } from "./analytics";
import { getWallet } from "./usage";
import type { Ctx } from "./core";

/**
 * AI ASSISTANT – whitelisted, permission-aware query tools only.
 * The model (optional) may only CHOOSE a tool and its arguments; every number in the answer
 * comes from the tool result. No raw database access, no free-form queries.
 */
export type ToolName =
  | "revenue_collected" | "mrr" | "active_subscriptions" | "overdue_invoices" | "renewals_this_week" | "top_products"
  | "churn_loss" | "repeated_failures" | "projected_mrr" | "outstanding_receivables"
  | "my_outstanding" | "my_subscriptions" | "my_credits" | "help";

const STAFF_TOOLS: ToolName[] = ["revenue_collected", "mrr", "active_subscriptions", "overdue_invoices", "renewals_this_week", "top_products", "churn_loss", "repeated_failures", "projected_mrr", "outstanding_receivables", "help"];
const CUSTOMER_TOOLS: ToolName[] = ["my_outstanding", "my_subscriptions", "my_credits", "help"];

export function toolsFor(role: Role): ToolName[] {
  return role === "customer" ? CUSTOMER_TOOLS : STAFF_TOOLS;
}

export interface Range { from: string; to: string; label: string }

export function parseRange(q: string, today: string): Range {
  const s = q.toLowerCase();
  const explicit = s.match(/(\d{4}-\d{2}-\d{2})\s*(?:to|-|until|and)\s*(\d{4}-\d{2}-\d{2})/);
  if (explicit) return { from: explicit[1], to: explicit[2], label: `${explicit[1]} to ${explicit[2]}` };
  const monthStart = today.slice(0, 8) + "01";
  if (/last month|previous month/.test(s)) {
    const from = addMonthsAnchored(monthStart, -1);
    return { from, to: addDays(monthStart, -1), label: "last month" };
  }
  if (/this year|ytd|year to date/.test(s)) return { from: today.slice(0, 4) + "-01-01", to: today, label: "this year" };
  const lastN = s.match(/last (\d+) days/);
  if (lastN) return { from: addDays(today, -Number(lastN[1])), to: today, label: `the last ${lastN[1]} days` };
  if (/this week/.test(s)) return { from: addDays(today, -6), to: today, label: "the last 7 days" };
  if (/today/.test(s)) return { from: today, to: today, label: "today" };
  return { from: monthStart, to: today, label: "this month" };
}

/** Deterministic intent parser (used when no LLM key is set, and as a fallback). */
export function parseIntent(q: string, role: Role): ToolName {
  const s = q.toLowerCase();
  if (role === "customer") {
    if (/credit|usage|wallet|balance of credits/.test(s)) return "my_credits";
    if (/owe|outstanding|due|unpaid|invoice|pay/.test(s)) return "my_outstanding";
    if (/subscri|plan|renew/.test(s)) return "my_subscriptions";
    return "help";
  }
  if (/forecast|project|predict|next month.*mrr|mrr.*next/.test(s)) return "projected_mrr";
  if (/fail|declin|dunning/.test(s)) return "repeated_failures";
  if (/churn|cancel|lost/.test(s)) return "churn_loss";
  if (/renew/.test(s)) return "renewals_this_week";
  if (/overdue|late/.test(s)) return "overdue_invoices";
  if (/outstanding|receivable|owed|unpaid/.test(s)) return "outstanding_receivables";
  if (/top product|best product|best.?selling|top plan|which product/.test(s)) return "top_products";
  if (/\bmrr\b|\barr\b|recurring revenue|run.?rate/.test(s)) return "mrr";
  if (/active sub|how many sub|subscriptions? (are )?active|subscriber/.test(s)) return "active_subscriptions";
  if (/revenue|collected|income|cash|received|payments?/.test(s)) return "revenue_collected";
  return "help";
}

export interface ToolAnswer {
  tool: ToolName;
  answer: string;
  data?: unknown;
  forecast?: boolean;
  range?: Range;
}

const money = (n: number) => formatMoney(n);

export async function runTool(ctx: Ctx, tool: ToolName, question: string): Promise<ToolAnswer> {
  const role = ctx.actor.role === "system" ? "admin" : ctx.actor.role;
  if (!toolsFor(role).includes(tool)) return { tool: "help", answer: "That information isn't available for your role." };
  if (tool === "help") {
    return {
      tool,
      answer: role === "customer"
        ? "I can tell you what you owe, your active subscriptions and renewal dates, and your credit balance. Try “What do I owe?”"
        : "I can answer: revenue collected (this month, last month, last 30 days, or a date range), MRR/ARR, active subscriptions, overdue invoices, renewals this week, top products, churn loss, repeated payment failures, outstanding receivables and a labelled MRR forecast.",
    };
  }
  if (role === "customer") {
    const cid = ctx.actor.customerId!;
    if (tool === "my_outstanding") {
      const invs = await ctx.store.all<Invoice>("invoices", [["orgId", "==", ctx.org.id], ["customerId", "==", cid]]);
      const open = invs.filter((i) => !["draft", "cancelled", "paid"].includes(i.status) && outstanding(i) > 0);
      const total = sum(open.map(outstanding));
      return { tool, answer: open.length ? `You have ${open.length} unpaid invoice${open.length > 1 ? "s" : ""} totalling ${money(total)}. Oldest due date: ${open.map((i) => i.dueDate).sort()[0]}.` : "You're all paid up – no outstanding invoices.", data: open.map((i) => ({ number: i.number, outstanding: outstanding(i), dueDate: i.dueDate })) };
    }
    if (tool === "my_subscriptions") {
      const subs = await ctx.store.all<Subscription>("subscriptions", [["orgId", "==", ctx.org.id], ["customerId", "==", cid]]);
      const act = subs.filter((s) => s.status === "active" || s.status === "paused");
      return { tool, answer: act.length ? act.map((s) => `${s.planName} (${s.number}) is ${s.status}${s.nextBillingDate ? `, next bill ${s.nextBillingDate}` : ""}`).join(". ") + "." : "You have no active subscriptions.", data: act };
    }
    const w = await getWallet(ctx, cid);
    return { tool, answer: `Your credit balance is ${w.balance} credits${w.lastTopUp ? ` (last top-up ${w.lastTopUp})` : ""}.`, data: w };
  }

  const a = await computeAnalytics(ctx);
  switch (tool) {
    case "revenue_collected": {
      const range = parseRange(question, ctx.today);
      const pays = await ctx.store.all<Payment>("payments", [["orgId", "==", ctx.org.id], ["date", ">=", range.from], ["date", "<=", range.to]]);
      const total = sum(pays.map((p) => p.amount - (p.amountRefunded ?? 0)));
      return { tool, range, answer: `Revenue collected ${range.label} (${range.from} → ${range.to}): ${money(total)} from ${pays.length} payment${pays.length === 1 ? "" : "s"}, net of refunds.`, data: { total, count: pays.length } };
    }
    case "mrr":
      return { tool, answer: `MRR is ${money(a.kpis.mrr)} (ARR ${money(a.kpis.arr)}) across ${a.kpis.activeSubs} active subscriptions; ARPC ${money(a.kpis.arpc)}.`, data: a.kpis };
    case "active_subscriptions":
      return { tool, answer: `${a.kpis.activeSubs} subscriptions are active, ${a.kpis.pausedSubs} paused, ${a.kpis.draftQuotes} in draft/quotation.`, data: a.statusCounts };
    case "overdue_invoices":
      return { tool, answer: a.kpis.overdueCount ? `${a.kpis.overdueCount} invoices are overdue, totalling ${money(a.kpis.overdueAmount)}. Largest: ${a.overdueList.slice(0, 3).map((o) => `${o.number} (${o.customer}, ${money(o.outstanding)})`).join(", ")}.` : "No invoices are overdue.", data: a.overdueList };
    case "renewals_this_week":
      return { tool, answer: a.renewalsThisWeek.length ? `${a.renewalsThisWeek.length} subscriptions reach their end date in the next 7 days: ${a.renewalsThisWeek.slice(0, 5).map((r) => `${r.number} (${r.customer}, ${r.endDate})`).join(", ")}.` : "No subscriptions reach their end date in the next 7 days.", data: a.renewalsThisWeek };
    case "top_products":
      return { tool, answer: a.topProducts.length ? `Top products by MRR: ${a.topProducts.slice(0, 5).map((p, i) => `${i + 1}. ${p.name} ${money(p.mrr)}`).join("; ")}.` : "No active revenue yet.", data: a.topProducts };
    case "churn_loss":
      return { tool, answer: `${a.kpis.churnedLast30} subscriptions closed in the last 30 days, losing ${money(a.kpis.churnLossMrr)} of MRR.`, data: { churned: a.kpis.churnedLast30, loss: a.kpis.churnLossMrr } };
    case "repeated_failures":
      return { tool, answer: a.repeatedFailures.length ? `${a.repeatedFailures.length} invoices have 2+ failed payment attempts: ${a.repeatedFailures.slice(0, 5).map((f) => `${f.number} (${f.customer}, ${f.attempts} fails)`).join(", ")}.` : "No invoices have repeated payment failures.", data: a.repeatedFailures };
    case "projected_mrr":
      return { tool, forecast: true, answer: `FORECAST (estimate, not actuals): at the recent average monthly growth of ${(a.forecastGrowth * 100).toFixed(1)}%, MRR would be ${a.forecast.map((f) => `${money(f.mrr)} in ${f.month}`).join(", ")}.`, data: a.forecast };
    case "outstanding_receivables":
      return { tool, answer: `Outstanding receivables: ${money(a.kpis.outstanding)}, of which ${money(a.kpis.overdueAmount)} is overdue. Ageing – current ${money(a.ageing.current)}, 1–30 days ${money(a.ageing.d1_30)}, 31–60 ${money(a.ageing.d31_60)}, 61–90 ${money(a.ageing.d61_90)}, 90+ ${money(a.ageing.d90_plus)}.`, data: a.ageing };
    default:
      return { tool: "help", answer: "I couldn't match that to a supported question." };
  }
}

/** Optional LLM tool selection. Returns null on any failure (deterministic parser is used instead). */
async function llmPickTool(question: string, tools: ToolName[]): Promise<ToolName | null> {
  const prompt = `Pick exactly one tool for this billing question. Tools: ${tools.join(", ")}. Reply with only the tool name.\nQuestion: ${question}`;
  try {
    if (process.env.OPENAI_API_KEY) {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: process.env.OPENAI_MODEL || "gpt-4o-mini", temperature: 0, messages: [{ role: "user", content: prompt }] }),
        signal: AbortSignal.timeout(8000),
      });
      const j = (await r.json()) as { choices?: { message?: { content?: string } }[] };
      const t = j.choices?.[0]?.message?.content?.trim() as ToolName;
      return tools.includes(t) ? t : null;
    }
    if (process.env.GEMINI_API_KEY) {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        signal: AbortSignal.timeout(8000),
      });
      const j = (await r.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      const t = j.candidates?.[0]?.content?.parts?.[0]?.text?.trim() as ToolName;
      return tools.includes(t) ? t : null;
    }
  } catch {
    return null;
  }
  return null;
}

export async function ask(ctx: Ctx, question: string) {
  const role = ctx.actor.role === "system" ? "admin" : ctx.actor.role;
  const tools = toolsFor(role);
  const llm = await llmPickTool(question, tools);
  const tool = llm ?? parseIntent(question, role);
  const res = await runTool(ctx, tool, question);
  return { ...res, engine: llm ? "llm-tool-selection" : "deterministic-parser" };
}
