# Requirements checklist

Status scale: **Not started · In progress · Implemented · Tested · Verified**
- *Implemented* = code exists and is reachable in the UI/API.
- *Tested* = covered by automated tests (unit/integration/API smoke).
- *Verified* = tested **and** exercised end-to-end against a running build (API smoke and/or screenshot review).

Verification environment: local auth + local JSON store build. Firebase Auth/Firestore paths are implemented but could not be exercised from the build sandbox (Google identity endpoints unreachable) — marked accordingly.

## Brief (mandatory)
| Requirement | Status | Evidence |
|---|---|---|
| Register with email + password; one account per email | Verified | smoke: duplicate email rejected, registration creates customer |
| Password > 8 chars, upper, lower, special (client + server) | Verified | zod `passwordSchema`; smoke: weak password rejected server-side; live checklist on /register |
| Password reset link to registered email | Implemented | Firebase `sendPasswordResetEmail` (not exercised in sandbox); local mode token flow logs link server-side |
| Roles admin / staff / customer; customers see only their own data | Verified | smoke: 11 RBAC checks incl. customer isolation |
| Only admin can add staff | Verified | smoke: staff → 403; admin form in Settings → Team |
| Product: name, type, sales price, cost price, notes | Verified | Products page; smoke creates product; staff cost price hidden |
| Variants with price deltas (Odoo +₹560) | Tested | unit P-01, integration ₹1,860, smoke preview |
| Plan: price, daily/weekly/monthly/yearly, min quantity, available dates | Verified | Plans page; unit D-*, P-08; smoke min-qty |
| Auto-close vs closable / pausable / renewable per plan | Tested | unit B-05, B-06, L-03; runner auto-close |
| Quotation templates valid N days → subscription | Implemented | Quotations page; expiry blocks confirm (not in automated tests) |
| Subscription number, customer, plan, start, expiry, payment terms, lines with product/qty/unit price/taxes/amount | Verified | subscription detail + invoice lines; SUB-000123 sequence |
| Draft → Quotation → Confirmed → Active → Closed visible to the team | Verified | unit L-*, smoke transitions, stepper |
| Invoices created automatically from subscriptions with customer details, lines, taxes, totals | Verified | runner + activation; integration + smoke exact totals |
| Taxes calculated automatically from admin rules | Tested | unit T-*, I-*; smoke IGST |
| Confirm / cancel / send / print invoices; Draft → Confirmed → Paid | Verified | invoice actions; smoke cancel guard; print CSS + PDF (screenshot review) |
| Nothing billed twice or skipped | Tested | unit B-03, B-07/08; integration re-run, concurrent lock, stale-sub duplicate; smoke re-run 0 |
| Admin-only discounts: fixed/percent, min purchase/qty, dates, usage limit | Verified | unit C-*; smoke staff → 403 |
| Discount on specific products or whole subscription; auto-applied; stops on expiry / exhaustion | Tested | unit C-02, C-06, C-08, C-09; invoices list applied discounts |
| Payments with method, amount, date, note against invoice | Verified | smoke partial + overpayment guard |
| See paid vs outstanding; chase overdue | Verified | invoices tabs/KPIs; overdue derivation unit Y-03; runner marks overdue |
| Finance lead view: active subs, revenue, payments, overdue with filters + summary | Verified | Overview + Analytics + filters (screenshots) |
| Thousands of subscriptions, pages < 2 s | Tested | bulk seed 3,000; integration analytics < 2 s; smoke list latency (local store). Firestore latency not measured. |

## Extended scope
| Feature | Status | Notes |
|---|---|---|
| Integer paise, INR default, extensible currency field | Implemented | `currency` stored on org & invoice; no FX |
| Invoice snapshots never recomputed | Tested | items/totals frozen; credit notes for corrections |
| Firestore rules (customers own docs, staff limits, immutable financial docs) | Implemented | `firestore.rules`; not run against the emulator |
| Firestore composite indexes | Implemented | `firestore.indexes.json` (82 indexes); not deployed from sandbox |
| Transactions for sequences, invoice generation, discount redemption | Tested | Store `tx` in both backends; integration tests |
| Flat / per-seat / tiered / volume pricing | Tested | unit P-02..P-07, P-10 |
| Month-end anchoring & leap years | Tested | unit D-01..D-14 |
| Proration on upgrade/downgrade | Verified | unit R-*; integration; smoke |
| GST CGST+SGST vs IGST from configured states, never guessed | Verified | unit T-04/T-05; integration "missing place of supply" |
| Partial payments, allocation, outstanding, overdue | Tested | unit Y-* |
| Refunds and credit notes | Tested | unit Y-06/Y-07/Y-13/Y-14; integration refund |
| MRR, ARR, churn, NRR/GRR, ARPC, payment success rate | Tested | unit K-*, Y-16; NRR/GRR in UI are labelled estimates |
| Billing runner: idempotency, advance date, jobs/events log, retry/failed tracking, lock | Verified | integration + smoke; Automations → Billing jobs |
| POST /api/billing/run with CRON_SECRET or admin | Verified | smoke (no secret → 401, secret → 200) |
| GitHub Actions billing cron + CI | Implemented | workflows written; not executed (no push from sandbox) |
| Vercel deploy: `vercel.json` daily cron (GET + Bearer secret), region bom1 | Implemented | build verified with only Firebase + CRON_SECRET env; cron not exercised |
| Protected idempotent `POST /api/admin/seed` (Firestore + Firebase Auth users) | Tested (local) | seed-and-copy logic tested against a second FileStore in integration tests; Firestore/Firebase Auth path not executable from sandbox |
| Demo clock (demo orgs only, labelled, real timestamps untouched) | Implemented | Settings → Demo clock; badge |
| Payment Simulator (success / fail with reason / partial) | Verified | smoke |
| Razorpay adapter + webhook signature verification | Implemented | real HMAC check (smoke: bad signature → 401); order creation untested without keys |
| Dunning: attempt, notify, retry schedule, staff alert | Tested | unit N-*; integration; runner reminders |
| Customer portal (8 pages) | Verified | screenshots; smoke self-subscribe & pay |
| Pause / resume / renew / cancel with reason + retention offer | Verified | smoke pause/resume/close; retention via UI |
| Version history + audit log | Verified | smoke ≥ 6 versions; Audit Logs page |
| Invoice preview / print / PDF / send (logged when no email provider) | Implemented | screenshot review; PDF generation not automated |
| Usage events + credit wallet + ledger, 20% low-balance alert, block/overage | Tested | unit W-*; integration idempotency |
| Analytics: MRR/ARR, revenue trend, receivables ageing, revenue bridge, estimates labelled, definitions | Verified | screenshots |
| AI assistant: whitelisted, permission-aware tools; deterministic parser; optional LLM; no invented numbers | Verified | smoke (tool routing + customer refusal); LLM path untested without key |
| Automations rule builder + execution log | Implemented | seeded rules execute during seed/runner (logged); "Test" button |
| Design system (sidebar, KPI cards, tables w/ search/filters/server cursor pagination, skeletons, empty states, toasts, modals, confirm dialogs, notification center, breadcrumbs, responsive, focus states) | Verified | screenshots desktop + mobile; see UI_AUDIT.md |
| Seed script incl. ~3,000 bulk subscriptions | Tested | integration seeds 300 bulk; `npm run seed:bulk` (local) |
| Firebase Auth email/password in the app | Implemented | client SDK + server ID-token verification; demo accounts auto-provisioned on first login |
| Firestore persistence via firebase-admin | Implemented | requires `FIREBASE_SERVICE_ACCOUNT_JSON` (not provided yet) |

## Known gaps / deliberate deviations
- `quotations` / `quotation_items` / `subscription_items` / `invoice_items` / `plan_items` are not separate collections: quotations are subscriptions in draft/quotation status, and items are embedded arrays (documented in ER_DIAGRAM.md).
- Dunning "retries" send reminders and schedule the next step; they cannot auto-charge because the simulator has no stored payment method.
- MRR trend is reconstructed at current prices (labelled estimate) — no daily MRR snapshots yet.
- No Firestore-emulator rule tests; no browser interaction tests (screenshots only).
- Firebase mode with web config but no service account keeps data in the local store, which is not durable on serverless hosts.
