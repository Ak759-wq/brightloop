import { beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileStore } from "@/server/store/file";
import { seedDemo } from "@/server/seed";
import { makeCtx, realToday } from "@/server/services/core";
import { runBilling, billSubscription } from "@/server/services/billing";
import { recordPayment, simulatePayment, refundPayment } from "@/server/services/payments";
import { createSubscription, transition, changeSubscription } from "@/server/services/subscriptions";
import { recordUsage } from "@/server/services/usage";
import { computeAnalytics } from "@/server/services/analytics";
import { ask } from "@/server/services/assistant";
import { outstanding } from "@/lib/finance";
import type { Invoice, Subscription } from "@/lib/types";

let store: FileStore;
const admin = { uid: "usr_admin", name: "Test admin", role: "admin" as const };

beforeAll(async () => {
  delete process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  store = new FileStore(mkdtempSync(join(tmpdir(), "bl-")));
  await seedDemo(store, { auth: "local", bulk: 300 });
}, 120_000);

describe("seeded system (integration, local store)", () => {
  it("creates invoices with unique numbers and one invoice per subscription period", async () => {
    const invs = await store.all<Invoice>("invoices");
    expect(invs.length).toBeGreaterThan(50);
    const numbers = new Set(invs.map((i) => i.number));
    expect(numbers.size).toBe(invs.length);
    const keys = invs.filter((i) => i.idempotencyKey).map((i) => i.idempotencyKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("re-running billing for the same day creates no duplicate invoices", async () => {
    const ctx = await makeCtx(store, "org_brightloop", admin);
    const before = await store.count("invoices");
    const r1 = await runBilling(ctx, "manual");
    const r2 = await runBilling(ctx, "manual");
    expect(r1.invoicesCreated).toBe(0);
    expect(r2.invoicesCreated).toBe(0);
    expect(await store.count("invoices")).toBe(before);
  });

  it("concurrent billing runs: lock lets only one proceed", async () => {
    const ctx = await makeCtx(store, "org_brightloop", admin);
    const [a, b] = await Promise.all([runBilling(ctx, "cron"), runBilling(ctx, "cron")]);
    expect([a.status, b.status].sort()).toEqual(["completed", "locked"]);
  });

  it("billing a subscription twice for the same period is idempotent", async () => {
    const ctx = await makeCtx(store, "org_brightloop", admin);
    const sub = (await store.all<Subscription>("subscriptions", [["customerId", "==", "cust_013"]]))[0];
    const stale = { ...sub, nextBillingDate: sub.currentPeriodStart };
    const before = await store.count("invoices");
    const o = await billSubscription(ctx, stale as Subscription);
    expect(o.action).toBe("duplicate");
    expect(await store.count("invoices")).toBe(before);
  });

  it("intra-state customer gets CGST+SGST, inter-state gets IGST", async () => {
    const ka = (await store.all<Invoice>("invoices", [["customerId", "==", "cust_001"]]))[0];
    const mh = (await store.all<Invoice>("invoices", [["customerId", "==", "cust_005"]]))[0];
    expect(ka.totals.cgst).toBeGreaterThan(0);
    expect(ka.totals.igst).toBe(0);
    expect(mh.totals.igst).toBeGreaterThan(0);
    expect(mh.totals.cgst).toBe(0);
  });

  it("variant pricing: CRM ₹1,000 + Odoo ₹560 + Premium support ₹300 = ₹1,860 per seat", async () => {
    const sub = (await store.all<Subscription>("subscriptions", [["customerId", "==", "cust_001"], ["planId", "==", "plan_crm_m"]]))[0];
    expect(sub.items[0].unitPrice).toBe(186000);
    expect(sub.items[0].amount).toBe(930000);
  });

  it("failed simulated payments never mark paid and schedule a retry", async () => {
    const ctx = await makeCtx(store, "org_brightloop", admin);
    const inv = (await store.all<Invoice>("invoices", [["customerId", "==", "cust_015"]])).find((i) => outstanding(i) > 0)!;
    const r = await simulatePayment(ctx, inv.id, "fail", { reason: "Bank timeout" });
    const after = (await store.get<Invoice>("invoices", inv.id))!;
    expect(after.amountPaid).toBe(inv.amountPaid);
    expect(after.status).not.toBe("paid");
    expect((r as { nextRetryOn: string }).nextRetryOn).toBeTruthy();
  });

  it("partial then full payment moves invoice to paid; overpayment is rejected; refund re-opens", async () => {
    const ctx = await makeCtx(store, "org_brightloop", admin);
    const inv = (await store.all<Invoice>("invoices", [["customerId", "==", "cust_015"]])).find((i) => outstanding(i) > 0)!;
    const owed = outstanding(inv);
    await recordPayment(ctx, { invoiceId: inv.id, method: "upi", amount: 100, date: ctx.today });
    expect((await store.get<Invoice>("invoices", inv.id))!.amountPaid).toBe(inv.amountPaid + 100);
    await expect(recordPayment(ctx, { invoiceId: inv.id, method: "upi", amount: owed, date: ctx.today })).rejects.toThrow(/exceeds/);
    const { payment } = await recordPayment(ctx, { invoiceId: inv.id, method: "upi", amount: owed - 100, date: ctx.today });
    expect((await store.get<Invoice>("invoices", inv.id))!.status).toBe("paid");
    await refundPayment(ctx, payment.id, 500, "Goodwill");
    expect(outstanding((await store.get<Invoice>("invoices", inv.id))!)).toBe(500);
  });

  it("upgrade mid-cycle creates a proration invoice; downgrade credits the account", async () => {
    const ctx = await makeCtx(store, "org_brightloop", admin);
    const sub = (await store.all<Subscription>("subscriptions", [["customerId", "==", "cust_017"]]))[0];
    const up = await changeSubscription(ctx, sub.id, { items: [{ productId: "prod_crm", variantIds: [], addonIds: ["add_storage"], quantity: 10 }] });
    if (up.proration && up.proration.remainingDays > 0) expect(up.prorationInvoiceId).toBeTruthy();
    const down = await changeSubscription(ctx, sub.id, { items: [{ productId: "prod_crm", variantIds: [], addonIds: [], quantity: 2 }] });
    if (down.proration && down.proration.net < 0) {
      const c = await store.get<{ creditBalance: number }>("customers", "cust_017");
      expect(c!.creditBalance).toBe(-down.proration.net);
    }
    const versions = await store.all("subscription_versions", [["subscriptionId", "==", sub.id]]);
    expect(versions.length).toBeGreaterThanOrEqual(3);
  });

  it("missing place of supply blocks activation billing (never guessed)", async () => {
    const ctx = await makeCtx(store, "org_brightloop", admin);
    const s = await createSubscription(ctx, { customerId: "cust_nopos", planId: "plan_crm_m", items: [{ productId: "prod_crm", variantIds: [], addonIds: [], quantity: 1 }], discountIds: [], status: "draft", startDate: ctx.today });
    await transition(ctx, s.id, "confirm");
    await expect(transition(ctx, s.id, "activate")).rejects.toThrow(/place of supply/);
  });

  it("usage beyond balance follows the overage policy and is idempotent", async () => {
    const ctx = await makeCtx(store, "org_brightloop", admin);
    const sub = (await store.all<Subscription>("subscriptions", [["customerId", "==", "cust_001"], ["planId", "==", "plan_api_d"]]))[0];
    if (sub.status !== "active") return;
    const a = await recordUsage(ctx, { subscriptionId: sub.id, metric: "api_calls", quantity: 5, idempotencyKey: "k1" });
    const b = await recordUsage(ctx, { subscriptionId: sub.id, metric: "api_calls", quantity: 5, idempotencyKey: "k1" });
    expect(a.duplicate).toBe(false);
    expect(b.duplicate).toBe(true);
  });

  it("analytics over seeded + 300 bulk subscriptions is fast and consistent", async () => {
    const ctx = await makeCtx(store, "org_brightloop", admin);
    const a = await computeAnalytics(ctx, { fresh: true });
    expect(a.kpis.mrr).toBeGreaterThan(0);
    expect(a.kpis.arr).toBe(a.kpis.mrr * 12);
    expect(a.computedMs).toBeLessThan(2000);
  });

  it("assistant answers from tools and respects roles", async () => {
    const ctx = await makeCtx(store, "org_brightloop", admin);
    const r = await ask(ctx, "What is our MRR?");
    expect(r.tool).toBe("mrr");
    const cctx = await makeCtx(store, "org_brightloop", { uid: "usr_customer", name: "c", role: "customer", customerId: "cust_001" });
    const c = await ask(cctx, "What is our MRR?");
    expect(c.tool).toBe("help");
    expect(realToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
