# Architecture (in simple words)

```
Browser (Next.js pages, React)                     Scheduler (GitHub Actions, daily)
   │  Firebase Auth (or local auth) → ID token          │  POST /api/billing/run  + x-cron-secret
   ▼                                                    ▼
Next.js route handlers  /api/*  ──  permission check (role matrix) ── zod validation
   │
   ├─ Domain services (src/server/services): subscriptions, invoices, payments, billing runner,
   │   usage/credits, analytics, assistant, automations/events, audit
   │       └─ uses the pure finance engine (src/lib/finance) for every number
   │
   └─ Store interface (src/server/store)
         ├─ FirestoreStore  (firebase-admin)   ← when FIREBASE_SERVICE_ACCOUNT_JSON is set
         └─ FileStore       (local JSON file)  ← dev/demo "Local data mode"
```

## Why it is shaped this way
- **All money logic is one pure library.** `src/lib/finance` has no framework imports, so the same code powers previews in the browser, invoices on the server and the unit tests. Amounts are integers in paise; rounding is half-up per line and per tax component.
- **The server is the only writer of financial data.** Browsers never write invoices or payments directly. Route handlers check the role, validate input with zod, then call a service that runs inside a transaction. Firestore security rules are a second fence for any direct client access.
- **One storage contract, two backends.** Services talk to a small `Store` interface (`get/list/all/create/update/tx/bulkSet`). Firestore implements it with transactions and cursor pagination; the local file store implements the same semantics (serialised transactions, cursor pages) so the app runs with zero setup and tests run fast.
- **Billing is triggered by a scheduler, never by visitors.** `POST /api/billing/run` accepts the cron secret (or an admin session). It acquires a lock document, finds due subscriptions, and for each due period creates the invoice whose **document id is the idempotency key** (`subscriptionId__periodStart`) while advancing `nextBillingDate` in the same transaction. A retry or a parallel run finds the invoice already there and does nothing.
- **Invoices are snapshots.** Lines store unit price, discount, taxable value, tax split and totals at issue time. Later price or tax changes never touch old invoices; corrections use credit notes.
- **Time.** Business dates are calendar strings (`YYYY-MM-DD`) in Asia/Kolkata. Demo organisations may set a *demo clock* that changes only the business date used for billing; real `createdAt/updatedAt` timestamps always use the real clock, and the UI shows a badge.

## Auth
- Firebase mode: the client signs in with Firebase Auth; the server verifies the ID token with firebase-admin (needs only the project id) and loads the user's **profile** (role, org, customerId). New sign-ups always get the `customer` role; staff roles come only from an admin (direct creation with a service account, or a claimable invite).
- Local mode: scrypt-hashed passwords and HMAC-signed tokens, with a basic login throttle.

## Key flows
1. **Quote → subscription:** template → `quotation` (valid N days) → `confirmed` → `active` (first invoice now) → paused/renewed → `closed`. Every step writes a version snapshot and an audit log.
2. **Billing run:** lock → due subs → per-period idempotent invoice (discounts redeemed atomically, account credit auto-applied, usage overage billed) → overdue marking → dunning reminders → renewal reminders → job record.
3. **Payment:** validate against outstanding in a transaction → payment + attempt docs → derived status (paid > overdue > partially paid > confirmed) → notifications/automations.
4. **Failure:** simulator "fail" → failed attempt, retry date from the dunning schedule, customer + staff notified; after the last retry the subscription is flagged past due and the customer can be auto-tagged *at-risk*.

## Performance
Lists use server-side cursor pagination with prefix search tokens (`_search` array-contains) and composite indexes (`firestore.indexes.json`). Analytics aggregates once and caches for 30 s per org. Local tests: list ≈ 30–60 ms, analytics over 3,300 subscriptions well under 1 s.
