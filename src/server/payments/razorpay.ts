import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Razorpay adapter (STUB until RAZORPAY_* keys are configured).
 * createOrder calls the real Orders API when keys exist; webhook signature verification is real.
 */
export interface PaymentGateway {
  name: string;
  configured(): boolean;
  createOrder(input: { amount: number; currency: string; receipt: string; notes?: Record<string, string> }): Promise<{ id: string; amount: number; currency: string }>;
  verifyWebhook(rawBody: string, signature: string | null): boolean;
}

export function verifyRazorpaySignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature || !secret) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected), b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const razorpay: PaymentGateway = {
  name: "razorpay",
  configured: () => !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
  async createOrder(input) {
    if (!this.configured()) throw new Error("Razorpay is not configured – use the Payment Simulator");
    const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
    const res = await fetch("https://api.razorpay.com/v1/orders", { method: "POST", headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" }, body: JSON.stringify(input) });
    if (!res.ok) throw new Error(`Razorpay order failed (${res.status})`);
    return (await res.json()) as { id: string; amount: number; currency: string };
  },
  verifyWebhook(rawBody, signature) {
    return verifyRazorpaySignature(rawBody, signature, process.env.RAZORPAY_WEBHOOK_SECRET ?? "");
  },
};
