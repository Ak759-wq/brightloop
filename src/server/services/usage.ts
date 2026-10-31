import { consumeCredits, topUp } from "@/lib/finance";
import type { Subscription } from "@/lib/types";
import { DomainError, HttpError, notFound } from "../http";
import { newId } from "../store/types";
import { audit, notify, nowISO, stamp, type Ctx } from "./core";
import { emit } from "./events";

export interface Wallet {
  id: string;
  orgId: string;
  customerId: string;
  balance: number;
  lastTopUp: number;
  lowBalancePct: number;
  policy: "block" | "overage";
  createdAt: string;
  updatedAt: string;
}

export const walletId = (customerId: string) => `wallet_${customerId}`;

export async function getWallet(ctx: Ctx, customerId: string): Promise<Wallet> {
  const w = await ctx.store.get<Wallet>("credit_wallets", walletId(customerId));
  if (w) return w;
  const fresh: Wallet = { id: walletId(customerId), ...stamp(ctx.org.id), customerId, balance: 0, lastTopUp: 0, lowBalancePct: ctx.org.lowBalancePct, policy: ctx.org.overagePolicy };
  await ctx.store.create("credit_wallets", fresh as unknown as Record<string, unknown>, fresh.id).catch(() => undefined);
  return fresh;
}

/** Record a usage event, consuming credits per the wallet policy. Idempotent by idempotencyKey. */
export async function recordUsage(ctx: Ctx, input: { subscriptionId: string; metric: string; quantity: number; idempotencyKey?: string }) {
  const sub = await ctx.store.get<Subscription>("subscriptions", input.subscriptionId);
  if (!sub || sub.orgId !== ctx.org.id) throw notFound("Subscription");
  if (ctx.actor.role === "customer" && sub.customerId !== ctx.actor.customerId) throw notFound("Subscription");
  if (sub.status !== "active") throw new DomainError("Usage can only be recorded on active subscriptions");
  await getWallet(ctx, sub.customerId);
  const eventId = input.idempotencyKey ? `use_${input.idempotencyKey.replace(/[^a-zA-Z0-9_-]/g, "")}` : newId("use_");
  const res = await ctx.store.tx(async (tx) => {
    const dup = await tx.get("usage_events", eventId);
    if (dup) return { duplicate: true as const };
    const w = (await tx.get<Wallet>("credit_wallets", walletId(sub.customerId)))!;
    const agg = await tx.get<{ overageUnits: number; units: number }>("usage_aggregations", `${sub.id}_open`);
    const r = consumeCredits(w, input.quantity);
    if (!r.allowed) {
      return { duplicate: false as const, blocked: true as const, reason: r.reason!, balance: w.balance };
    }
    tx.create("usage_events", eventId, { ...stamp(ctx.org.id), subscriptionId: sub.id, subscriptionNumber: sub.number, customerId: sub.customerId, metric: input.metric, quantity: input.quantity, date: ctx.today, overageUnits: r.overageUnits });
    tx.update("credit_wallets", w.id, { balance: r.balanceAfter, updatedAt: nowISO() });
    tx.create("credit_transactions", newId("ctx_"), { ...stamp(ctx.org.id), walletId: w.id, customerId: sub.customerId, type: r.overageUnits ? "overage" : "consume", amount: -input.quantity, balanceAfter: r.balanceAfter, reference: `${input.metric} on ${sub.number}` });
    tx.set("usage_aggregations", `${sub.id}_open`, { orgId: ctx.org.id, subscriptionId: sub.id, customerId: sub.customerId, units: (agg?.units ?? 0) + input.quantity, overageUnits: (agg?.overageUnits ?? 0) + r.overageUnits, updatedAt: nowISO() });
    return { duplicate: false as const, blocked: false as const, result: r };
  });
  if (res.duplicate) return { duplicate: true };
  if (res.blocked) {
    await notify(ctx, { audience: "customer", customerId: sub.customerId, title: "Usage blocked – out of credits", body: `${input.quantity} ${input.metric} could not be recorded. Top up credits to continue.`, level: "danger", link: "/portal/usage" });
    throw new HttpError(402, `${res.reason}. Balance: ${res.balance} credits.`);
  }
  if (res.result.crossedLowBalance) {
    await notify(ctx, { audience: "customer", customerId: sub.customerId, title: "Credits running low", body: `Only ${res.result.balanceAfter} credits left (below ${ctx.org.lowBalancePct}% of your last top-up).`, level: "warning", link: "/portal/usage" });
    await emit(ctx, "credits.low", { customerId: sub.customerId, entity: "credit_wallets", entityId: walletId(sub.customerId), label: sub.customerName });
  }
  return { duplicate: false, ...res.result };
}

export async function topUpWallet(ctx: Ctx, customerId: string, credits: number, note: string) {
  await getWallet(ctx, customerId);
  const r = await ctx.store.tx(async (tx) => {
    const w = (await tx.get<Wallet>("credit_wallets", walletId(customerId)))!;
    const next = topUp(w, credits);
    tx.update("credit_wallets", w.id, { balance: next.balance, lastTopUp: next.lastTopUp, updatedAt: nowISO() });
    tx.create("credit_transactions", newId("ctx_"), { ...stamp(ctx.org.id), walletId: w.id, customerId, type: "topup", amount: credits, balanceAfter: next.balance, reference: note });
    return next;
  });
  await audit(ctx, "credits.topup", "credit_wallets", walletId(customerId), { note: `+${credits} credits: ${note}` });
  return r;
}
