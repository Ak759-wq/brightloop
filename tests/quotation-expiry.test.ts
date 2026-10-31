import { beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { addDays } from "@/lib/finance";
import { FileStore } from "@/server/store/file";
import { seedDemo } from "@/server/seed";
import { makeCtx } from "@/server/services/core";
import { createSubscription, transition } from "@/server/services/subscriptions";

let store: FileStore;

beforeAll(async () => {
  store = new FileStore(mkdtempSync(join(tmpdir(), "bl-quotation-")));
  await seedDemo(store, { auth: "local", bulk: 0 });
});

describe("quotation expiry", () => {
  it("allows a quotation through its valid-until date", async () => {
    const ctx = await makeCtx(store, "org_brightloop", { uid: "staff", name: "Staff", role: "staff" });
    const quotation = await createSubscription(ctx, {
      customerId: "cust_001",
      planId: "plan_crm_m",
      items: [{ productId: "prod_crm", variantIds: [], addonIds: [], quantity: 1 }],
      discountIds: [],
      status: "quotation",
      startDate: ctx.today,
      quoteValidUntil: ctx.today,
    });

    const confirmed = await transition(ctx, quotation.id, "confirm");
    expect(confirmed?.status).toBe("confirmed");
  });

  it("rejects expired quotations server-side even when the client supplies a future date", async () => {
    const ctx = await makeCtx(store, "org_brightloop", { uid: "staff", name: "Staff", role: "staff" });
    const quotation = await createSubscription(ctx, {
      customerId: "cust_001",
      planId: "plan_crm_m",
      items: [{ productId: "prod_crm", variantIds: [], addonIds: [], quantity: 1 }],
      discountIds: [],
      status: "quotation",
      startDate: ctx.today,
      quoteValidUntil: addDays(ctx.today, -1),
    });

    await expect(transition(ctx, quotation.id, "confirm", { startDate: addDays(ctx.today, 365) }))
      .rejects.toThrow("quotation has expired");
    expect((await store.get<{ status: string }>("subscriptions", quotation.id))?.status).toBe("quotation");
  });
});
