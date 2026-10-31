# Role permission matrix

Source of truth: `src/lib/permissions.ts` (enforced in every route) mirrored by `firestore.rules`. Verified by `scripts/smoke.sh`.

| Area | Admin | Staff | Customer |
|---|---|---|---|
| Customers | CRUD | CRUD | Read own record |
| Customer contacts | CRUD | CRUD | — |
| Products (incl. **cost price**) | CRUD, sees cost | Read, **cost hidden** | Read active catalog, cost hidden |
| Variants / add-ons | CRUD | Read | Read active |
| Pricing plans | CRUD | Read | Read active + public |
| Quotation templates | CRUD | Read / use | — |
| Taxes | CRUD | Read | — |
| Discounts | CRUD | Read / attach to subscriptions | Enter a code at checkout |
| Subscriptions | All lifecycle actions, change plan | All lifecycle actions, change plan | Own: subscribe, accept quotation, pause/resume, renew, upgrade/downgrade, cancel |
| Invoices | Create draft, confirm, cancel, send, credit note | Create draft, confirm, cancel, send | Read own, pay (simulator) |
| Payments | Record, refund | Record | Read own, pay own invoices |
| Billing run | Manual run | — | — (never triggered by visits) |
| Usage & credits | Record usage, grant credits | Record usage, grant credits | Own usage, buy credits (simulator) |
| Automations | CRUD + test | — | — |
| Analytics / overview | Yes | Yes | Own overview only |
| AI assistant | Company tools | Company tools | Own-data tools only |
| Audit logs | Read | — | — |
| Settings (company, GST, policies, demo clock) | Update | — | — |
| Add staff | **Only admin** | — | — |
| Notifications | Staff feed | Staff feed | Own feed |

Financial documents (invoices, payments, refunds, credit notes, attempts, wallets, ledgers, versions) cannot be edited through the generic API at all — only through validated domain actions. Confirmed invoices are immutable; corrections use credit notes.
