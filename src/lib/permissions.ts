import type { Role } from "./types";

/**
 * Single source of truth for role permissions (mirrored in firestore.rules and docs/PERMISSIONS.md).
 *  read  : roles that can list/read. "own" means customers can read only docs where customerId === their customerId.
 *  write : roles that can create/update/archive through the generic resource API. Financial collections
 *          are NOT writable here at all – they change only through domain actions with validation.
 */
export interface ResourcePolicy {
  read: Role[];
  own?: boolean;
  write: Role[];
  /** generic CRUD allowed (false = domain actions only) */
  crud: boolean;
  /** field hidden from non-admins */
  adminOnlyFields?: string[];
  /** field used to scope customer reads */
  ownerField?: string;
}

export const RESOURCES = {
  customers: { read: ["admin", "staff", "customer"], own: true, ownerField: "id", write: ["admin", "staff"], crud: true },
  customer_contacts: { read: ["admin", "staff"], write: ["admin", "staff"], crud: true },
  products: { read: ["admin", "staff", "customer"], write: ["admin"], crud: true, adminOnlyFields: ["costPrice"] },
  product_variants: { read: ["admin", "staff", "customer"], write: ["admin"], crud: true },
  product_addons: { read: ["admin", "staff", "customer"], write: ["admin"], crud: true },
  plans: { read: ["admin", "staff", "customer"], write: ["admin"], crud: true },
  quotation_templates: { read: ["admin", "staff"], write: ["admin"], crud: true },
  tax_rules: { read: ["admin", "staff"], write: ["admin"], crud: true },
  discounts: { read: ["admin", "staff"], write: ["admin"], crud: true },
  automation_rules: { read: ["admin"], write: ["admin"], crud: true },
  subscriptions: { read: ["admin", "staff", "customer"], own: true, write: [], crud: false },
  subscription_versions: { read: ["admin", "staff", "customer"], own: true, write: [], crud: false },
  subscription_amendments: { read: ["admin", "staff", "customer"], own: true, write: [], crud: false },
  invoices: { read: ["admin", "staff", "customer"], own: true, write: [], crud: false },
  credit_notes: { read: ["admin", "staff", "customer"], own: true, write: [], crud: false },
  payments: { read: ["admin", "staff", "customer"], own: true, write: [], crud: false },
  refunds: { read: ["admin", "staff", "customer"], own: true, write: [], crud: false },
  payment_attempts: { read: ["admin", "staff", "customer"], own: true, write: [], crud: false },
  discount_usages: { read: ["admin"], write: [], crud: false },
  usage_events: { read: ["admin", "staff", "customer"], own: true, write: [], crud: false },
  credit_wallets: { read: ["admin", "staff", "customer"], own: true, write: [], crud: false },
  credit_transactions: { read: ["admin", "staff", "customer"], own: true, write: [], crud: false },
  billing_jobs: { read: ["admin"], write: [], crud: false },
  billing_events: { read: ["admin"], write: [], crud: false },
  automation_executions: { read: ["admin"], write: [], crud: false },
  audit_logs: { read: ["admin"], write: [], crud: false },
  profiles: { read: ["admin"], write: [], crud: false },
  notifications: { read: ["admin", "staff", "customer"], own: true, write: [], crud: false },
} satisfies Record<string, ResourcePolicy>;

export type ResourceName = keyof typeof RESOURCES;

export function policyOf(name: string): ResourcePolicy | null {
  return (RESOURCES as Record<string, ResourcePolicy>)[name] ?? null;
}

export function canRead(role: Role, resource: string) {
  return !!policyOf(resource)?.read.includes(role);
}
export function canWrite(role: Role, resource: string) {
  const p = policyOf(resource);
  return !!p && p.crud && p.write.includes(role);
}

/** Domain actions (non-CRUD). */
export const ACTIONS = {
  "subscription.create": ["admin", "staff"],
  "subscription.transition": ["admin", "staff"],
  "subscription.change": ["admin", "staff"],
  "subscription.self_service": ["customer"],
  "invoice.create": ["admin", "staff"],
  "invoice.confirm": ["admin", "staff"],
  "invoice.cancel": ["admin", "staff"],
  "invoice.send": ["admin", "staff"],
  "invoice.credit_note": ["admin"],
  "payment.record": ["admin", "staff"],
  "payment.simulate": ["admin", "staff", "customer"],
  "payment.refund": ["admin"],
  "billing.run": ["admin"],
  "usage.record": ["admin", "staff", "customer"],
  "credits.adjust": ["admin"],
  "credits.topup": ["admin", "staff", "customer"],
  "staff.create": ["admin"],
  "settings.update": ["admin"],
  "analytics.view": ["admin", "staff"],
  "assistant.ask": ["admin", "staff", "customer"],
  "automation.test": ["admin"],
} satisfies Record<string, Role[]>;

export type ActionName = keyof typeof ACTIONS;
export function canDo(role: Role, action: ActionName) {
  return (ACTIONS[action] as Role[]).includes(role);
}
