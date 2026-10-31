import { z } from "zod";
import { route, body } from "@/server/http";
import { ctxFor } from "@/server/ctx";
import { audit, nowISO } from "@/server/services/core";
import { invalidateAnalytics } from "@/server/services/analytics";

const schema = z.object({
  name: z.string().min(2).max(80),
  legalName: z.string().min(2).max(120),
  sellerState: z.string().regex(/^\d{2}$/),
  sellerGstin: z.string().max(15).optional(),
  address: z.string().max(300).optional(),
  paymentTermsDays: z.number().int().min(0).max(120),
  dunningRetryDays: z.array(z.number().int().min(1).max(60)).min(1).max(6),
  autoConfirmInvoices: z.boolean(),
  lowBalancePct: z.number().int().min(1).max(90),
  overagePolicy: z.enum(["block", "overage"]),
  overageUnitPrice: z.number().int().min(0),
  retentionDiscountId: z.string().nullable().optional(),
  demoDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
}).partial();

export const GET = route({ roles: ["admin", "staff"] }, async (_req, session) => (await ctxFor(session)).org);

export const PATCH = route({ action: "settings.update" }, async (req, session) => {
  const ctx = await ctxFor(session);
  const patch = schema.parse(await body(req));
  if (patch.demoDate !== undefined && !ctx.org.demo) delete patch.demoDate; // demo clock only for demo orgs
  await ctx.store.update("organizations", ctx.org.id, { ...patch, updatedAt: nowISO() });
  await audit(ctx, "settings.updated", "organizations", ctx.org.id, { after: patch });
  invalidateAnalytics();
  return { ...ctx.org, ...patch };
});
