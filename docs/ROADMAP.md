# Roadmap

## Now (this build)
Finance engine + audit, catalog, plans, quotations, subscriptions with lifecycle/proration, GST invoices with PDF/print, payments + simulator + dunning, refunds/credit notes, usage & credits, automations, analytics, AI assistant, audit logs, customer portal, scheduled billing, local + Firestore backends.

## Next (1–2 weeks)
1. Provision the Firebase service account; run `npm run seed:bulk` against Firestore; deploy rules + indexes; run the Firestore emulator rule tests.
2. Razorpay live: hosted checkout from the invoice page, subscription mandates (UPI AutoPay / e-mandate) so dunning retries actually charge.
3. Transactional email (Resend) with invoice PDF attachment and branded templates.
4. Persisted MRR snapshots (daily) to replace the reconstructed MRR trend and make NRR/GRR exact.
5. Playwright interaction tests for the 15-step demo.

## Later
GST e-invoicing (IRN/QR) and GSTR exports · multi-currency with FX snapshot per invoice · multi-organisation onboarding · customer self-service for billing details with approval · coupons with per-customer limits · revenue recognition schedules (deferred revenue) · webhooks/outbound API · SSO for staff.
