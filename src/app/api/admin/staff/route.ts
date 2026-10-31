import { z } from "zod";
import { emailSchema, passwordSchema } from "@/lib/schemas";
import { authMode, hashPassword } from "@/server/auth";
import { bad, route, body } from "@/server/http";
import { ctxFor } from "@/server/ctx";
import { getAdminApp, backendMode } from "@/server/store";
import { audit, searchTokens, stamp } from "@/server/services/core";

const schema = z.object({ name: z.string().trim().min(2).max(80), email: emailSchema, password: passwordSchema.optional() });

/**
 * ADMIN-ONLY staff creation.
 *  local auth            : creates the login immediately (password required)
 *  firebase + service acct: creates the Firebase Auth user via firebase-admin (password required)
 *  firebase, no admin creds: creates a claimable invite; the staff member registers with that email and receives the staff role
 */
export const POST = route({ action: "staff.create" }, async (req, session) => {
  const input = schema.parse(await body(req));
  const ctx = await ctxFor(session);
  const dup = await ctx.store.all("profiles", [["email", "==", input.email]]);
  if (dup.length) throw bad("A user with this email already exists");
  let uid: string;
  let mode: string;
  if (authMode() === "local") {
    if (!input.password) throw bad("Set an initial password");
    uid = `usr_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
    await ctx.store.create("local_auth", { email: input.email, uid, passwordHash: hashPassword(input.password), createdAt: new Date().toISOString() }, input.email);
    mode = "created";
  } else if (backendMode() === "firestore") {
    if (!input.password) throw bad("Set an initial password");
    const { getAuth } = await import("firebase-admin/auth");
    const user = await getAuth(await getAdminApp()).createUser({ email: input.email, password: input.password, displayName: input.name });
    uid = user.uid;
    mode = "created";
  } else {
    uid = `pending_${input.email}`;
    mode = "invited";
  }
  await ctx.store.create("profiles", { ...stamp(ctx.org.id), uid, email: input.email, name: input.name, role: "staff", customerId: null, disabled: false, claimable: mode === "invited", _search: searchTokens(input.name, input.email) }, uid);
  await audit(ctx, "staff.created", "profiles", uid, { note: `${input.email} (${mode})` });
  return { ok: true, mode, message: mode === "invited" ? "Invite created. Ask them to register with this email; they will get the staff role." : "Staff account created." };
});
