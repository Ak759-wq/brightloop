import { addDays, addMonthsAnchored, compareDates, outstanding } from "@/lib/finance";
import type { Invoice, Organization, Subscription } from "@/lib/types";
import { hashPassword, DEFAULT_ORG_ID } from "./auth";
import type { Doc, Store } from "./store/types";
import { realToday, searchTokens, stamp, type Ctx, type Actor } from "./services/core";
import { createSubscription, transition, changeSubscription } from "./services/subscriptions";
import { billSubscription, runBilling } from "./services/billing";
import { recordPayment, simulatePayment } from "./services/payments";
import { recordUsage, topUpWallet } from "./services/usage";

export const DEMO_ACCOUNTS = [
  { email: "admin@brightloop.demo", password: "Admin@12345", name: "Ananya Rao", role: "admin" as const },
  { email: "staff@brightloop.demo", password: "Staff@12345", name: "Rohan Mehta", role: "staff" as const },
  { email: "customer@brightloop.demo", password: "Customer@123", name: "Aarav Shah", role: "customer" as const },
];

export interface SeedOptions {
  bulk?: number;
  /** firebase-admin user creation (seed script with a service account). Returns uid. */
  createAuthUser?: (email: string, password: string, name: string) => Promise<string>;
  /** "local" = local auth records; "firebase-claim" = pending profiles claimed on first Firebase sign-in */
  auth?: "local" | "firebase-claim" | "firebase-admin";
  log?: (msg: string) => void;
}

const R = (rupees: number) => Math.round(rupees * 100);

/** Tiny deterministic PRNG so the seed is reproducible. */
function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

export async function seedDemo(store: Store, opts: SeedOptions = {}) {
  const log = opts.log ?? (() => undefined);
  const auth = opts.auth ?? (process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? (opts.createAuthUser ? "firebase-admin" : "firebase-claim") : "local");
  const orgId = DEFAULT_ORG_ID;
  const today = realToday();
  const t = stamp(orgId);
  const rand = rng(42);

  const org: Organization = {
    id: orgId, ...t, name: "Brightloop Software", legalName: "Brightloop Software Pvt Ltd", sellerState: "29", sellerGstin: "29AABCB1234F1Z5",
    address: "4th Floor, Prestige Tech Park, Outer Ring Road, Bengaluru 560103", currency: "INR", paymentTermsDays: 15, dunningRetryDays: [1, 3, 7],
    autoConfirmInvoices: true, demo: true, demoDate: null, lowBalancePct: 20, overagePolicy: "overage", overageUnitPrice: 200,
    retentionDiscountId: "disc_retain20", supportEmail: "support@brightloop.demo",
  };
  await store.create("organizations", org as unknown as Record<string, unknown>, orgId);

  const put = (col: string, id: string, data: Record<string, unknown>) => store.create(col, { ...stamp(orgId), ...data }, id);

  // --- taxes ---
  await put("tax_rules", "tax_gst18", { name: "GST 18%", rateBp: 1800, kind: "GST", hsnSac: "998314", isDefault: true });
  await put("tax_rules", "tax_gst5", { name: "GST 5%", rateBp: 500, kind: "GST", hsnSac: "998313", isDefault: false });
  await put("tax_rules", "tax_exempt", { name: "Exempt (0%)", rateBp: 0, kind: "NONE", hsnSac: "", isDefault: false });

  // --- products ---
  const products = [
    { id: "prod_crm", name: "Brightloop CRM", type: "software", salesPrice: R(1000), costPrice: R(320), notes: "Sales pipeline, contacts and deals.", taxRuleId: "tax_gst18" },
    { id: "prod_books", name: "Brightloop Books", type: "software", salesPrice: R(1500), costPrice: R(480), notes: "GST-ready accounting.", taxRuleId: "tax_gst18" },
    { id: "prod_hr", name: "Brightloop HR", type: "software", salesPrice: R(800), costPrice: R(210), notes: "Payroll and leave.", taxRuleId: "tax_gst18" },
    { id: "prod_support", name: "Premium Support", type: "service", salesPrice: R(300), costPrice: R(120), notes: "4-hour response SLA.", taxRuleId: "tax_gst18" },
    { id: "prod_api", name: "API Credits", type: "service", salesPrice: R(500), costPrice: R(90), notes: "Usage-based API calls.", taxRuleId: "tax_gst18", usageMetric: "api_calls" },
    { id: "prod_training", name: "Training Workshop", type: "service", salesPrice: R(2500), costPrice: R(900), notes: "Education service, 5% GST demo rate.", taxRuleId: "tax_gst5" },
  ];
  for (const p of products) await put("products", p.id, { ...p, active: true, usageMetric: (p as { usageMetric?: string }).usageMetric ?? null, _search: searchTokens(p.name) });
  const variants = [
    { id: "var_crm_std", productId: "prod_crm", attribute: "Brand", value: "Standard", priceDelta: 0 },
    { id: "var_crm_odoo", productId: "prod_crm", attribute: "Brand", value: "Odoo", priceDelta: R(560) },
    { id: "var_crm_zoho", productId: "prod_crm", attribute: "Brand", value: "Zoho", priceDelta: R(400) },
    { id: "var_books_starter", productId: "prod_books", attribute: "Edition", value: "Starter", priceDelta: 0 },
    { id: "var_books_pro", productId: "prod_books", attribute: "Edition", value: "Pro", priceDelta: R(700) },
  ];
  for (const v of variants) await put("product_variants", v.id, { ...v, active: true });
  const addons = [
    { id: "add_support", productId: "prod_crm", name: "Premium support", price: R(300), description: "Priority support per seat" },
    { id: "add_storage", productId: null, name: "Extra storage (50 GB)", price: R(150), description: "Per seat" },
    { id: "add_sso", productId: null, name: "SSO / SAML", price: R(250), description: "Per seat" },
  ];
  for (const a of addons) await put("product_addons", a.id, { ...a, active: true });

  // --- plans ---
  const plan = (id: string, p: Record<string, unknown>) => put("plans", id, { description: "", features: [], tiers: [], intervalCount: 1, minQuantity: 1, availableFrom: null, availableUntil: null, termPeriods: null, autoClose: false, closable: true, pausable: true, renewable: true, active: true, public: true, includedCredits: 0, ...p, _search: searchTokens(p.name as string) });
  await plan("plan_crm_m", { name: "CRM Monthly", productId: "prod_crm", pricingModel: "per_seat", price: R(1000), interval: "monthly", description: "Per seat, billed monthly. Cancel anytime.", features: ["Unlimited pipelines", "Email sync", "Mobile app"] });
  await plan("plan_crm_y", { name: "CRM Annual", productId: "prod_crm", pricingModel: "per_seat", price: R(10000), interval: "yearly", minQuantity: 3, termPeriods: 1, renewable: true, pausable: false, closable: false, description: "Two months free. 12-month term, min 3 seats.", features: ["Everything in Monthly", "Dedicated onboarding", "Annual business review"] });
  await plan("plan_books_m", { name: "Books Monthly", productId: "prod_books", pricingModel: "flat", price: R(1500), interval: "monthly", description: "Flat price for the whole company.", features: ["GST returns", "Bank feeds", "Unlimited invoices"] });
  await plan("plan_books_w", { name: "Books Weekly Lite", productId: "prod_books", pricingModel: "flat", price: R(400), interval: "weekly", description: "For seasonal businesses.", features: ["Core accounting"] });
  await plan("plan_hr_tier", { name: "HR Graduated", productId: "prod_hr", pricingModel: "tiered", price: 0, interval: "monthly", minQuantity: 5, tiers: [{ upTo: 10, unitAmount: R(800) }, { upTo: 50, unitAmount: R(650) }, { upTo: null, unitAmount: R(500) }], description: "Graduated per-employee pricing, min 5.", features: ["Payroll", "Leave", "Attendance"] });
  await plan("plan_crm_vol", { name: "CRM Enterprise Volume", productId: "prod_crm", pricingModel: "volume", price: 0, interval: "monthly", minQuantity: 20, tiers: [{ upTo: 50, unitAmount: R(900) }, { upTo: 200, unitAmount: R(750) }, { upTo: null, unitAmount: R(600) }], public: false, description: "All seats at the volume tier price.", features: ["SSO", "Audit trail"] });
  await plan("plan_api_d", { name: "API Daily Pass", productId: "prod_api", pricingModel: "flat", price: R(50), interval: "daily", autoClose: true, termPeriods: 30, description: "Daily API access, auto-closes after 30 days.", features: ["10k calls/day"] });
  await plan("plan_promo", { name: "Diwali Promo CRM (ended)", productId: "prod_crm", pricingModel: "per_seat", price: R(799), interval: "monthly", availableFrom: addMonthsAnchored(today, -3), availableUntil: addMonthsAnchored(today, -1), autoClose: true, termPeriods: 3, public: false, active: true, description: "Limited-time plan; auto-closes after 3 months." });

  // --- discounts ---
  const disc = (id: string, d: Record<string, unknown>) => put("discounts", id, { code: "", productIds: [], minQuantity: null, minAmount: null, startDate: null, endDate: null, usageLimit: null, usedCount: 0, active: true, ...d, _search: searchTokens(d.name as string, d.code as string) });
  await disc("disc_welcome10", { name: "Welcome 10%", code: "WELCOME10", type: "percent", value: 1000, scope: "subscription", usageLimit: 100 });
  await disc("disc_seats5", { name: "₹500 off for 5+ CRM seats", code: "SEATS5", type: "fixed", value: R(500), scope: "product", productIds: ["prod_crm"], minQuantity: 5 });
  await disc("disc_retain20", { name: "Retention offer 20%", code: "STAY20", type: "percent", value: 2000, scope: "subscription", usageLimit: 50 });
  await disc("disc_launch", { name: "Launch week 15% (expired)", code: "LAUNCH15", type: "percent", value: 1500, scope: "subscription", startDate: addMonthsAnchored(today, -8), endDate: addMonthsAnchored(today, -6) });
  await disc("disc_big", { name: "Big basket ₹2,000 off over ₹20,000", code: "BIG2000", type: "fixed", value: R(2000), scope: "subscription", minAmount: R(20000), usageLimit: 3 });

  // --- quotation templates ---
  await put("quotation_templates", "qt_crm_ent", { name: "CRM Enterprise Starter", planId: "plan_crm_y", validityDays: 30, paymentTermsDays: 30, notes: "Includes onboarding.", items: [{ productId: "prod_crm", variantIds: ["var_crm_odoo"], addonIds: ["add_support"], quantity: 10 }], _search: searchTokens("CRM Enterprise Starter") });
  await put("quotation_templates", "qt_books_pro", { name: "Books Pro + Support", planId: "plan_books_m", validityDays: 15, notes: "", items: [{ productId: "prod_books", variantIds: ["var_books_pro"], addonIds: [], quantity: 1 }, { productId: "prod_support", variantIds: [], addonIds: [], quantity: 2 }], _search: searchTokens("Books Pro Support") });

  // --- automations ---
  const rule = (id: string, r: Record<string, unknown>) => put("automation_rules", id, { minAmount: null, tag: "", enabled: true, ...r });
  await rule("rule_overdue", { name: "Overdue → alert finance", trigger: "invoice.overdue", action: "notify_staff", message: "{label} is overdue ({amount}). Chase the customer." });
  await rule("rule_failed", { name: "Payment failed → email customer", trigger: "payment.failed", action: "email_customer", message: "We couldn't collect {amount} for {label}. Please update your payment method." });
  await rule("rule_low", { name: "Low credits → nudge customer", trigger: "credits.low", action: "notify_customer", message: "Your API credits are below 20%. Top up to avoid interruption." });
  await rule("rule_atrisk", { name: "Dunning exhausted → tag at-risk", trigger: "dunning.exhausted", action: "tag_customer", tag: "at-risk", message: "All retries failed for {label}." });
  await rule("rule_big", { name: "Large invoice → notify staff", trigger: "invoice.created", action: "notify_staff", minAmount: R(100000), message: "Large invoice {label} issued for {amount}." });

  // --- customers ---
  const people: [string, string, string, string][] = [
    ["Aarav Shah", "Aarav Retail", "29", "Bengaluru"], ["Priya Nair", "Nair Logistics", "32", "Kochi"], ["Vikram Singh", "Singh Motors", "07", "New Delhi"],
    ["Meera Iyer", "Iyer & Co Chartered Accountants", "33", "Chennai"], ["Kabir Kapoor", "Kapoor Textiles", "27", "Mumbai"], ["Sneha Reddy", "Reddy Pharma", "36", "Hyderabad"],
    ["Arjun Patel", "Patel Foods", "24", "Ahmedabad"], ["Ishita Das", "Das Design Studio", "19", "Kolkata"], ["Rahul Verma", "Verma Electronics", "09", "Noida"],
    ["Divya Menon", "Menon Clinics", "29", "Mysuru"], ["Nikhil Joshi", "Joshi Builders", "27", "Pune"], ["Ananya Gupta", "Gupta Jewellers", "08", "Jaipur"],
    ["Karthik Subramanian", "Subra Analytics", "29", "Bengaluru"], ["Fatima Khan", "Khan Travels", "09", "Lucknow"], ["Rohit Malhotra", "Malhotra Exports", "03", "Ludhiana"],
    ["Pooja Bhat", "Bhat Organics", "29", "Mangaluru"], ["Siddharth Rao", "Rao Edutech", "36", "Hyderabad"], ["Neha Agarwal", "Agarwal Steel", "20", "Ranchi"],
    ["Aditya Kulkarni", "Kulkarni Robotics", "27", "Nashik"], ["Lakshmi Pillai", "Pillai Cashews", "32", "Kollam"], ["Harsh Vardhan", "Vardhan Media", "07", "New Delhi"],
    ["Tanvi Shetty", "Shetty Hospitality", "29", "Udupi"], ["Manish Tiwari", "Tiwari Agro", "23", "Indore"],
  ];
  const custIds: string[] = [];
  for (let i = 0; i < people.length; i++) {
    const [name, company, st, city] = people[i];
    const id = `cust_${String(i + 1).padStart(3, "0")}`;
    const email = i === 0 ? "customer@brightloop.demo" : `${name.split(" ")[0].toLowerCase()}@${company.split(" ")[0].toLowerCase()}.example`;
    await put("customers", id, { name: company, email, phone: `+91 98${String(10000000 + i * 7919).slice(0, 8)}`, company, gstin: "", billingAddress: `${10 + i}, MG Road`, city, placeOfSupply: st, country: "IN", userId: null, creditBalance: 0, tags: [], status: "active", contactName: name, _search: searchTokens(company, name, email, city) });
    custIds.push(id);
    await put("customer_contacts", `cc_${id}`, { customerId: id, name, email, phone: "", role: "Owner" });
  }
  // a customer WITHOUT place of supply: invoicing taxable lines is refused until fixed (never guessed)
  await put("customers", "cust_nopos", { name: "Unconfigured Ventures", email: "ops@unconfigured.example", phone: "", company: "Unconfigured Ventures", gstin: "", billingAddress: "", city: "", placeOfSupply: null, country: "IN", userId: null, creditBalance: 0, tags: ["needs-setup"], status: "active", _search: searchTokens("Unconfigured Ventures") });

  // --- accounts ---
  for (const acc of DEMO_ACCOUNTS) {
    const customerId = acc.role === "customer" ? "cust_001" : null;
    let uid: string;
    if (auth === "firebase-admin" && opts.createAuthUser) uid = await opts.createAuthUser(acc.email, acc.password, acc.name);
    else if (auth === "firebase-claim") uid = `pending_${acc.email}`;
    else uid = `usr_${acc.role}`;
    await put("profiles", uid, { uid, email: acc.email, name: acc.name, role: acc.role, customerId, disabled: false, claimable: auth === "firebase-claim", _search: searchTokens(acc.name, acc.email) });
    if (auth === "local") await store.create("local_auth", { email: acc.email, uid, passwordHash: hashPassword(acc.password), createdAt: t.createdAt }, acc.email);
    if (customerId) await store.update("customers", customerId, { userId: uid });
  }
  log("catalog, customers and accounts created");

  // --- simulated history (uses the real services, day by day) ---
  const admin: Actor = { uid: "usr_admin", name: "Seed script", role: "admin" };
  const ctx: Ctx = { store, org, actor: admin, today: addMonthsAnchored(today, -9) };
  type Plan = { sub: Partial<{ customer: string; plan: string; items: { productId: string; variantIds: string[]; addonIds: string[]; quantity: number }[]; discounts: string[]; startOffsetDays: number; payer: "good" | "late" | "partial" | "never"; pauseAfterDays?: number; closeAfterDays?: number; upgradeAfterDays?: number }> };
  const L = (productId: string, quantity: number, variantIds: string[] = [], addonIds: string[] = []) => ({ productId, quantity, variantIds, addonIds });
  const specs: Plan["sub"][] = [
    { customer: "cust_001", plan: "plan_crm_m", items: [L("prod_crm", 5, ["var_crm_odoo"], ["add_support"])], discounts: ["disc_welcome10"], startOffsetDays: 200, payer: "good" },
    { customer: "cust_001", plan: "plan_api_d", items: [L("prod_api", 1)], startOffsetDays: 6, payer: "good" },
    { customer: "cust_002", plan: "plan_crm_y", items: [L("prod_crm", 12, ["var_crm_zoho"])], startOffsetDays: 250, payer: "good" },
    { customer: "cust_003", plan: "plan_books_m", items: [L("prod_books", 1, ["var_books_pro"]), L("prod_support", 2)], startOffsetDays: 180, payer: "late" },
    { customer: "cust_004", plan: "plan_hr_tier", items: [L("prod_hr", 18)], startOffsetDays: 150, payer: "good", upgradeAfterDays: 75 },
    { customer: "cust_005", plan: "plan_crm_m", items: [L("prod_crm", 8, ["var_crm_odoo"])], discounts: ["disc_seats5"], startOffsetDays: 170, payer: "never" },
    { customer: "cust_006", plan: "plan_books_w", items: [L("prod_books", 1)], startOffsetDays: 70, payer: "good" },
    { customer: "cust_007", plan: "plan_crm_m", items: [L("prod_crm", 3)], startOffsetDays: 120, payer: "partial" },
    { customer: "cust_008", plan: "plan_books_m", items: [L("prod_books", 1)], startOffsetDays: 140, payer: "good", closeAfterDays: 100 },
    { customer: "cust_009", plan: "plan_crm_vol", items: [L("prod_crm", 60, [], ["add_sso"])], startOffsetDays: 210, payer: "good" },
    { customer: "cust_010", plan: "plan_crm_m", items: [L("prod_crm", 2)], startOffsetDays: 90, payer: "good", pauseAfterDays: 50 },
    { customer: "cust_011", plan: "plan_hr_tier", items: [L("prod_hr", 7)], startOffsetDays: 60, payer: "late" },
    { customer: "cust_012", plan: "plan_books_m", items: [L("prod_books", 1, ["var_books_pro"])], startOffsetDays: 45, payer: "good" },
    { customer: "cust_013", plan: "plan_crm_m", items: [L("prod_crm", 10, ["var_crm_odoo"], ["add_support"])], startOffsetDays: 30, payer: "good" },
    { customer: "cust_014", plan: "plan_crm_m", items: [L("prod_crm", 4, ["var_crm_zoho"])], startOffsetDays: 160, payer: "good", closeAfterDays: 140 },
    { customer: "cust_015", plan: "plan_books_m", items: [L("prod_books", 1)], startOffsetDays: 20, payer: "never" },
    { customer: "cust_016", plan: "plan_crm_y", items: [L("prod_crm", 5)], startOffsetDays: 359, payer: "good" },
    { customer: "cust_017", plan: "plan_crm_m", items: [L("prod_crm", 6, [], ["add_storage"])], startOffsetDays: 100, payer: "good" },
    { customer: "cust_018", plan: "plan_hr_tier", items: [L("prod_hr", 55)], startOffsetDays: 80, payer: "good" },
    { customer: "cust_019", plan: "plan_crm_m", items: [L("prod_crm", 2, ["var_crm_odoo"])], startOffsetDays: 12, payer: "good" },
    { customer: "cust_020", plan: "plan_books_m", items: [L("prod_books", 1)], startOffsetDays: 110, payer: "good" },
  ];
  const created: { spec: Plan["sub"]; id: string; start: string }[] = [];
  const start0 = addDays(today, -Math.max(...specs.map((s) => s.startOffsetDays!)));
  ctx.today = start0;
  const payLater: { invoiceId: string; on: string; partial?: boolean }[] = [];
  const schedulePay = async () => {
    const invs = await store.all<Invoice>("invoices", [["orgId", "==", orgId], ["invoiceDate", "==", ctx.today]]);
    for (const inv of invs) {
      const c = created.find((x) => x.id === inv.subscriptionId);
      const payer = c?.spec.payer ?? "good";
      if (inv.status === "paid") continue;
      if (c?.spec.customer === "cust_001" && c.spec.plan === "plan_crm_m" && compareDates(ctx.today, addDays(today, -25)) > 0) continue;
      if (payer === "good") payLater.push({ invoiceId: inv.id, on: addDays(ctx.today, 1 + Math.floor(rand() * 6)) });
      if (payer === "late") payLater.push({ invoiceId: inv.id, on: addDays(ctx.today, 20 + Math.floor(rand() * 10)) });
      if (payer === "partial") payLater.push({ invoiceId: inv.id, on: addDays(ctx.today, 5), partial: true });
    }
  };
  for (let day = start0; compareDates(day, today) <= 0; day = addDays(day, 1)) {
    ctx.today = day;
    for (const spec of specs) {
      if (addDays(today, -spec.startOffsetDays!) !== day) continue;
      const s = await createSubscription(ctx, { customerId: spec.customer!, planId: spec.plan!, items: spec.items!, discountIds: spec.discounts ?? [], status: "quotation", startDate: day, quoteValidUntil: addDays(day, 15) });
      await transition(ctx, s.id, "confirm");
      await transition(ctx, s.id, "activate");
      created.push({ spec, id: s.id, start: day });
    }
    for (const c of created) {
      const since = -compareDates(c.start, day) === 0 ? 0 : Math.round((Date.parse(day) - Date.parse(c.start)) / 86400000);
      const sub = await store.get<Subscription>("subscriptions", c.id);
      if (!sub) continue;
      if (c.spec.pauseAfterDays === since && sub.status === "active") await transition(ctx, c.id, "pause", { reason: "Seasonal shutdown" });
      if (c.spec.closeAfterDays === since && sub.status === "active") await transition(ctx, c.id, "close", { reason: since > 120 ? "Switched to a competitor" : "Business closed" });
      if (c.spec.upgradeAfterDays === since && sub.status === "active") await changeSubscription(ctx, c.id, { items: [L("prod_hr", 26)] });
      if (sub.status === "active" && sub.nextBillingDate && compareDates(sub.nextBillingDate, day) <= 0) await billSubscription(ctx, sub);
    }
    await schedulePay();
    for (const p of payLater.filter((x) => x.on === day)) {
      const inv = await store.get<Invoice>("invoices", p.invoiceId);
      if (!inv || outstanding(inv) <= 0) continue;
      const amt = p.partial ? Math.floor(outstanding(inv) / 2) : outstanding(inv);
      await recordPayment(ctx, { invoiceId: inv.id, method: (["upi", "bank_transfer", "card"] as const)[Math.floor(rand() * 3)], amount: amt, date: day, note: p.partial ? "Part payment" : "", reference: "" });
    }
  }
  // demo customer: leave the latest CRM invoice unpaid so the portal shows "Pay now"
  ctx.today = today;
  const demoInvs = (await store.all<Invoice>("invoices", [["customerId", "==", "cust_001"]])).sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate));
  void demoInvs;
  // failed payments for repeated-failure analytics
  const never = (await store.all<Invoice>("invoices", [["customerId", "==", "cust_005"]])).filter((i) => outstanding(i) > 0).slice(-1)[0];
  if (never) { await simulatePayment(ctx, never.id, "fail", { reason: "Insufficient funds (simulated)" }); await simulatePayment(ctx, never.id, "fail", { reason: "Card expired (simulated)" }); }
  // usage & credits for the demo customer
  const apiSub = created.find((c) => c.spec.plan === "plan_api_d" && c.spec.customer === "cust_001");
  await topUpWallet(ctx, "cust_001", 1000, "Starter credit pack");
  if (apiSub) for (const q of [120, 260, 180, 90]) await recordUsage(ctx, { subscriptionId: apiSub.id, metric: "api_calls", quantity: q });
  // drafts and quotations
  const d1 = await createSubscription(ctx, { customerId: "cust_021", planId: "plan_crm_y", items: [L("prod_crm", 10, ["var_crm_odoo"], ["add_support"])], discountIds: [], status: "quotation", quoteValidUntil: addDays(today, 30), templateId: "qt_crm_ent", paymentTermsDays: 30 });
  await createSubscription(ctx, { customerId: "cust_022", planId: "plan_books_m", items: [L("prod_books", 1, ["var_books_pro"]), L("prod_support", 2)], discountIds: ["disc_welcome10"], status: "draft" });
  await createSubscription(ctx, { customerId: "cust_nopos", planId: "plan_crm_m", items: [L("prod_crm", 3)], discountIds: [], status: "draft", notes: "Customer place of supply missing – set it before activating." });
  void d1;
  await runBilling(ctx, "demo");
  log(`history simulated: ${created.length} subscriptions`);

  if (opts.bulk && opts.bulk > 0) await seedBulk(store, opts.bulk, today, log);
}

/** ~N lightweight active subscriptions for list/analytics performance checks (no invoices). */
export async function seedBulk(store: Store, n: number, today: string, log: (m: string) => void = () => undefined) {
  const orgId = DEFAULT_ORG_ID;
  const plans = [["plan_crm_m", "CRM Monthly", "monthly", 100000], ["plan_books_m", "Books Monthly", "monthly", 150000], ["plan_crm_y", "CRM Annual", "yearly", 1000000], ["plan_books_w", "Books Weekly Lite", "weekly", 40000]] as const;
  const custs: Doc[] = [];
  const subs: Doc[] = [];
  const rand = rng(7);
  const statuses = ["active", "active", "active", "active", "paused", "closed", "draft", "quotation"] as const;
  for (let i = 0; i < Math.ceil(n / 3); i++) {
    const id = `bcust_${i}`;
    custs.push({ id, ...stamp(orgId), name: `Bulk Customer ${i}`, email: `bulk${i}@load.example`, company: `Bulk Customer ${i}`, placeOfSupply: i % 2 ? "29" : "27", country: "IN", creditBalance: 0, tags: ["bulk"], status: "active", _search: searchTokens(`Bulk Customer ${i}`, `bulk${i}@load.example`) });
  }
  for (let i = 0; i < n; i++) {
    const [planId, planName, interval, price] = plans[i % plans.length];
    const qty = 1 + Math.floor(rand() * 9);
    const start = addDays(today, -Math.floor(rand() * 300) - 1);
    const status = statuses[Math.floor(rand() * statuses.length)];
    const amount = price * (planId === "plan_books_m" || planId === "plan_books_w" ? 1 : qty);
    const number = `BULK-${String(i + 1).padStart(6, "0")}`;
    const custId = `bcust_${i % custs.length}`;
    subs.push({
      id: `bsub_${i}`, ...stamp(orgId), number, customerId: custId, customerName: `Bulk Customer ${i % custs.length}`, planId, planName, status,
      items: [{ productId: planId.startsWith("plan_crm") ? "prod_crm" : "prod_books", productName: planId.startsWith("plan_crm") ? "Brightloop CRM" : "Brightloop Books", variantIds: [], addonIds: [], quantity: qty, unitPrice: price, amount }],
      discountIds: [], redeemedDiscountIds: [], startDate: status === "draft" || status === "quotation" ? null : start, endDate: null, anchorDate: start,
      nextBillingDate: status === "active" ? addDays(today, 1 + Math.floor(rand() * 28)) : null, currentPeriodStart: start, interval, intervalCount: 1, paymentTermsDays: 15,
      recurringAmount: amount, subtotal: amount, version: 1, autoClose: false, bulk: true, closedAt: status === "closed" ? addDays(today, -Math.floor(rand() * 60)) + "T00:00:00.000Z" : null,
      activatedAt: status === "active" ? start + "T00:00:00.000Z" : null, _search: searchTokens(number, `Bulk Customer ${i % custs.length}`, planName),
    });
  }
  await store.bulkSet("customers", custs);
  await store.bulkSet("subscriptions", subs);
  log(`bulk: ${custs.length} customers, ${subs.length} subscriptions`);
}
