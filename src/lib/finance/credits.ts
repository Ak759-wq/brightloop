/**
 * Credit wallet. Balances are integer credits. Ledger entries are append-only.
 * Low-balance alert fires when balance drops to/below 20% (configurable) of the last top-up.
 */
export type OveragePolicy = "block" | "overage";

export interface WalletState {
  balance: number;
  lastTopUp: number;
  lowBalancePct: number;
  policy: OveragePolicy;
}

export interface ConsumeResult {
  allowed: boolean;
  balanceAfter: number;
  consumed: number;
  overageUnits: number;
  lowBalance: boolean;
  crossedLowBalance: boolean;
  reason?: string;
}

export function lowBalanceThreshold(w: Pick<WalletState, "lastTopUp" | "lowBalancePct">): number {
  return Math.floor((w.lastTopUp * w.lowBalancePct) / 100);
}

export function consumeCredits(w: WalletState, units: number): ConsumeResult {
  if (!Number.isInteger(units) || units <= 0) throw new Error("Usage quantity must be a positive whole number");
  const threshold = lowBalanceThreshold(w);
  const wasLow = w.balance <= threshold;
  if (w.balance >= units) {
    const after = w.balance - units;
    return { allowed: true, balanceAfter: after, consumed: units, overageUnits: 0, lowBalance: after <= threshold, crossedLowBalance: !wasLow && after <= threshold };
  }
  if (w.policy === "block") {
    return { allowed: false, balanceAfter: w.balance, consumed: 0, overageUnits: 0, lowBalance: true, crossedLowBalance: false, reason: "Insufficient credits (policy: block)" };
  }
  const covered = Math.max(0, w.balance);
  const overage = units - covered;
  return { allowed: true, balanceAfter: w.balance - units, consumed: covered, overageUnits: overage, lowBalance: true, crossedLowBalance: !wasLow };
}

export function topUp(w: WalletState, credits: number): WalletState {
  if (!Number.isInteger(credits) || credits <= 0) throw new Error("Top-up must be a positive whole number of credits");
  return { ...w, balance: w.balance + credits, lastTopUp: credits };
}
