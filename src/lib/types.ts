import type { Interval, PricingModel, SubStatus, Tier, InvoiceItemSnapshot, InvoiceTotals, InvoiceStatus } from "./finance";

export type Role = "admin" | "staff" | "customer";
export type Minor = number;

export interface BaseDoc {
  id: string;
  orgId: string;
  createdAt: string;
  updatedAt: string;
  _search?: string[];
}

export interface Organization extends BaseDoc {
  name: string;
  legalName: string;
  sellerState: string;
  sellerGstin?: string;
  address?: string;
  currency: string;
  paymentTermsDays: number;
  dunningRetryDays: number[];
  autoConfirmInvoices: boolean;
  demo: boolean;
  demoDate?: string | null;
  lowBalancePct: number;
  overagePolicy: "block" | "overage";
  overageUnitPrice: Minor;
  retentionDiscountId?: string | null;
  supportEmail?: string;
}

export interface Profile extends BaseDoc {
  uid: string;
  email: string;
  name: string;
  role: Role;
  customerId?: string | null;
  disabled?: boolean;
}

export interface Customer extends BaseDoc {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  gstin?: string;
  billingAddress?: string;
  city?: string;
  /** GST state code for place of supply. Required to invoice taxable lines. */
  placeOfSupply?: string | null;
  country: string;
  userId?: string | null;
  creditBalance: Minor;
  tags?: string[];
  status: "active" | "archived";
}

export interface CustomerContact extends BaseDoc {
  customerId: string;
  name: string;
  email: string;
  phone?: string;
  role?: string;
}

export interface Product extends BaseDoc {
  name: string;
  type: "service" | "software" | "goods";
  salesPrice: Minor;
  costPrice?: Minor;
  notes?: string;
  taxRuleId?: string | null;
  active: boolean;
  usageMetric?: string | null;
}

export interface ProductVariant extends BaseDoc {
  productId: string;
  attribute: string;
  value: string;
  priceDelta: Minor;
  active: boolean;
}

export interface ProductAddon extends BaseDoc {
  productId?: string | null;
  name: string;
  price: Minor;
  description?: string;
  active: boolean;
}

export interface Plan extends BaseDoc {
  name: string;
  productId: string;
  description?: string;
  features?: string[];
  pricingModel: PricingModel;
  /** unit price (per_seat) or fixed price (flat). Overrides product sales price for the primary line. */
  price: Minor;
  tiers?: Tier[];
  interval: Interval;
  intervalCount: number;
  minQuantity: number;
  availableFrom?: string | null;
  availableUntil?: string | null;
  /** term length in billing periods for the expiry date; null = open-ended */
  termPeriods?: number | null;
  autoClose: boolean;
  closable: boolean;
  pausable: boolean;
  renewable: boolean;
  active: boolean;
  public: boolean;
  includedCredits?: number;
}

export interface LineItem {
  productId: string;
  productName: string;
  variantIds: string[];
  variantLabel?: string;
  addonIds: string[];
  quantity: number;
  /** computed per-unit price incl. variants/add-ons (minor) */
  unitPrice: Minor;
  /** computed pre-discount amount for one billing period (minor) */
  amount: Minor;
}

export interface QuotationTemplate extends BaseDoc {
  name: string;
  planId: string;
  validityDays: number;
  items: Omit<LineItem, "unitPrice" | "amount" | "productName">[];
  notes?: string;
  paymentTermsDays?: number;
}

export interface Subscription extends BaseDoc {
  number: string;
  customerId: string;
  customerName: string;
  planId: string;
  planName: string;
  status: SubStatus;
  items: LineItem[];
  discountIds: string[];
  redeemedDiscountIds: string[];
  startDate?: string | null;
  endDate?: string | null;
  anchorDate?: string | null;
  nextBillingDate?: string | null;
  currentPeriodStart?: string | null;
  interval: Interval;
  intervalCount: number;
  paymentTermsDays: number;
  /** recurring amount per interval, pre-tax, post-discount (for MRR) */
  recurringAmount: Minor;
  subtotal: Minor;
  quoteValidUntil?: string | null;
  templateId?: string | null;
  version: number;
  pastDue?: boolean;
  closeReason?: string | null;
  closedAt?: string | null;
  activatedAt?: string | null;
  notes?: string;
  autoClose: boolean;
  createdBy?: string;
}

export interface Invoice extends BaseDoc {
  number: string;
  subscriptionId?: string | null;
  subscriptionNumber?: string | null;
  customerId: string;
  customer: { name: string; email: string; gstin?: string; address?: string; placeOfSupply?: string | null };
  seller: { name: string; gstin?: string; state: string; address?: string };
  status: InvoiceStatus;
  kind: "recurring" | "proration" | "manual" | "credits";
  invoiceDate: string;
  dueDate: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  currency: string;
  items: InvoiceItemSnapshot[];
  totals: InvoiceTotals;
  /** denormalised totals.total (used for status math, sorting and Firestore filters) */
  total: Minor;
  discountsApplied: { id: string; name: string; amount: Minor }[];
  amountPaid: Minor;
  amountRefunded: Minor;
  creditNoted: Minor;
  failedAttempts: number;
  nextRetryOn?: string | null;
  dunningExhausted?: boolean;
  idempotencyKey?: string | null;
  sentAt?: string | null;
  confirmedAt?: string | null;
  paidAt?: string | null;
  cancelledAt?: string | null;
  overdueNotified?: boolean;
  demoClock?: boolean;
}

export interface Payment extends BaseDoc {
  invoiceId: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  method: "upi" | "card" | "bank_transfer" | "cash" | "cheque" | "simulator" | "razorpay" | "credit";
  amount: Minor;
  date: string;
  note?: string;
  reference?: string;
  status: "succeeded";
  amountRefunded: Minor;
  recordedBy: string;
}

export interface Notification extends BaseDoc {
  audience: "staff" | "customer";
  customerId?: string | null;
  title: string;
  body: string;
  link?: string;
  level: "info" | "success" | "warning" | "danger";
  read: boolean;
  channel: "in_app" | "email_logged" | "email_sent";
}
