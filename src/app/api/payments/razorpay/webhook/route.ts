import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { razorpay } from "@/server/payments/razorpay";
import { getStore } from "@/server/store";
import { makeCtx } from "@/server/services/core";
import { recordPayment } from "@/server/services/payments";
import { DEFAULT_ORG_ID } from "@/server/auth";
import { toResponse } from "@/server/http";

/** Razorpay webhook: verifies X-Razorpay-Signature, then records payment.captured idempotently. */
export async function POST(req: Request) {
  try {
    const raw = await req.text();
    if (!razorpay.verifyWebhook(raw, req.headers.get("x-razorpay-signature"))) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    const evt = JSON.parse(raw) as { event: string; payload?: { payment?: { entity?: { id: string; amount: number; currency?: string; notes?: { invoiceId?: string } } } } };
    const p = evt.payload?.payment?.entity;
    if (evt.event !== "payment.captured" || !p?.id || !p.amount || !p.notes?.invoiceId) return NextResponse.json({ ignored: true });
    const store = await getStore();
    const invoice = await store.get<{ orgId: string; currency: string }>("invoices", p.notes.invoiceId);
    if (!invoice || invoice.orgId !== DEFAULT_ORG_ID) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    if (p.currency && p.currency !== invoice.currency) return NextResponse.json({ error: "Payment currency does not match invoice" }, { status: 422 });
    const ctx = await makeCtx(store, DEFAULT_ORG_ID, { uid: "razorpay", name: "Razorpay webhook", role: "system" });
    const result = await recordPayment(ctx, { invoiceId: p.notes.invoiceId, method: "razorpay", amount: p.amount, date: ctx.today, reference: p.id, note: "Razorpay webhook" });
    return NextResponse.json({ ok: true, duplicate: result.duplicate });
  } catch (e) {
    return toResponse(e);
  }
}
