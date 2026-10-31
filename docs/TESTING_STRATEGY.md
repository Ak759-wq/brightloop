# Testing strategy

| Layer | Tool | What | Where |
|---|---|---|---|
| Finance engine (unit) | Vitest | 108 table-style cases: money/rounding, pricing models, variant deltas, minimum quantity, billing periods (month-end anchoring, leap years, weekly/daily/quarterly), proration, discounts (all conditions, stacking, usage limits), GST intra/inter, invoice totals, payment status, allocation, refunds, credit notes, ageing, dunning, MRR/ARR/ARPC/NRR/GRR, forecast, credits/overage, billing runner decisions, lifecycle transitions | `tests/finance/*.test.ts` |
| Audit report | `tests/audit.ts` + `scripts/audit-report.ts` | Each finance test records input / expected / actual / pass → markdown table | `docs/FINANCIAL_AUDIT_REPORT.md` |
| Integration | Vitest + local FileStore | Full seed (~9 months simulated with real services) + 300 bulk subs; uniqueness of invoice numbers and idempotency keys, re-runs and concurrent runs, CGST/SGST vs IGST, ₹1,860 pricing, failed payments, partial→paid→refund, proration invoice/credit, missing place of supply, usage idempotency, analytics < 2 s, assistant role checks | `tests/integration/engine.test.ts` |
| API end-to-end | bash + curl | 48 checks against a running server: auth rules, RBAC (staff cost price, taxes, discounts, staff creation, audit, settings; customer isolation), full quote→activate→invoice→pay flow with exact amounts, duplicate-free billing, simulator, cancel guards, pause/resume/close, versioning, self-service, webhook signature, list latency | `scripts/smoke.sh` |
| Visual | Playwright (Chromium) | Screenshots of every page (desktop + mobile) used for the UI audit; console errors captured | `scripts/screens.mjs` |
| Static | ESLint (next/core-web-vitals), `tsc --noEmit` strict | Every commit and CI | `.github/workflows/ci.yml` |

## Results at hand-off
- Vitest: **121 / 121 passing** (108 finance + 13 integration).
- API smoke: **48 / 48 passing** (local auth mode).
- Lint: clean. Typecheck: clean. `next build`: succeeds.

## Not yet automated (honest gaps)
- Firestore emulator tests for `firestore.rules` (rules were written and reviewed, not executed against the emulator).
- Firebase-mode end-to-end (the sandbox could not reach Google identity endpoints); the Firebase path is the same server code after token verification.
- Browser-driven interaction tests (Playwright is used for screenshots only).
