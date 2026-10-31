import { beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { authDiagnostic, verifyLocalToken } from "@/server/auth";
import { FileStore } from "@/server/store/file";
import { seedDemo } from "@/server/seed";
import { makeCtx } from "@/server/services/core";
import { recordPayment } from "@/server/services/payments";
import type { Invoice } from "@/lib/types";

describe("production authentication hardening", () => {
  it("rejects malformed local tokens without throwing", () => {
    expect(verifyLocalToken("not-a-token")).toBeNull();
    expect(verifyLocalToken("eyJ1aWQiOiJ1c2VyIn0.invalid")).toBeNull();
  });

  it("requires Firebase Auth instead of silently enabling local auth in production", () => {
    const env = process.env as Record<string, string | undefined>;
    const previousNodeEnv = process.env.NODE_ENV;
    const previousApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    env.NODE_ENV = "production";
    delete env.NEXT_PUBLIC_FIREBASE_API_KEY;
    expect(authDiagnostic()).toMatch(/Firebase Auth is not configured/);
    if (previousNodeEnv === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = previousNodeEnv;
    if (previousApiKey === undefined) delete env.NEXT_PUBLIC_FIREBASE_API_KEY;
    else env.NEXT_PUBLIC_FIREBASE_API_KEY = previousApiKey;
  });
});

describe("payment idempotency hardening", () => {
  let store: FileStore;

  beforeAll(async () => {
    store = new FileStore(mkdtempSync(join(tmpdir(), "bl-payment-hardening-")));
    await seedDemo(store, { auth: "local", bulk: 0 });
  });

  it("does not create two payments for the same provider reference", async () => {
    const invoice = (await store.all<Invoice>("invoices")).find((item) => item.status === "confirmed")!;
    const ctx = await makeCtx(store, "org_brightloop", { uid: "razorpay", name: "Razorpay", role: "system" });
    const first = await recordPayment(ctx, { invoiceId: invoice.id, method: "razorpay", amount: 1, date: ctx.today, reference: "pay_duplicate_test" });
    const second = await recordPayment(ctx, { invoiceId: invoice.id, method: "razorpay", amount: 1, date: ctx.today, reference: "pay_duplicate_test" });
    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(await store.count("payments", [["reference", "==", "pay_duplicate_test"]])).toBe(1);
  });
});
