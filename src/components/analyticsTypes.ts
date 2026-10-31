export interface Analytics {
  today: string;
  kpis: { mrr: number; arr: number; activeSubs: number; pausedSubs: number; activeCustomers: number; arpc: number; collectedThisMonth: number; collectedLastMonth: number; outstanding: number; overdueAmount: number; overdueCount: number; successRate: number | null; churnedLast30: number; churnLossMrr: number; newLast30: number; draftQuotes: number };
  revenueTrend: { month: string; invoiced: number; collected: number }[];
  mrrTrend: { month: string; mrr: number }[];
  forecast: { month: string; mrr: number }[];
  forecastGrowth: number;
  ageing: { current: number; d1_30: number; d31_60: number; d61_90: number; d90_plus: number };
  bridge: { start: number; newMrr: number; expansion: number; contraction: number; churned: number; end: number };
  planMix: { name: string; mrr: number; count: number }[];
  topProducts: { name: string; mrr: number }[];
  statusCounts: Record<string, number>;
  repeatedFailures: { invoiceId: string; number: string; customer: string; attempts: number }[];
  renewalsThisWeek: { id: string; number: string; customer: string; endDate: string }[];
  overdueList: { id: string; number: string; customer: string; outstanding: number; dueDate: string }[];
  computedMs: number;
}
