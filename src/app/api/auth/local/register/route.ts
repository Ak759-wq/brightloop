import { NextResponse } from "next/server";
import { registerSchema } from "@/lib/schemas";
import { authMode, DEFAULT_ORG_ID, hashPassword, signLocalToken } from "@/server/auth";
import { toResponse, HttpError } from "@/server/http";
import { getStore } from "@/server/store";
import { createCustomerAccount } from "@/server/accounts";

export async function POST(req: Request) {
  try {
    if (authMode() !== "local") throw new HttpError(400, "Local auth is disabled; Firebase Auth is configured");
    const input = registerSchema.parse(await req.json());
    const store = await getStore();
    if (await store.get("local_auth", input.email)) throw new HttpError(409, "An account with this email already exists");
    const uid = `usr_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
    await store.create("local_auth", { email: input.email, uid, passwordHash: hashPassword(input.password), createdAt: new Date().toISOString() }, input.email);
    await createCustomerAccount(store, DEFAULT_ORG_ID, uid, input);
    return NextResponse.json({ token: signLocalToken(uid) });
  } catch (e) {
    return toResponse(e);
  }
}
