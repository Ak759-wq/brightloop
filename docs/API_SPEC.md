# API specification

All endpoints are JSON. Authenticated requests send `Authorization: Bearer <token>` (Firebase ID token or local token). Errors: `{ "error": string, "fields"?: { [path]: message } }` with 400/401/403/404/409/422/429/500.

## Auth & session
| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/api/me` | any | `{ session, org, modes }` (modes = auth/backend/email/razorpay/llm) |
| POST | `/api/auth/bootstrap` | Firebase user | Creates/claims profile after sign-up/sign-in. New users → customer. |
| POST | `/api/auth/local/register` | public (local mode) | `{ name, email, password, company?, placeOfSupply? }` → `{ token }`; password rule enforced |
| POST | `/api/auth/local/login` | public | `{ email, password }` → `{ token }`; throttled |
| POST | `/api/auth/local/reset-request` · `/reset` | public | Local-mode reset (link logged server-side) |

## Generic resources (catalog & master data)
`/api/r/:collection` — GET list (`?q=&status=&customerId=&planId=&productId=&subscriptionId=&invoiceId=&type=&active=&method=&entity=&cursor=&limit=&orderBy=name&dir=asc`), POST create.
`/api/r/:collection/:id` — GET, PATCH (merged then fully re-validated), DELETE (archives when the doc has `active`/`status`).

Readable: every collection in the permission matrix (customers are auto-scoped to their own `customerId`). Writable: `customers, customer_contacts, products, product_variants, product_addons, plans, quotation_templates, tax_rules, discounts, automation_rules` — per role. List response: `{ items, nextCursor, tookMs }`.

## Subscriptions
| Method | Path | Body |
|---|---|---|
| POST | `/api/subscriptions` | `{ customerId, planId, items:[{productId,variantIds,addonIds,quantity}], discountIds, startDate?, endDate?, paymentTermsDays?, notes?, status: draft|quotation, quoteValidUntil? }` |
| POST | `/api/subscriptions/from-template` | `{ templateId, customerId }` |
| POST | `/api/subscriptions/:id/action` | `{ action: send_quotation|revert_to_draft|confirm|activate|pause|resume|renew|close, reason?, acceptRetentionOffer?, startDate? }` (customers: own subs, limited actions) |
| POST | `/api/subscriptions/:id/change` | `{ planId?, items, discountIds? }` → `{ subscription, proration, prorationInvoiceId }` |
| POST | `/api/subscriptions/:id/invoice` | Create a draft manual invoice |
| POST | `/api/portal/subscribe` | Customer self-service `{ planId, quantity, variantIds, addonIds, code? }` |
| POST | `/api/pricing/preview` | `{ planId, customerId?, items, discountIds }` → priced lines + invoice preview (nothing saved) |

## Invoices & payments
| Method | Path | Body |
|---|---|---|
| POST | `/api/invoices/:id/action` | `{ action: confirm|cancel|send|credit_note, reason?, amount? }` |
| POST | `/api/payments` | `{ invoiceId, method: upi|card|bank_transfer|cash|cheque, amount, date, note?, reference? }` |
| POST | `/api/payments/simulate` | `{ invoiceId, outcome: success|fail|partial, reason?, amount? }` — **Payment Simulator** |
| POST | `/api/payments/:id/refund` | `{ amount, reason }` (admin) |
| POST | `/api/payments/razorpay/webhook` | Razorpay event; `X-Razorpay-Signature` HMAC verified; `payment.captured` with `notes.invoiceId` recorded idempotently |

## Billing, usage, analytics, AI, admin
| Method | Path | Who |
|---|---|---|
| POST | `/api/billing/run` | `x-cron-secret: $CRON_SECRET` (scheduler) or admin session → run summary `{ status, invoicesCreated, duplicates, overdueMarked, dunningReminders, renewalReminders, failed, errors, durationMs }` |
| POST | `/api/usage` | `{ subscriptionId, metric, quantity, idempotencyKey? }` → 402 when blocked by policy |
| POST | `/api/credits/topup` | `{ customerId?, credits, note? }` |
| GET | `/api/analytics?fresh=1` | admin, staff |
| POST | `/api/assistant` | `{ question }` → `{ answer, tool, data, forecast?, engine }` |
| POST | `/api/admin/staff` | admin: `{ name, email, password? }` |
| GET/PATCH | `/api/settings` | GET admin/staff, PATCH admin (company, GST state, dunning, credits policy, retention offer, demo clock) |
| POST | `/api/notifications/read` | `{ ids? }` |
| POST | `/api/automations/test` | admin: `{ ruleId }` fires a synthetic event |
