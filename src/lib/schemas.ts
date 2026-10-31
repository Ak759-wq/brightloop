import { z } from "zod";

/** Password: MORE than 8 characters, with upper, lower and a special character (spec requirement). */
export const passwordSchema = z
  .string()
  .min(9, "Password must be more than 8 characters")
  .regex(/[A-Z]/, "Add an uppercase letter")
  .regex(/[a-z]/, "Add a lowercase letter")
  .regex(/[^A-Za-z0-9]/, "Add a special character");

export function passwordIssues(pw: string): string[] {
  const r = passwordSchema.safeParse(pw);
  return r.success ? [] : r.error.issues.map((i) => i.message);
}

export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const optDate = isoDate.nullable().optional().or(z.literal("").transform(() => null));
const minor = z.number().int("Amounts are in paise (whole numbers)").min(0);
const stateCode = z.string().regex(/^\d{2}$/, "Pick a state");

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80),
  email: emailSchema,
  password: passwordSchema,
  company: z.string().trim().max(120).optional(),
  placeOfSupply: stateCode.optional(),
});

export const schemas = {
  customers: z.object({
    name: z.string().trim().min(2).max(120),
    email: emailSchema,
    phone: z.string().trim().max(20).optional().default(""),
    company: z.string().trim().max(120).optional().default(""),
    gstin: z.string().trim().toUpperCase().regex(/^$|^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, "Invalid GSTIN").optional().default(""),
    billingAddress: z.string().trim().max(300).optional().default(""),
    city: z.string().trim().max(80).optional().default(""),
    placeOfSupply: stateCode.nullable().optional(),
    country: z.string().length(2).default("IN"),
    tags: z.array(z.string()).optional().default([]),
    status: z.enum(["active", "archived"]).default("active"),
  }),
  customer_contacts: z.object({
    customerId: z.string().min(1),
    name: z.string().trim().min(2),
    email: emailSchema,
    phone: z.string().optional().default(""),
    role: z.string().optional().default(""),
  }),
  products: z.object({
    name: z.string().trim().min(2).max(120),
    type: z.enum(["service", "software", "goods"]),
    salesPrice: minor,
    costPrice: minor.optional().default(0),
    notes: z.string().max(1000).optional().default(""),
    taxRuleId: z.string().nullable().optional(),
    active: z.boolean().default(true),
    usageMetric: z.string().nullable().optional(),
  }),
  product_variants: z.object({
    productId: z.string().min(1),
    attribute: z.string().trim().min(1).max(40),
    value: z.string().trim().min(1).max(60),
    priceDelta: z.number().int(),
    active: z.boolean().default(true),
  }),
  product_addons: z.object({
    productId: z.string().nullable().optional(),
    name: z.string().trim().min(2).max(80),
    price: minor,
    description: z.string().max(300).optional().default(""),
    active: z.boolean().default(true),
  }),
  plans: z
    .object({
      name: z.string().trim().min(2).max(80),
      productId: z.string().min(1, "Choose a product"),
      description: z.string().max(500).optional().default(""),
      features: z.array(z.string()).optional().default([]),
      pricingModel: z.enum(["flat", "per_seat", "tiered", "volume"]),
      price: minor,
      tiers: z.array(z.object({ upTo: z.number().int().positive().nullable(), unitAmount: minor, flatAmount: minor.optional() })).optional().default([]),
      interval: z.enum(["daily", "weekly", "monthly", "yearly"]),
      intervalCount: z.number().int().min(1).max(36).default(1),
      minQuantity: z.number().int().min(1).default(1),
      availableFrom: optDate,
      availableUntil: optDate,
      termPeriods: z.number().int().min(1).nullable().optional(),
      autoClose: z.boolean().default(false),
      closable: z.boolean().default(true),
      pausable: z.boolean().default(true),
      renewable: z.boolean().default(true),
      active: z.boolean().default(true),
      public: z.boolean().default(true),
      includedCredits: z.number().int().min(0).optional().default(0),
    })
    .refine((p) => !(p.availableFrom && p.availableUntil && p.availableFrom > p.availableUntil), { message: "Available-from must be before available-until", path: ["availableUntil"] })
    .refine((p) => (p.pricingModel === "tiered" || p.pricingModel === "volume" ? (p.tiers?.length ?? 0) > 0 && p.tiers![p.tiers!.length - 1].upTo === null : true), { message: "Tiered/volume plans need tiers ending with an unbounded tier", path: ["tiers"] }),
  quotation_templates: z.object({
    name: z.string().trim().min(2).max(80),
    planId: z.string().min(1),
    validityDays: z.number().int().min(1).max(365),
    items: z.array(z.object({ productId: z.string(), variantIds: z.array(z.string()).default([]), addonIds: z.array(z.string()).default([]), quantity: z.number().int().min(1) })).min(1),
    notes: z.string().max(1000).optional().default(""),
    paymentTermsDays: z.number().int().min(0).max(120).optional(),
  }),
  tax_rules: z.object({
    name: z.string().trim().min(2).max(60),
    rateBp: z.number().int().min(0).max(10000),
    kind: z.enum(["GST", "NONE"]).default("GST"),
    hsnSac: z.string().max(10).optional().default(""),
    isDefault: z.boolean().default(false),
  }),
  discounts: z
    .object({
      name: z.string().trim().min(2).max(80),
      code: z.string().trim().toUpperCase().max(30).optional().default(""),
      type: z.enum(["fixed", "percent"]),
      value: z.number().int().positive(),
      scope: z.enum(["subscription", "product"]),
      productIds: z.array(z.string()).optional().default([]),
      minQuantity: z.number().int().min(1).nullable().optional(),
      minAmount: minor.nullable().optional(),
      startDate: optDate,
      endDate: optDate,
      usageLimit: z.number().int().min(1).nullable().optional(),
      active: z.boolean().default(true),
    })
    .refine((d) => d.type !== "percent" || d.value <= 10000, { message: "Percentage cannot exceed 100%", path: ["value"] })
    .refine((d) => d.scope !== "product" || d.productIds.length > 0, { message: "Pick at least one product", path: ["productIds"] })
    .refine((d) => !(d.startDate && d.endDate && d.startDate > d.endDate), { message: "Start must be before end", path: ["endDate"] }),
  automation_rules: z.object({
    name: z.string().trim().min(2).max(80),
    trigger: z.enum(["invoice.overdue", "invoice.created", "payment.failed", "payment.succeeded", "subscription.activated", "subscription.closed", "credits.low", "renewal.upcoming", "dunning.exhausted"]),
    minAmount: minor.nullable().optional(),
    action: z.enum(["notify_customer", "notify_staff", "email_customer", "tag_customer"]),
    message: z.string().trim().min(3).max(500),
    tag: z.string().max(30).optional().default(""),
    enabled: z.boolean().default(true),
  }),
} as const;

export type SchemaName = keyof typeof schemas;

export const lineInputSchema = z.object({
  productId: z.string().min(1),
  variantIds: z.array(z.string()).default([]),
  addonIds: z.array(z.string()).default([]),
  quantity: z.number().int().min(1),
});

export const subscriptionCreateSchema = z.object({
  customerId: z.string().min(1, "Choose a customer"),
  planId: z.string().min(1, "Choose a plan"),
  items: z.array(lineInputSchema).min(1, "Add at least one line"),
  discountIds: z.array(z.string()).default([]),
  startDate: isoDate.optional().nullable(),
  endDate: isoDate.optional().nullable(),
  paymentTermsDays: z.number().int().min(0).max(120).optional(),
  notes: z.string().max(1000).optional().default(""),
  status: z.enum(["draft", "quotation"]).default("draft"),
  quoteValidUntil: isoDate.optional().nullable(),
  templateId: z.string().optional().nullable(),
});

export const paymentSchema = z.object({
  invoiceId: z.string().min(1),
  method: z.enum(["upi", "card", "bank_transfer", "cash", "cheque"]),
  amount: z.number().int().positive("Amount must be greater than zero"),
  date: isoDate,
  note: z.string().max(300).optional().default(""),
  reference: z.string().max(80).optional().default(""),
});
