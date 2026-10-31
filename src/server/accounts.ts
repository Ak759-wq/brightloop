import type { Profile } from "@/lib/types";
import type { Store } from "./store/types";
import { newId } from "./store/types";
import { searchTokens, stamp } from "./services/core";

export async function createCustomerAccount(store: Store, orgId: string, uid: string, input: { name: string; email: string; company?: string; placeOfSupply?: string }) {
  const existing = await store.all<{ id: string; userId?: string | null }>("customers", [["orgId", "==", orgId], ["email", "==", input.email]]);
  let customerId: string;
  if (existing.length && !existing[0].userId) {
    customerId = existing[0].id;
    await store.update("customers", customerId, { userId: uid });
  } else {
    customerId = newId("cust_");
    const company = input.company?.trim() || input.name;
    await store.create("customers", { ...stamp(orgId), name: company, email: input.email, phone: "", company, gstin: "", billingAddress: "", city: "", placeOfSupply: input.placeOfSupply ?? null, country: "IN", userId: uid, creditBalance: 0, tags: ["self-signup"], status: "active", contactName: input.name, _search: searchTokens(company, input.name, input.email) }, customerId);
  }
  const profile: Omit<Profile, "id"> = { ...stamp(orgId), uid, email: input.email, name: input.name, role: "customer", customerId, disabled: false, _search: searchTokens(input.name, input.email) };
  await store.create("profiles", profile as unknown as Record<string, unknown>, uid);
  await store.create("audit_logs", { ...stamp(orgId), actorId: uid, actorName: input.name, actorRole: "customer", action: "account.registered", entity: "profiles", entityId: uid, note: input.email }, newId("log_"));
  return customerId;
}
