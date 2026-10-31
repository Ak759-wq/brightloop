# Brightloop 2.0 — Subscription management, recurring billing & revenue intelligence

One platform that runs the whole life of a subscription business: products and plans → quotations → subscriptions → automatic GST invoices → payments and dunning → revenue analytics. Built for the "Subscription Management System" hackathon brief.

- **Admin** sets up products, variants, plans, taxes, discounts, automations and settings.
- **Staff** handle customers, quotations, subscriptions, invoices and payments with limited access.
- **Customers** use a self-service portal to subscribe, upgrade, pause, cancel, pay and track usage.

> Money is stored as integer **paise**. Every financial rule lives in a framework-free engine (`src/lib/finance`) with **108 audited unit tests** plus integration and API smoke tests. See [docs/FINANCIAL_AUDIT_REPORT.md](docs/FINANCIAL_AUDIT_REPORT.md).

## Stack

Next.js 14 (App Router) · TypeScript (strict) · Tailwind CSS with in-house components · Recharts · lucide-react · Firebase Auth (client SDK) · Firestore via firebase-admin in route handlers · zod · jsPDF · Vitest · Playwright (screenshots).

## Quick start

```bash
npm install
cp .env.example .env.local      # fill in what you have (see below)
npm run dev                     # http://localhost:3000
```

With no service account, the server uses a **local JSON store** (`.data/`) that seeds itself on the first request (~9 months of simulated billing history), and the UI shows a **"Local data mode"** badge. Delete `.data/` to re-seed.

Demo accounts (seeded):

| Role | Email | Password |
|---|---|---|
| Admin | admin@brightloop.demo | Admin@12345 |
| Staff | staff@brightloop.demo | Staff@12345 |
| Customer | customer@brightloop.demo | Customer@123 |

The login page has one-click buttons for each. With Firebase Auth configured, the demo users are created in Firebase Auth on first use and linked to their seeded (claimable) profiles.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY`, `_AUTH_DOMAIN`, `_PROJECT_ID`, `_STORAGE_BUCKET`, `_MESSAGING_SENDER_ID`, `_APP_ID` | For Firebase Auth | Public web config. When empty, built-in **local auth** (scrypt hashes, signed tokens) is used. |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | For Firestore | Service-account JSON on one line. Enables Firestore persistence, admin staff creation and the Firestore seed. Without it data lives in the local JSON store (not durable on serverless). |
| `CRON_SECRET` | Yes (production) | Shared secret: sent by Vercel Cron as `Authorization: Bearer …` or by GitHub Actions as `x-cron-secret`; also protects `POST /api/admin/seed`. |
| `LOCAL_AUTH_SECRET` | Local auth only | Signs local session tokens. |
| `LOCAL_DATA_DIR` | Optional | Local store directory (default `.data`, `/tmp/brightloop` on Vercel). |
| `OPENAI_API_KEY` / `OPENAI_MODEL` / `GEMINI_API_KEY` | Optional | Lets an LLM *choose* the assistant's whitelisted tool. Numbers always come from tools. |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET` | Optional | Razorpay adapter (orders + verified webhooks). Until set, the labelled **Payment Simulator** is used. |
| `RESEND_API_KEY` / `EMAIL_FROM` | Optional | Real invoice emails. Without it, "Send" is logged as a customer notification and labelled as such. |

**Important:** in Firebase mode, Firestore *data* requires `FIREBASE_SERVICE_ACCOUNT_JSON`. With only the web config, sign-in uses Firebase Auth (ID tokens verified server-side with the project id) while data stays in the local store.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` · `npm run typecheck` | ESLint · `tsc --noEmit` |
| `npm test` | Vitest: finance engine + integration tests |
| `npm run test:audit` | Tests + regenerate `docs/FINANCIAL_AUDIT_REPORT.md` |
| `npm run seed` | Seed demo data (Firestore if a service account is set, else local store) |
| `npm run seed:bulk` | Same + ~3,000 subscriptions for performance checks (`tsx scripts/seed.ts --bulk-only 3000` adds bulk only) |
| `bash scripts/smoke.sh` | 48 end-to-end API checks against a running server (local auth) |
| `node scripts/screens.mjs out/` | Playwright screenshots of every page |

## Deploying Firebase rules & indexes

`firebase.json` and `.firebaserc` (project `brightloop-8bc2c`) point at `firestore.rules` and `firestore.indexes.json`:

```bash
npx firebase-tools deploy --only firestore:rules,firestore:indexes
```

## Deploy to Vercel (recommended)

Required environment variables — nothing else is needed:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`, `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase console → Project settings → Your apps (web) |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Firebase console → Project settings → Service accounts → *Generate new private key*; paste the whole JSON as the value (single line is fine; `\n` in `private_key` is handled) |
| `CRON_SECRET` | A long random string (`openssl rand -hex 32`) |

Steps:

1. **Firebase**: enable *Authentication → Email/Password*; create Firestore (production mode). Deploy rules and indexes once from any machine with the Firebase CLI: `npx firebase-tools login && npx firebase-tools deploy --only firestore:rules,firestore:indexes` (project `brightloop-8bc2c` from `.firebaserc`). Indexes take a few minutes to build.
2. **Vercel**: *Add New → Project* → import the GitHub repo. Framework preset Next.js (auto). Add the env vars above for **Production** (and Preview if you use it). Deploy.
3. **Seed the demo data into Firestore** (the service-account key only lives in Vercel, so seeding runs there):
   ```bash
   curl -X POST "https://<your-app>.vercel.app/api/admin/seed" -H "x-cron-secret: $CRON_SECRET"
   # optional performance data, once:  .../api/admin/seed?bulk=3000
   ```
   It creates the demo org, the three demo users **in Firebase Auth** (admin/staff/customer, passwords above) with their profiles, the catalog, customers and ~9 months of simulated billing history (simulated in memory, then copied with batched writes — a few seconds). It is **idempotent**: if the demo org already exists it returns `{"seeded": false}` and changes nothing.
4. **Scheduled billing**: `vercel.json` registers a **Vercel Cron** that calls `GET /api/billing/run` daily at 00:30 UTC (06:00 IST); Vercel sends `Authorization: Bearer $CRON_SECRET`, which the route verifies. (Hobby plan allows daily crons.) The GitHub Actions workflow `billing-cron.yml` is an alternative — keep only one scheduler enabled, although running both is safe because billing is idempotent and locked.
5. Open the app, sign in with a demo account, and follow the walkthrough below. Run billing on demand from *Overview → Run billing now* (admin).

Notes: functions run in `bom1` (Mumbai, close to Firestore `asia-south1`) per `vercel.json`. If `FIREBASE_SERVICE_ACCOUNT_JSON` is missing, the app still boots but stores data in the function's `/tmp` (labelled *Local data mode*, not durable) — set the key for real use.

## Scheduled billing

On Vercel, `vercel.json` schedules `GET /api/billing/run` daily (Bearer `CRON_SECRET`). Alternatively `.github/workflows/billing-cron.yml` calls `POST /api/billing/run` daily at 06:00 IST with `x-cron-secret` (repository secrets `APP_URL`, `CRON_SECRET`), retrying up to 3 times. The runner takes a lock, bills every due period with an idempotency key (`subscriptionId__periodStart` is the invoice document id), advances the next billing date in the same transaction, marks overdue invoices, schedules dunning reminders and sends renewal reminders. Admins can also click **Run billing now**. `ci.yml` runs lint, typecheck, tests (+ audit report) and build on every push.

## 15-step demo walkthrough

1. **Register** a new customer at `/register` — try a weak password to see client *and* server validation (more than 8 chars, upper, lower, special); try `admin@brightloop.demo` to see the unique-email check. **Forgot password** sends a Firebase reset email (local mode logs the link server-side).
2. Sign in as **Admin**. The **Overview** shows MRR/ARR, active subscriptions, collections vs last month, overdue, a revenue chart, MRR by plan, and a computed insight.
3. **Products** → open *Brightloop CRM* → **Variants**: Brand = Odoo adds ₹560; add-on *Premium support* ₹300. Staff never see cost price (log in as staff to confirm).
4. **Pricing Plans** → create a plan: price, daily/weekly/monthly/yearly, minimum quantity, availability dates, auto-close / closable / pausable / renewable; tiered and volume plans get a tier editor.
5. **Taxes**: GST 18% default. Seller state (Settings) = Karnataka → Karnataka customers get CGST 9% + SGST 9%, others IGST 18%. A customer without a place of supply can't be invoiced (never guessed).
6. **Discounts**: create a 10% rule with a minimum quantity, dates and a usage limit; product-specific or whole-subscription.
7. **Quotations → Templates → Use template** (*CRM Enterprise Starter*, valid 30 days) for a customer → a numbered quotation (`SUB-0000xx`).
8. **Subscriptions → New**: pick *CRM Monthly*, Brightloop CRM ×5, Brand Odoo + Premium support → live preview shows **₹1,860/seat**, discount and GST split. Save as quotation.
9. On the subscription: **Confirm → Activate & bill**. The lifecycle stepper moves Draft → Quotation → Confirmed → Active and the **first invoice is generated** immediately.
10. **Invoices** → open it: preview, **Print** (print CSS), **PDF**, **Send** (logged notification without an email provider), **Record payment** (method, amount, date, note) — pay part to see *Partially paid*; overpayment is refused.
11. **Payment simulator** → *Fail with reason* → attempt logged, customer + staff notified, retry scheduled; the invoice is never marked paid. Then *Success* → Paid.
12. **Change plan / lines** mid-cycle → day-based proration estimate; upgrades raise a proration invoice, downgrades credit the account (auto-applied to the next invoice). Version history and amendments are recorded.
13. **Settings → Demo clock**: set the business date a month ahead, then **Automations → Run billing now** → new invoices, overdue marking, dunning and renewal reminders appear; re-running creates **0 duplicates**. Clear the clock afterwards.
14. Sign in as **Customer**: Overview, **Explore Plans** (subscribe with code `WELCOME10`), **My Subscriptions** (pause/resume/upgrade, cancel with optional retention offer that never blocks), **Invoices → Pay**, **Usage & Credits** (simulate usage, 20% low-balance alert, overage policy), **Notifications**.
15. Back as Admin: **Analytics** (revenue trend, MRR trend + labelled forecast, revenue bridge, receivables ageing, definitions), **AI Assistant** ("Which invoices are overdue?", "revenue collected last month"), **Audit Logs** with before/after values.

## Documentation

- [PRD](docs/PRD.md) · [Architecture](docs/ARCHITECTURE.md) · [ER diagram](docs/ER_DIAGRAM.md) · [Permissions](docs/PERMISSIONS.md) · [API spec](docs/API_SPEC.md) · [UI page map](docs/UI_PAGE_MAP.md)
- [Finance rules](docs/FINANCE_RULES.md) · [Metrics](docs/METRICS.md) · [Financial audit report](docs/FINANCIAL_AUDIT_REPORT.md)
- [Testing strategy](docs/TESTING_STRATEGY.md) · [Requirements checklist](docs/REQUIREMENTS_CHECKLIST.md) · [UI audit](docs/UI_AUDIT.md) · [Roadmap](docs/ROADMAP.md)
