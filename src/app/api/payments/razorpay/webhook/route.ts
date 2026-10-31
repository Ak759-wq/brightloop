import { NextResponse } from "next/server";
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
    const evt = JSON.parse(raw) as { event: string; payload?: { payment?: { entity?: { id: string; amount: number; notes?: { invoiceId?: string } } } } };
    const p = evt.payload?.payment?.entity;
    if (evt.event !== "payment.captured" || !p?.notes?.invoiceId) return NextResponse.json({ ignored: true });
    const store = await getStore();
    const ctx = await makeCtx(store, DEFAULT_ORG_ID, { uid: "razorpay", name: "Razorpay webhook", role: "system" });
    const dup = await store.all("payments", [["reference", "==", p.id]]);
    if (dup.length) return NextResponse.json({ duplicate: true });
    await recordPayment(ctx, { invoiceId: p.notes.invoiceId, method: "razorpay", amount: p.amount, date: ctx.today, reference: p.id, note: "Razorpay webhook" });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return toResponse(e);
  }
}
