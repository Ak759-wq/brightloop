# UI page map

Layout: dark navy sidebar + light workspace, sticky top bar (breadcrumbs, mode badges, AI ask box, notification center, user menu). Mobile: off-canvas sidebar.

## Public
- `/login` (backward-compatible legacy login) · `/customer/login` (customer login) · `/team/login` (admin/staff login) · `/register` (customer registration) · `/forgot-password` · `/reset-password` (local mode)

## Admin / staff workspace (`/app`) — staff see the starred items only
| Page | Contents |
|---|---|
| ★ Overview | KPI cards (MRR/ARR, active subs, collected vs last month, overdue), revenue chart, insight card, MRR-by-plan donut, latest invoices, needs-attention list, Run billing (admin) |
| ★ Customers / `[id]` | Search, filters, create/edit, GST place of supply; detail with subscriptions, invoices, contacts, balances |
| Products | CRUD, cost price & margin (admin), tax rule, variants & add-ons manager |
| Pricing Plans | CRUD with pricing model, interval, min qty, availability, term, lifecycle flags, tier editor |
| ★ Subscriptions / new / `[id]` | Status tabs, search, plan filter, cursor pagination; creation with live price preview; detail with lifecycle stepper, actions, change-plan proration modal, cancel with retention offer, invoices, version history |
| ★ Quotations | Open quotations, templates (use / create / edit), validity |
| ★ Invoices / `[id]` | KPI strip, status tabs; detail: invoice document, confirm/send/print/PDF, record payment, simulator, credit note, cancel, payments, attempts |
| ★ Payments | Payments, failed attempts, refunds; record payment against an outstanding invoice |
| Discounts | CRUD with live status (active / scheduled / expired / used up) |
| Taxes | CRUD, GST split explanation |
| Usage & Credits | Wallets, usage events, ledger; record usage, grant credits |
| Automations | Rules (trigger → action, test), execution log, billing jobs, billing events, Run billing |
| Analytics | KPIs, revenue trend, MRR trend + forecast, revenue bridge, receivables ageing, top products, status counts, metric definitions |
| AI Assistant | Chat with suggested questions and source tool per answer |
| Audit Logs | Search/filter, before/after diff modal |
| Settings | Company & GST, billing policies, demo clock, team (add staff) |

## Customer portal (`/portal`)
Overview · Explore Plans (subscribe modal with live price) · My Subscriptions / `[id]` · Invoices / `[id]` (Pay) · Payments · Usage & Credits · Notifications · Account Settings
