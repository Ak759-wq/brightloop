import { NextResponse } from "next/server";
import { authMode, getSession } from "@/server/auth";
import { backendMode, getStore } from "@/server/store";
import { businessToday } from "@/server/services/core";
import type { Organization } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getSession(req);
  const store = await getStore();
  const org = session ? await store.get<Organization>("organizations", session.orgId) : null;
  return NextResponse.json({
    session,
    org: org ? { id: org.id, name: org.name, currency: org.currency, demo: org.demo, demoDate: org.demoDate ?? null, sellerState: org.sellerState, retentionDiscountId: org.retentionDiscountId ?? null, today: businessToday(org) } : null,
    modes: { auth: authMode(), backend: backendMode(), email: !!process.env.RESEND_API_KEY, razorpay: !!process.env.RAZORPAY_KEY_ID, llm: !!(process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY) },
  });
}
