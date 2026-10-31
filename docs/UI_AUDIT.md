# UI audit — 20 most important issues vs Stripe / Linear / Chargebee standards

Method: every page was captured with Playwright (`scripts/screens.mjs`, desktop 1440×900 and mobile 390×844) against the seeded demo, reviewed next to the Fiscaly reference (rounded white cards, soft grey-blue canvas, royal-blue primary, gradient insight card, smooth lines, donut, status pills, pill navigation, Inter) and against patterns from Stripe Billing, Linear and Chargebee. Issues **1–5 were found in screenshot review of the running build** and then fixed. Issues **6–20 are the standard failure points of billing UIs** (checked against the reference products) and each one is addressed in the implementation as described. Every fix listed is in the code.

| # | Issue found | Standard it violated | Fix (where) |
|---|---|---|---|
| 1 | Compact amounts used `en-IN` compact notation, which renders thousands as **"₹14.1T"** — reads as trillions. | Stripe/Chargebee never show ambiguous units in KPI tiles. | Custom Indian compact formatter: ₹950 · ₹14.1K · ₹2.05L · ₹1.2Cr (`src/lib/client/format.ts`). |
| 2 | "New in 30 days" and churn counts used real record timestamps, so seeded/demo-clock history showed **every subscription as new** and NRR 0% / GRR −162%. | Metrics must follow business dates (Chargebee uses the subscription's activation/cancellation dates). | Analytics now uses `startDate`, business `closedOn` and amendment `effectiveDate`; GRR is clamped to 0–100% (`analytics.ts`, `subscriptions.ts`, `billing.ts`). |
| 3 | Version history showed raw paise ("net 285161"). | Never expose storage units (Stripe shows formatted currency everywhere). | Versions now read "upgrade – proration charge ₹2,851.61" (`subscriptions.ts`). |
| 4 | "Cancel subscription" was a solid red primary next to Pause/Renew — the loudest button on the page. | Linear/Stripe make destructive actions secondary and confirm them. | New `dangerSoft` variant (white + red outline); cancel opens a modal requiring a reason (`primitives.tsx`, `SubscriptionView.tsx`). |
| 5 | Explore Plans marked the first plan "Popular" with no data behind it. | Don't fabricate social proof; Chargebee hosted pages only badge configured plans. | Badge now shows the billing interval; plans sorted by interval then name (`portal/plans`). |
| 6 | Cancellation could feel like a dead end, and retention offers in many products block cancelling. | Chargebee Retention: offer, but never block. | Cancel modal shows an optional 20% offer ("Accept offer and stay") with the cancel button always enabled once a reason is chosen. |
| 7 | Tables of numbers misaligned between rows. | Financial tables use tabular figures, right-aligned amounts (Stripe). | `tabular-nums` + right alignment for every amount column (`table.tsx`, invoice/subscription views). |
| 8 | Long lists with "load everything" would not meet the < 2 s requirement at 3,000+ rows. | Server-side pagination with stable cursors (Stripe API, Linear). | Cursor pagination end-to-end (`useList`, `/api/r/*`, Firestore `startAfter`), query time shown in the table footer. |
| 9 | Search fired a request per keystroke. | Debounced search (Linear). | 300 ms debounce + prefix tokens (`useDebounced`, `_search`). |
| 10 | Blank screens while data loads; jumpy layout. | Skeletons sized like the content (Linear/Stripe). | Shimmer skeletons for KPI tiles, charts, tables and detail pages. |
| 11 | Empty tables just showed nothing. | Empty states explain and offer the next action. | `EmptyState` with icon, reason and a primary action (e.g. "New subscription", "Browse templates"). |
| 12 | Price was only known after saving a subscription. | Stripe/Chargebee show a live order summary while configuring. | Live preview from the real engine (`/api/pricing/preview`): unit price incl. variants, discounts, CGST/SGST or IGST, total; proration estimate in change modal. |
| 13 | Errors from the server surfaced as generic alerts. | Inline field errors + toasts with the server's reason. | API returns `{ error, fields }`; forms map field errors inline and toasts carry the exact reason (e.g. "Payment exceeds the outstanding amount"). |
| 14 | Modals didn't trap focus or close on Escape; focus was lost on close. | WCAG 2.1 dialog pattern. | Focus trap, Escape, overlay click, focus restore, `aria-modal`, labelled titles (`overlay.tsx`). |
| 15 | Keyboard users couldn't open table rows. | All interactive rows reachable (Linear). | Rows are focusable with Enter-to-open and visible focus rings; global `:focus-visible` outline. |
| 16 | No indication when running without real persistence, email or payments. | Stripe's test-mode banner. | Top-bar badges: "Local data mode", "Demo clock: …"; simulator and logged-email states are labelled in the UI and in notifications. |
| 17 | Invoice lacked GST context (why IGST?). | Indian tax invoices must show place of supply and tax split. | Invoice shows seller GSTIN/state, customer place of supply, "Intra-state: CGST + SGST" / "Inter-state: IGST" and per-line tax. |
| 18 | Printing the invoice included sidebar and buttons. | Print-ready documents (Stripe invoice PDF). | Print CSS hides chrome (A4 margins) + client-side PDF via jsPDF from the frozen snapshot. |
| 19 | Sidebar unusable on phones. | Responsive off-canvas navigation. | Mobile hamburger with overlay drawer; KPI grids collapse to one column; tables scroll horizontally with low-priority columns hidden. |
| 20 | Lifecycle state was a single pill — users couldn't see what comes next. | Linear/Chargebee show progress and only the valid next actions. | Lifecycle stepper (Draft → Quotation → Confirmed → Active → Closed, Paused branch) and buttons generated from the state machine + plan flags. |

## Visual system (matches and extends the reference)
- Inter, 13–15 px UI text, 28 px headings; dark navy sidebar (`#0b1226`) with royal-blue active pill; light canvas `#f3f6fb`; white 16 px-radius cards with a soft shadow.
- Royal blue `#1f4ae8` primary, cyan accent, gradient "Insight" card, smooth monotone line charts, rounded donut with legend percentages, status pills with dots.

## Known remaining UI gaps
- No dark mode, no command palette (⌘K), no saved table views/column chooser.
- Charts have no date-range picker yet (fixed 12 months / 30 days).
- Customer billing-detail edits go through support (by design for GST verification) rather than a self-service form.
