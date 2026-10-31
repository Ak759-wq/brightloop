import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyRazorpaySignature } from "@/server/payments/razorpay";

const secret = "whsec_test";
const body = JSON.stringify({ event: "payment.captured", payload: { amount: 1416000 } });
const good = createHmac("sha256", secret).update(body).digest("hex");

describe("Razorpay webhook signature (S-W)", () => {
  it("accepts a correctly signed body", () => expect(verifyRazorpaySignature(body, good, secret)).toBe(true));
  it("rejects a tampered body", () => expect(verifyRazorpaySignature(body.replace("1416000", "1"), good, secret)).toBe(false));
  it("rejects a missing signature", () => expect(verifyRazorpaySignature(body, null, secret)).toBe(false));
  it("rejects when no secret is configured", () => expect(verifyRazorpaySignature(body, good, "")).toBe(false));
  it("rejects a wrong-length signature without throwing", () => expect(verifyRazorpaySignature(body, "abc", secret)).toBe(false));
});
