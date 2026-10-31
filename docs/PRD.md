# Product Requirements — Brightloop 2.0

## Problem
Brightloop Software sells software on subscription. Today subscriptions live in a spreadsheet, renewals are remembered by whoever notices, invoices are typed by hand, payments are matched by scrolling bank statements and revenue reports are built at quarter end. Renewals are missed, invoices go out wrong and nobody knows the real recurring revenue.

## Goal
One platform that runs products → plans → quotations → subscriptions → invoices → payments → revenue reporting, with role-based access and a customer self-service portal.

## Users
| Persona | Needs |
|---|---|
| Admin (finance lead / owner) | Configure products, variants, plans, taxes, discounts, automations, settings; full visibility; add staff. |
| Staff (sales / ops) | Day-to-day customers, quotations, subscriptions, invoices, payments. No tax/discount/settings/audit, no cost prices, cannot add staff. |
| Customer | See and manage only their own subscriptions, invoices, payments and usage without emailing anyone. |

## Mandatory requirements (from the brief) → feature
| Brief | Feature |
|---|---|
| Unique email per account; password > 8 chars with upper, lower, special; reset link to registered email | Register/login (Firebase Auth or local auth), zod password schema client + server, Firebase `sendPasswordResetEmail` |
| Admin controls all, staff limited, customers see only their own; only admin adds staff | Central permission matrix (`src/lib/permissions.ts`) enforced in every API route + Firestore rules |
| Product: name, type, sales price, cost price, notes; variants (Odoo +560) | Products page + variants/add-ons manager; pricing engine adds deltas |
| Plan: price, daily/weekly/monthly/yearly, minimum quantity, available dates; auto-close vs closable/pausable/renewable per plan | Plans page with lifecycle flags; engine validates min qty; runner auto-closes |
| Quotation templates valid N days → subscription | Templates, "Use template", validity date, expiry blocks confirmation |
| Subscription: number, customer, plan, start, expiry, payment terms, lines (product, qty, unit price, taxes, amount); Draft → Quotation → Confirmed → Active → Closed | Subscription model with SUB-000123 sequence, stepper, transitions, version history |
| Billing day: invoices created from subscriptions automatically, taxes from admin rules; confirm/cancel/send/print; Draft → Confirmed → Paid; nothing billed twice or skipped | Recurring billing runner (cron), idempotency key per period, catch-up of missed periods, GST engine, invoice actions, print CSS + PDF |
| Discounts: admin-only, fixed/percent, min purchase/qty, dates, usage limit, product-specific or whole subscription, auto-applied, stops on expiry/exhaustion | Discount engine + transactional redemption counting |
| Payments: method, amount, date, note against invoice; paid vs outstanding; chase overdue | Record payment, partial payments, overdue derivation, dunning, receivables views |
| Finance lead: active subs, revenue, payments, overdue with filters + summary; thousands of subs < 2 s | Overview + Analytics, server-side cursor pagination, 30 s analytics cache, 3,000-subscription bulk seed |

## Beyond the brief
Proration on upgrades/downgrades, credit notes, refunds, account credit, usage events + credit wallet (20% low-balance alert, block/overage), automation rules with execution log, AI assistant with whitelisted tools, audit logs, demo clock, Razorpay adapter stub with real webhook signature verification.

## Non-goals (this build)
Multi-currency conversion, real card vaulting, e-invoicing (IRN) with the GST portal, multi-org self-serve onboarding.

## Success criteria
- Every finance rule unit-tested (108 cases, all passing) with an auditable report.
- Billing re-runs never create duplicates; concurrent runs are locked out.
- Every nav item is a working page; role checks verified by an automated API smoke test (48 checks).
- List pages respond well under 2 s with 3,000+ subscriptions.
