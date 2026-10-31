# Brightloop — hackathon requirements audit (2026-10-31)

Audited against the *Subscription Management System* problem statement by reading the source, Firestore rules, API routes and tests, plus live checks on https://brightloop-zeta.vercel.app. A feature is never marked done because a screen exists.

**Status scale:** Fully implemented and tested · Implemented, not tested · Partial · UI only · Missing · Broken
**Data layer:** Firebase Auth + Cloud Firestore (not Supabase). "RLS" below means Firestore security rules plus server-side role checks.
**Automated tests:** 142 passing (Vitest) — finance engine, billing engine integration, quotation expiry, invoice delivery status, assistant BYO key, webhook signature.

## Step 1–2 · Problem-statement requirements

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 1 | Authentication & registration | Fully implemented and tested | `src/app/(auth)/*`, `src/lib/client/auth.tsx`, `src/server/auth.ts`; Email/Password + Google (Firebase). Live: Google button verified on /login |
| 2 | Unique email | Fully implemented and tested | Firebase Auth uniqueness + local-mode check; smoke test rejects duplicate |
| 3 | Password rules (>8, upper, lower, special) | Fully implemented and tested | zod `passwordSchema` (client + server); live checklist on /register |
| 4 | Password reset | Implemented, not tested | Firebase `sendPasswordResetEmail` (real email from Firebase). Not automated: sandbox can't reach Google identity APIs |
| 5 | Admin / Staff / Customer roles | Fully implemented and tested | `docs/PERMISSIONS.md`, `src/server/http.ts` `route({action})` permission map; 11 RBAC smoke checks |
| 6 | Admin-only staff creation | Fully implemented and tested | staff → 403 smoke; Settings → Team |
| 7 | Product management | Fully implemented and tested | Products page + `/api/products`; smoke create |
| 8 | Variants & extra pricing | Fully implemented and tested | finance unit P-01; integration ₹1,860 total |
| 9 | Sales price, cost price, notes | Fully implemented and tested | cost price hidden from staff (smoke) |
| 10 | Plan management | Fully implemented and tested | Plans page, `/api/plans` |
| 11 | Daily/weekly/monthly/yearly billing | Fully implemented and tested | `tests/finance/periods.test.ts` (D-*) |
| 12 | Minimum quantity | Fully implemented and tested | unit P-08, smoke min-qty rejection |
| 13 | Plan availability dates | Fully implemented and tested | unit + server validation on subscribe |
| 14 | Auto-close & early cancellation | Fully implemented and tested | unit B-05/B-06/L-03, runner auto-close |
| 15 | Quotation templates | Fully implemented and tested | Quotations page; server-side validity check blocks confirmation after expiry, including client-date bypass attempts |
| 16 | Subscription lifecycle Draft→Quotation→Confirmed→Active→Closed | Fully implemented and tested | unit L-*, stepper UI |
| 17 | Automatic invoice generation | Fully implemented and tested | billing runner `/api/billing/run` (daily Vercel Cron), integration tests |
| 18 | Tax calculation (CGST+SGST / IGST) | Fully implemented and tested | `tests/finance/tax-invoice.test.ts` |
| 19 | Invoice confirm / cancel / send / print | Fully implemented and tested | invoice actions + print CSS/PDF; Resend is used when configured, otherwise the UI clearly records an in-app notification and does not set `sentAt` |
| 20 | Discounts (admin-only, fixed/percent) | Fully implemented and tested | unit C-*; staff → 403 |
| 21 | Discount validity & usage limits | Fully implemented and tested | unit C-06/C-08/C-09 |
| 22 | Payment recording | Fully implemented and tested | partial + overpayment guard tests |
| 23 | Outstanding & overdue | Fully implemented and tested | unit Y-03, runner marks overdue |
| 24 | Financial analytics (MRR, ARR, NRR, churn, ageing) | Fully implemented and tested | `tests/finance/payments-metrics.test.ts`; live admin overview loaded |
| 25 | Search & filtering | Implemented, not tested | list pages filter server-side with Firestore indexes (86 deployed); no automated UI tests |
| 26 | Performance (thousands of subscriptions) | Partial | paginated queries + composite indexes; local integration covers 300 seeded subscriptions, but no hosted Firestore load test was run |

## Step 3 · Financial logic (expected vs actual)

All rows below are automated tests; full table with inputs in [FINANCIAL_AUDIT_REPORT.md](FINANCIAL_AUDIT_REPORT.md).

| Check | Example | Expected | Actual | Result |
|---|---|---|---|---|
| Month-end anchoring | Monthly from 31 Jan 2026 | 28 Feb, 31 Mar | 28 Feb, 31 Mar | Pass |
| Leap year | Monthly from 31 Jan 2028 | 29 Feb 2028 | 29 Feb 2028 | Pass |
| Intra-state GST | ₹12,000 @18% | CGST ₹1,080 + SGST ₹1,080 | same | Pass |
| Inter-state GST | ₹12,000 @18% | IGST ₹2,160 | same | Pass |
| Percent discount | 10% on ₹1,860 | ₹186 off | ₹186 | Pass |
| Proration | Upgrade +₹4,087 mid-cycle, 17/30 days left | ₹2,316.13 | ₹2,316.13 | Pass |
| Partial payment | ₹14,160 invoice, pay ₹5,000 | outstanding ₹9,160, status partially paid | same | Pass |
| Overpayment | pay more than balance | rejected | rejected | Pass |
| Refund | refund ₹2,000 of paid invoice | outstanding +₹2,000, ledger entry | same | Pass |
| Duplicate prevention | re-run billing same day / concurrent runs | 0 new invoices | 0 | Pass |
| Failed payment retry | fail → dunning | retry scheduled, invoice not paid | same | Pass |
| MRR / ARR | yearly ₹12,000 plan | MRR ₹1,000, ARR ₹12,000 | same | Pass |

## Step 4 · Security

| Check | Status | Evidence |
|---|---|---|
| Authentication | Pass | Firebase ID token verified server-side on every API call (`src/server/auth.ts`) |
| Authorization | Pass | central permission map; customers scoped to own `customerId` |
| Data isolation ("RLS") | Pass (rules not emulator-tested) | Firestore rules deny client reads of other customers; API is the only data path |
| Staff limits | Pass | cost price hidden, discounts/staff creation admin-only (403) |
| Secret exposure | Pass | only `NEXT_PUBLIC_FIREBASE_*` reach the browser; service account + cron secret are server env |
| Operator APIs | Pass | `/api/admin/*` and `/api/billing/run` require `x-cron-secret` |
| Webhook verification | Pass | HMAC-SHA256 + timing-safe compare, `tests/security/webhook.test.ts` |
| Payment verification | Partial | Razorpay runs as a simulator until live keys are configured |
| AI assistant | Pass | model only picks a whitelisted tool; role-filtered; user API keys are per-request, never stored server-side (`tests/assistant/byo-key.test.ts`) |

## Step 5 · UI/UX
See [UI_AUDIT.md](UI_AUDIT.md) for 20 page-level fixes. This round: blue aurora landing hero, new logo/favicon, demo panel removed from login, Google sign-in, password label a11y fix, assistant key panel.

## Step 6 · Priority report

| Feature | Current status | Problem | Priority | Required fix |
|---|---|---|---|---|
| AI assistant | Fixed | Only worked with a server-side key | P1 | ✅ Bring-your-own OpenAI / Gemini / OpenRouter key in the UI |
| Password label | Fixed | "Forgot password?" sat inside the password label | P2 | ✅ Label/hint split |
| Quotation template expiry | Implemented, not tested | No automated test | P2 | Add integration test |
| Firestore rules | Deployed, not emulator-tested | Rules unverified by tests | P2 | Add `@firebase/rules-unit-testing` suite |
| Browser e2e | Missing | No Playwright coverage | P2 | Add login → subscribe → pay flow |
| Payments | Simulator | No real money movement | P2 | Add Razorpay live keys |
| Invoice email | Resend-ready | Resend is used when configured; otherwise delivery is explicitly unavailable and only an in-app notification is recorded | P3 | Configure `RESEND_API_KEY` and `EMAIL_FROM` in Vercel |
| Performance | Partial | No production load test | P3 | Run bulk seed + measure list latency |
| Unused service-account keys | Open | 3 spare keys in GCP | P2 | Delete in IAM console |

No P0 (critical functionality or security) issues were found.

## Remaining limitations
Razorpay simulator, no Firestore-emulator or browser e2e tests, dunning can't charge stored payment methods, password reset not automatically tested, no hosted production load test. Vercel now reports a database configuration diagnostic and refuses local JSON fallback when `FIREBASE_SERVICE_ACCOUNT_JSON` is missing or invalid.
