import { z } from "zod";
import { route, body, forbidden, notFound } from "@/server/http";
import { ctxFor } from "@/server/ctx";
import type { Customer, Profile } from "@/lib/types";
import { audit, nowISO, searchTokens } from "@/server/services/core";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().max(20).optional(),
  company: z.string().trim().max(120).optional(),
  gstin: z.string().trim().toUpperCase().regex(/^$|^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, "Invalid GSTIN").optional(),
  billingAddress: z.string().trim().max(300).optional(),
  city: z.string().trim().max(80).optional(),
  placeOfSupply: z.string().regex(/^\d{2}$/, "Pick a state").nullable().optional(),
});

export const GET = route({ roles: ["customer"] }, async (_req, session) => {
  if (!session.customerId) throw forbidden();
  const ctx = await ctxFor(session);
  const customer = await ctx.store.get<Customer>("customers", session.customerId);
  if (!customer || customer.orgId !== session.orgId || customer.userId !== session.uid) throw notFound("Customer");
  return {
    name: customer.name,
    email: customer.email,
    phone: customer.phone ?? "",
    company: customer.company ?? "",
    gstin: customer.gstin ?? "",
    billingAddress: customer.billingAddress ?? "",
    city: customer.city ?? "",
    placeOfSupply: customer.placeOfSupply ?? null,
    creditBalance: customer.creditBalance ?? 0,
  };
});

export const PATCH = route({ roles: ["customer"] }, async (req, session) => {
  if (!session.customerId) throw forbidden();
  const patch = patchSchema.parse(await body(req));
  const ctx = await ctxFor(session);
  const customer = await ctx.store.get<Customer>("customers", session.customerId);
  if (!customer || customer.orgId !== session.orgId || customer.userId !== session.uid) throw notFound("Customer");
  const changed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined && JSON.stringify(value) !== JSON.stringify(customer[key as keyof Customer])) changed[key] = value;
  }
  if (patch.name !== undefined && patch.name !== customer.name) {
    await ctx.store.update("profiles", session.uid, { name: patch.name, updatedAt: nowISO(), _search: searchTokens(patch.name, session.email) });
  }
  if (Object.keys(changed).length) {
    const next = { ...customer, ...changed };
    await ctx.store.update("customers", customer.id, { ...changed, updatedAt: nowISO(), _search: searchTokens(next.name, next.email, next.company, next.city) });
    await audit(ctx, "customer.profile_updated", "customers", customer.id, { after: { fields: Object.keys(changed) } });
  }
  return { ...customer, ...changed };
});
