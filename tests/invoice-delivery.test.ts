import { beforeAll, afterEach, describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { FileStore } from "@/server/store/file";
import { seedDemo } from "@/server/seed";
import { makeCtx } from "@/server/services/core";
import { sendInvoice } from "@/server/services/invoices";
import type { Invoice, Notification } from "@/lib/types";

let store: FileStore;

beforeAll(async () => {
  store = new FileStore(mkdtempSync(join(tmpdir(), "bl-invoice-delivery-")));
  await seedDemo(store, { auth: "local", bulk: 0 });
});

afterEach(() => {
  delete process.env.RESEND_API_KEY;
});

describe("invoice delivery status", () => {
  it("records an unavailable email as an in-app notification, not as an emailed invoice", async () => {
    const ctx = await makeCtx(store, "org_brightloop", { uid: "admin", name: "Admin", role: "admin" });
    const invoice = (await store.all<Invoice>("invoices")).find((item) => item.status === "confirmed")!;

    const result = await sendInvoice(ctx, invoice.id);
    const saved = await store.get<Invoice>("invoices", invoice.id);
    const notification = (await store.all<Notification>("notifications", [["customerId", "==", invoice.customerId]])).at(-1);

    expect(result.channel).toBe("email_logged");
    expect(result.detail).toMatch(/unavailable/i);
    expect(saved?.sentAt).not.toBeTruthy();
    expect(notification).toMatchObject({ channel: "email_logged", level: "warning" });
  });
});
