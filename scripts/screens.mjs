// Captures UI screenshots for the UI audit. Usage: BASE=http://localhost:3005 node scripts/screens.mjs [outDir] [page...]
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
const BASE = process.env.BASE || "http://localhost:3005";
const out = process.argv[2] || "screens";
const only = process.argv.slice(3);
mkdirSync(out, { recursive: true });
const ACC = { admin: ["admin@brightloop.demo", "Admin@12345"], staff: ["staff@brightloop.demo", "Staff@12345"], customer: ["customer@brightloop.demo", "Customer@123"] };
const PAGES = [
  ["login", null, "/login"],
  ["admin-overview", "admin", "/app/overview"], ["admin-subscriptions", "admin", "/app/subscriptions"], ["admin-invoices", "admin", "/app/invoices"],
  ["admin-analytics", "admin", "/app/analytics"], ["admin-plans", "admin", "/app/plans"], ["admin-products", "admin", "/app/products"], ["admin-customers", "admin", "/app/customers"],
  ["admin-quotations", "admin", "/app/quotations"], ["admin-payments", "admin", "/app/payments"], ["admin-discounts", "admin", "/app/discounts"], ["admin-taxes", "admin", "/app/taxes"],
  ["admin-usage", "admin", "/app/usage"], ["admin-automations", "admin", "/app/automations"], ["admin-assistant", "admin", "/app/assistant"], ["admin-audit", "admin", "/app/audit"], ["admin-settings", "admin", "/app/settings"],
  ["admin-sub-new", "admin", "/app/subscriptions/new"],
  ["staff-overview", "staff", "/app/overview"],
  ["portal-overview", "customer", "/portal/overview"], ["portal-plans", "customer", "/portal/plans"], ["portal-subscriptions", "customer", "/portal/subscriptions"], ["portal-invoices", "customer", "/portal/invoices"], ["portal-usage", "customer", "/portal/usage"],
];
// extra pages, e.g. EXTRA='[["inv","admin","/app/invoices/x"]]'
if (process.env.EXTRA) PAGES.push(...JSON.parse(process.env.EXTRA));
const browser = await chromium.launch();
const tokens = {};
for (const [role, [email, password]] of Object.entries(ACC)) {
  const r = await fetch(`${BASE}/api/auth/local/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
  tokens[role] = (await r.json()).token;
}
const mobile = process.env.MOBILE === "1";
for (const [name, role, path] of PAGES) {
  if (only.length && !only.includes(name)) continue;
  const ctx = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  if (role) await ctx.addInitScript((t) => localStorage.setItem("brightloop_token", t), tokens[role]);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(BASE + path, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${out}/${name}${mobile ? "-m" : ""}.png`, fullPage: true });
  console.log(name, errors.length ? `ERRORS: ${errors.slice(0, 3).join(" | ")}` : "ok");
  await ctx.close();
}
await browser.close();
