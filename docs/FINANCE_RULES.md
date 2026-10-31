# Finance rules

Engine: `src/lib/finance` (pure TypeScript, no framework). Tests: `tests/finance` → [FINANCIAL_AUDIT_REPORT.md](FINANCIAL_AUDIT_REPORT.md).

## Money & rounding
- Integer **paise** everywhere; percentages in **basis points** (18% = 1800).
- Fractions are rounded **half-up (away from zero)** at the **line level**, separately for each tax component (CGST, SGST, IGST). Invoice totals are sums of rounded lines, so totals always reconcile.
- Splitting an amount (e.g. a subscription-wide discount across lines) uses the **largest-remainder** method; parts always sum to the whole.

## Pricing
- Unit price = base (plan price for the plan's product, else product sales price) + variant deltas + per-unit add-ons. Example: ₹1,000 + Odoo ₹560 + Premium support ₹300 = **₹1,860**.
- Models: **flat** (fixed price), **per seat** (unit × qty), **tiered** (graduated; each unit priced in its tier), **volume** (all units at the tier the total reaches). Last tier must be unbounded.
- Quantity must be a whole number ≥ the plan's minimum quantity (rejected otherwise).

## Billing periods
- Calendar dates (`YYYY-MM-DD`), periods are half-open `[start, nextStart)`.
- Every period is computed from the **anchor date**, never from the previous period: Jan 31 → Feb 28 (29 in leap years) → Mar 31 → Apr 30. Yearly Feb 29 → Feb 28 → … → Feb 29.
- Daily / weekly / monthly / yearly, with an interval count (3 × monthly = quarterly).

## Discounts (applied before tax)
Fixed or percent; scope whole subscription or specific products; minimum quantity / minimum amount; start/end dates; usage limit. A fixed discount never exceeds the eligible base. A redemption is counted once per subscription (inside the invoice transaction); renewals of an already-redeemed subscription keep the discount, while new redemptions stop when the limit is reached. Expired discounts stop applying automatically.

## GST
- Supply type comes **only from configuration**: seller state (Settings) vs the customer's configured place of supply. Missing either → error, never a guess.
- Intra-state: CGST = SGST = rate/2. Inter-state: IGST = rate. Rules with kind NONE or 0% → no tax.

## Invoices
Snapshot of every line (unit price, discount, taxable value, tax split, total) and totals at issue time. Old invoices are never recomputed. Status: `draft` and `cancelled` are explicit; otherwise derived with precedence **paid > overdue > partially paid > confirmed**. Overdue = business date after the due date with an outstanding balance.

Outstanding = total − credit notes − (paid − refunded).

## Payments, refunds, credit notes
- A payment must be > 0 and ≤ outstanding, on a confirmed (non-cancelled) invoice. Lump sums allocate oldest-due first; leftovers are unapplied credit.
- Refund ≤ amount paid − already refunded; it re-opens the balance.
- Credit note ≤ total − existing credit notes. Downgrade credits sit in the customer's account balance and are applied automatically to the next invoice (recorded as a credit note).
- An invoice with payments cannot be cancelled (refund or credit-note it instead).

## Proration (upgrade/downgrade mid-cycle)
Day-based: credit = old × remaining/total, charge = new × remaining/total (each rounded), net = charge − credit. Net > 0 → immediate proration invoice; net < 0 → account credit. Changing billing frequency mid-cycle is refused.

## Dunning
Failed attempt → retry reminders after the configured days (default 1, 3, 7 days after each failure). After the last one the invoice is marked exhausted, the subscription flagged past due, staff alerted, and automations may tag the customer. A failure never marks anything paid.

## Credits & usage
Integer credits; append-only ledger. Low-balance alert when the balance crosses ≤ 20% (configurable) of the last top-up. Policy **block** rejects usage beyond the balance (HTTP 402); **overage** allows it and bills overage units × the overage price on the next invoice. Usage events are idempotent by key.

## Recurring billing runner
Lock → for each active subscription with `nextBillingDate ≤ today`: bill every missed period (max 12 per run) with invoice id `subscriptionId__periodStart`, advancing `nextBillingDate` in the same transaction → nothing billed twice, nothing skipped. Periods starting after the expiry date are not billed; auto-close plans close at end of term. Then overdue marking, dunning reminders, renewal reminders (7 days), job log.
