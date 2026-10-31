import type { Session } from "./auth";
import { getStore } from "./store";
import { makeCtx } from "./services/core";

export async function ctxFor(session: Session) {
  const store = await getStore();
  return makeCtx(store, session.orgId, { uid: session.uid, name: session.name, role: session.role, customerId: session.customerId });
}
