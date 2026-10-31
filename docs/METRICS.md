# Metric definitions

| Metric | Definition | Labelled as |
|---|---|---|
| MRR | Sum over **active** subscriptions of the recurring amount (pre-tax, after discounts) normalised to a month: yearly ÷ 12, weekly × 52 ÷ 12, daily × 365 ÷ 12, ÷ interval count. Paused excluded. | Actual |
| ARR | MRR × 12 | Actual |
| ARPC | MRR ÷ customers with ≥ 1 active subscription | Actual |
| Collected | Payments dated in the period minus refunds (cash basis) | Actual |
| Invoiced | Totals of non-draft, non-cancelled invoices by invoice date (accrual) | Actual |
| Outstanding / overdue | Outstanding balance of confirmed invoices; overdue when past due date | Actual |
| Receivables ageing | Outstanding by days past due: current, 1–30, 31–60, 61–90, 90+ | Actual |
| Churn (30 days) | Subscriptions closed in the last 30 business days and their MRR | Actual |
| Customer churn rate, GRR, NRR | Engine `mrrBridge()` on two MRR snapshots: GRR = (start − contraction − churn) ÷ start (≤ 100%); NRR = (start + expansion − contraction − churn) ÷ start | Actual when snapshots exist |
| Revenue bridge (UI) | Start (derived) → new (started in 30 days) + expansion − contraction (amendments in 30 days) − churn → today | **Estimate** |
| MRR trend | Reconstructed from start/close dates at **current** prices | **Estimate** |
| MRR forecast | Current MRR × (1 + average monthly growth of the last 4 months) | **Forecast** |
| Payment success rate | Succeeded ÷ (succeeded + failed) attempts; pending dunning reminders excluded | Actual |
