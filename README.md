# Brightloop 2.0
## Subscription Management, Recurring Billing & Revenue Intelligence

**One platform to manage the complete subscription lifecycle — from products and pricing to recurring billing, payments and revenue analytics.**

Brightloop is a subscription management platform built to simplify how businesses manage customers, products, pricing plans, quotations, subscriptions, invoices and recurring revenue.

Instead of depending on disconnected spreadsheets and manual    billing workflows, Brightloop brings business operations, financial management and customer self-service into one unified platform.

**Live Application:** https://brightloop-zeta.vercel.app/

**Source Code:** https://github.com/Ak759-wq/brightloop

---

## The Problem

Subscription-based businesses frequently struggle with fragmented workflows:

- Customer and subscription information is scattered across spreadsheets.
- Renewals depend on manual tracking.
- Invoices are generated and managed manually.
- Payments and outstanding balances are difficult to reconcile.
- GST calculations introduce additional complexity.
- Revenue visibility is delayed and difficult to.    maintain.
- Customers depend on business staff for basic subscription information.

These problems lead to missed renewals, billing errors, delayed collections and poor financial visibility.

## Our Solution

Brightloop brings the entire subscription business lifecycle into one platform:

**Products → Pricing Plans → Quotations → Subscriptions → Invoices → Payments → Revenue Analytics**

It provides dedicated experiences for administrators, staff and customers, supported by centralized business logic, automated billing and role-based access control.

---

## Core Features

### 1. Role-Based Workspace

Brightloop supports three distinct user roles.

| Role | Capabilities |
|---|---|
| Admin | Complete business management, configuration, staff management and financial visibility. |
| Staff | Manage customers, quotations, subscriptions, invoices and payments with restricted permissions. |
| Customer | Explore plans, manage subscriptions, view invoices, track payments and monitor usage. |

Permissions are enforced through backend authorization rather than relying only on frontend visibility.

### 2. Product and Pricing Management

- Create and manage products.
- Configure product variants and add-ons.
- Maintain sales prices and cost prices.
- Create flexible pricing plans.
- Support daily, weekly, monthly and yearly billing.
- Configure minimum quantities and plan availability.
- Support tiered and volume-based pricing.
- Configure subscription lifecycle rules.

### 3. Quotation Management

- Create customer quotations.
- Configure reusable quotation templates.
- Set quotation validity periods.
- Track quotation status.
- Convert quotations into subscriptions.
- Prevent confirmation of expired quotations.

### 4. Subscription Lifecycle Management

Manage subscriptions throughout their lifecycle:

`Draft → Quotation → Confirmed → Active → Closed`

Capabilities include:

- Create and activate subscriptions.
- Manage subscription lines and quantities.
- Track start and expiry dates.
- Configure renewal and cancellation behavior.
- Pause and resume eligible subscriptions.
- Upgrade and downgrade plans.
- Calculate mid-cycle proration.
- Maintain subscription amendment history.

### 5. Automated Recurring Billing

Brightloop automates recurring billing workflows.

- Generate invoices from active subscriptions.
- Process due billing periods.
- Handle missed billing periods.
- Prevent duplicate invoice generation.
- Advance subscription billing dates.
- Detect overdue invoices.
- Schedule dunning and renewal reminders.
- Support scheduled and administrator-triggered billing runs.

Billing operations use idempotency controls to prevent duplicate invoices when a billing job is repeated.

### 6. GST and Financial Engine

Built with Indian GST requirements in mind.

- CGST and SGST for intra-state transactions.
- IGST for inter-state transactions.
- Configurable seller location and place of supply.
- Fixed and percentage-based discounts.
- Discount validity periods and usage limits.
- Subscription proration calculations.
- Partial payment calculations.
- Refund and account-credit handling.
- Month-end and leap-year billing calculations.

**Financial precision:** Monetary values are represented internally as integer paise to avoid floating-point errors in financial calculations.

### 7. Invoice Management

- Automatic invoice generation.
- Invoice numbering and status tracking.
- Invoice confirmation and cancellation.
- Print-friendly invoice layouts.
- PDF invoice downloads.
- Partial payment recording.
- Outstanding balance tracking.
- Paid, unpaid, partially paid and overdue statuses.

Invoice email delivery can be connected through Resend. Without an email provider, sending is recorded as an in-app notification rather than an actual email.

When Resend is unavailable or returns an error, Brightloop labels the notification as unavailable and does not mark the invoice as emailed. Set `RESEND_API_KEY` and `EMAIL_FROM` only in the server/Vercel environment; keys are never sent to the browser.

### 8. Payment Management

- Record payments against invoices.
- Track payment methods, references and amounts.
- Support partial payments.
- Prevent overpayment.
- Track failed payment attempts.
- Record refunds.
- Maintain payment history.

**Payment integration status:** Brightloop includes a Payment Simulator and a Razorpay adapter with webhook signature verification. The simulator does not process real money. Live Razorpay transactions require production credentials and configuration.

### Production data configuration

Hosted deployments require `FIREBASE_SERVICE_ACCOUNT_JSON` and a matching `NEXT_PUBLIC_FIREBASE_PROJECT_ID`. If the service account is missing, invalid or belongs to another Firebase project, the API returns a diagnostic and does not silently use the ephemeral local JSON store. Local development may still use the local store when Vercel is not set.

### 9. Customer Self-Service Portal

Customers can independently manage their subscription relationship.

- View a personalized dashboard.
- Explore available pricing plans.
- Subscribe to eligible plans.
- View active and previous subscriptions.
- Upgrade, pause, resume or cancel eligible subscriptions.
- Access invoices and download PDFs.
- View payment history.
- Monitor usage and credits.
- Receive notifications.

Customer data access is restricted to the authenticated customer's own records.

### 10. Revenue Intelligence and Analytics

Get a consolidated view of subscription business performance.

- Monthly Recurring Revenue (MRR).
- Annual Recurring Revenue (ARR).
- Active subscriptions.
- Revenue collected.
- Overdue invoices.
- Receivables ageing.
- Revenue trends.
- MRR by pricing plan.
- Churn and retention metrics.
- Revenue forecasting and business insights.

### 11. AI-Powered Business Assistant

Brightloop includes a natural-language assistant for querying business and financial information.

Example questions:

- Which invoices are overdue?
- How much revenue was collected last month?
- Which subscriptions are approaching renewal?
- What is our current recurring revenue?

Supported AI providers:

- OpenAI
- Google Gemini
- OpenRouter

Users can configure their own API key and optionally select a model.

The AI model selects from whitelisted, permission-checked tools. Business figures are retrieved from the application's data rather than generated as unsupported estimates.

Without an AI API key, a deterministic intent parser provides basic assistant functionality.

### 12. Automation, Audit Logs and Notifications

- Scheduled billing jobs.
- Overdue invoice detection.
- Dunning reminders.
- Subscription renewal reminders.
- Automation rules and execution logs.
- Before-and-after audit records.
- Customer and staff notifications.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 App Router |
| Language | TypeScript |
| Styling | Tailwind CSS |
| UI Components | Custom components |
| Charts | Recharts |
| Icons | Lucide React |
| Authentication | Firebase Authentication |
| Database | Cloud Firestore |
| Backend | Next.js API Routes |
| Validation | Zod |
| PDF Generation | jsPDF |
| Financial Testing | Vitest |
| Browser Automation | Playwright |
| Deployment | Vercel |
| AI Integrations | OpenAI, Gemini, OpenRouter |

---

## System Architecture

```text
                    BRIGHTLOOP 2.0
                           |
             +-------------+-------------+
             |             |             |
          Admin          Staff        Customer
          Portal         Portal        Portal
             |             |             |
             +-------------+-------------+
                           |
                 Authentication & RBAC
                           |
                    Backend API Layer
                           |
        +------------------+------------------+
        |                  |                  |
   Product & Pricing   Subscription       Customer
     Management        Management        Management
        |                  |                  |
        +------------------+------------------+
                           |
                   Financial Engine
                           |
       +-------------------+-------------------+
       |                   |                   |
   GST & Tax          Invoice & Billing     Payments
 Calculations           Automation        Management
       |                   |                   |
       +-------------------+-------------------+
                           |
                    Firestore Database
                           |
                 Analytics & AI Assistant
```

---

## Financial Accuracy and Testing

Brightloop uses a framework-independent financial engine located at:

`src/lib/finance`

The repository's audit documentation reports **132 passing automated tests** covering:

- Financial calculations.
- Billing engine integration.
- GST and invoice calculations.
- Discounts and proration.
- Partial payments and refunds.
- MRR and ARR calculations.
- Duplicate invoice prevention.
- AI assistant functionality.
- Webhook signature verification.

The project also includes API smoke tests for important backend workflows.

See the [Financial Audit Report](docs/FINANCIAL_AUDIT_REPORT.md) and [Hackathon Audit](docs/HACKATHON_AUDIT.md).

Test counts and audit results refer to the documented audit. Run the current test suite to verify the latest repository state.

---

## Hackathon Problem Statement Coverage

| Requirement | Brightloop Implementation |
|---|---|
| User authentication | Firebase Authentication and local authentication fallback |
| Unique email accounts | Authentication-level uniqueness validation |
| Password validation | Client-side and server-side password validation |
| Role-based permissions | Admin, Staff and Customer access control |
| Staff management | Admin-controlled staff creation |
| Product management | Products, variants, sales prices and cost prices |
| Pricing plans | Flexible billing cycles and pricing configurations |
| Quotations | Templates, validity and expiry |
| Subscription lifecycle | Draft, Quotation, Confirmed, Active and Closed |
| Recurring billing | Scheduled invoice generation |
| GST calculations | CGST, SGST and IGST |
| Discounts | Fixed and percentage-based discounts with usage limits |
| Payments | Payment recording, partial payments and refunds |
| Overdue management | Outstanding balances and dunning reminders |
| Revenue analytics | MRR, ARR, churn and receivables |
| Customer portal | Subscription and invoice self-service |
| Performance | Pagination and indexed database queries |

**Performance note:** Pagination and database indexes are implemented, but production load testing at thousands of subscriptions has not yet been completed.

---

## Getting Started

### Prerequisites

- Node.js
- npm
- Git
- A Firebase project for Firebase authentication and Firestore persistence

### 1. Clone the repository

```bash
git clone https://github.com/Ak759-wq/brightloop.git

cd brightloop
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create your environment file:

```bash
cp .env.example .env.local
```

Configure the required Firebase and application settings.

### 4. Start the development server

```bash
npm run dev
```

Open:

`http://localhost:3000`

Without a Firebase service account, the application can use its local JSON storage fallback for development. This storage is not durable on serverless deployments.

---

## Environment Variables

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase web API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase authentication domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase application ID |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Server-side Firestore persistence |
| `CRON_SECRET` | Protects scheduled billing and seed endpoints |
| `LOCAL_AUTH_SECRET` | Signs local authentication sessions |
| `LOCAL_DATA_DIR` | Optional local storage directory |
| `OPENAI_API_KEY` | Optional OpenAI assistant integration |
| `OPENAI_MODEL` | Optional OpenAI model |
| `GEMINI_API_KEY` | Optional Gemini integration |
| `RAZORPAY_KEY_ID` | Optional Razorpay integration |
| `RAZORPAY_KEY_SECRET` | Optional Razorpay integration |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay webhook verification |
| `RESEND_API_KEY` | Optional email delivery |
| `EMAIL_FROM` | Email sender address |

Never commit `.env.local`, private keys, service-account credentials or API secrets to GitHub.

Google sign-in requires the Google provider to be enabled in Firebase Authentication and the deployed domain to be included in Firebase's authorized domains.

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Build the production application |
| `npm run start` | Start the production server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript checks |
| `npm test` | Run automated tests |
| `npm run test:audit` | Run tests and regenerate the financial audit report |
| `npm run seed` | Seed demo data |
| `npm run seed:bulk` | Seed additional performance data |
| `bash scripts/smoke.sh` | Run API smoke tests |
| `node scripts/screens.mjs out/` | Generate Playwright page screenshots |

---

## Scheduled Billing

Brightloop supports automated recurring billing through scheduled jobs.

The Vercel Cron configuration runs the billing endpoint daily at 00:30 UTC (06:00 IST).

The billing runner:

1. Identifies subscriptions due for billing.
2. Generates invoices for the applicable billing periods.
3. Prevents duplicate invoices.
4. Advances subscription billing dates.
5. Identifies overdue invoices.
6. Schedules dunning and renewal reminders.

An administrator can also trigger billing manually from the Overview dashboard.

The billing endpoint is protected using `CRON_SECRET`.

---

## Deployment

Brightloop is deployed on Vercel.

**Production URL:** https://brightloop-zeta.vercel.app/

Production deployment requires:

1. Firebase Authentication configuration.
2. Firestore database configuration.
3. Firestore security rules and indexes.
4. Vercel environment variables.
5. Firebase service-account configuration for durable Firestore access.
6. A secure cron secret.
7. Verification of authentication and billing workflows.

The repository includes `firebase.json`, `firestore.rules`, `firestore.indexes.json` and `vercel.json` for deployment configuration.

---

## Suggested Hackathon Demo Flow

A complete demonstration of Brightloop can follow this sequence:

1. Register a new customer.
2. Sign in to the Admin Portal.
3. Create a product and configure its variants.
4. Create a pricing plan.
5. Configure GST and discounts.
6. Generate a quotation for a customer.
7. Convert the quotation into a subscription.
8. Activate the subscription and generate an invoice.
9. Demonstrate partial payment recording.
10. Demonstrate failed and successful simulated payment attempts.
11. Run recurring billing automation.
12. Sign in to the Customer Portal.
13. Explore plans and manage a subscription.
14. View invoices, payments and usage.
15. Return to Admin and explore revenue analytics and the AI assistant.

---

## Known Limitations

The following items are not represented as completed production integrations:

- Razorpay live payment processing requires production configuration; the current demo includes a simulator.
- Real invoice email delivery requires an email provider such as Resend.
- Firestore emulator security-rule tests remain outstanding.
- Full browser end-to-end testing remains outstanding.
- Production load testing has not been completed.
- Failed-payment reminders do not automatically charge a stored payment method.
- Password-reset functionality has not been covered by automated tests.

---

## Project Documentation

Additional technical documentation is available in the `docs/` directory.

- [Product Requirements Document](docs/PRD.md)
- [System Architecture](docs/ARCHITECTURE.md)
- [Entity Relationship Diagram](docs/ER_DIAGRAM.md)
- [Permissions and Access Control](docs/PERMISSIONS.md)
- [API Specification](docs/API_SPEC.md)
- [UI Page Map](docs/UI_PAGE_MAP.md)
- [Financial Rules](docs/FINANCE_RULES.md)
- [Metrics and Definitions](docs/METRICS.md)
- [Financial Audit Report](docs/FINANCIAL_AUDIT_REPORT.md)
- [Testing Strategy](docs/TESTING_STRATEGY.md)
- [Requirements Checklist](docs/REQUIREMENTS_CHECKLIST.md)
- [Hackathon Audit](docs/HACKATHON_AUDIT.md)
- [UI Audit](docs/UI_AUDIT.md)
- [Development Roadmap](docs/ROADMAP.md)

---

## Project Vision

Brightloop aims to make subscription operations more organized, transparent and automated.

By combining subscription management, financial accuracy, recurring billing, customer self-service and revenue intelligence, it provides a unified foundation for businesses operating on subscription models.

**Brightloop 2.0 — Manage subscriptions. Automate billing. Understand revenue.**
