# Data model (Firestore collections)

Every document has `id`, `orgId`, `createdAt`, `updatedAt` (and `_search` tokens where searchable). Money = integer paise. `*_items` tables from a relational design are stored as **embedded arrays** (`subscription.items`, `invoice.items`, `quotation_template.items`) — the Firestore idiom, and it makes each invoice an atomic immutable snapshot. Quotations are subscriptions in `draft`/`quotation` status (Odoo-style), created from `quotation_templates`.

```mermaid
erDiagram
  organizations ||--o{ profiles : has
  organizations ||--o{ customers : bills
  customers ||--o{ customer_contacts : has
  profiles }o--o| customers : "customer login"
  products ||--o{ product_variants : has
  products ||--o{ product_addons : offers
  products }o--o| tax_rules : taxed_by
  plans }o--|| products : primary_product
  quotation_templates }o--|| plans : uses
  customers ||--o{ subscriptions : owns
  plans ||--o{ subscriptions : priced_by
  subscriptions ||--o{ subscription_versions : snapshots
  subscriptions ||--o{ subscription_amendments : changes
  subscriptions }o--o{ discounts : applies
  discounts ||--o{ discount_usages : redeemed
  subscriptions ||--o{ invoices : generates
  invoices ||--o{ payments : settled_by
  invoices ||--o{ payment_attempts : tried
  invoices ||--o{ credit_notes : reduced_by
  payments ||--o{ refunds : refunded_by
  subscriptions ||--o{ usage_events : meters
  customers ||--|| credit_wallets : holds
  credit_wallets ||--o{ credit_transactions : ledger
  subscriptions ||--o| usage_aggregations : open_period
  automation_rules ||--o{ automation_executions : runs
  organizations ||--o{ billing_jobs : runs
  organizations ||--o{ billing_events : emits
  organizations ||--o{ audit_logs : records
  organizations ||--o{ notifications : sends
  organizations ||--o{ counters : sequences

  subscriptions {
    string number "SUB-000123"
    string status "draft|quotation|confirmed|active|paused|closed"
    array items "product, variants, add-ons, qty, unitPrice, amount"
    string startDate
    string endDate "expiry"
    string anchorDate "month-end anchoring"
    string nextBillingDate
    int paymentTermsDays
    int recurringAmount "paise, post-discount pre-tax"
    int version
  }
  invoices {
    string id "subscriptionId__periodStart (idempotency key)"
    string number "INV-2026-000045"
    string status "draft|confirmed|partially_paid|paid|overdue|cancelled"
    array items "frozen price/discount/tax snapshot"
    map totals "subtotal, discount, taxable, cgst, sgst, igst, total"
    int amountPaid
    int amountRefunded
    int creditNoted
    string dueDate
  }
  payments {
    string method
    int amount
    string date
    string note
    int amountRefunded
  }
```

Other collections: `tax_rules` (rateBp, kind GST/NONE, HSN/SAC, isDefault), `discounts` (type, value, scope, productIds, minQuantity, minAmount, start/end, usageLimit, usedCount), `plans` (pricingModel flat/per_seat/tiered/volume, tiers, interval, intervalCount, minQuantity, availability, termPeriods, autoClose/closable/pausable/renewable, public), `billing_jobs_locks` (runner lock), `local_auth` + `password_resets` (local mode only).
