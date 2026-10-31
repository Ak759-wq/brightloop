# Brightloop isolated load-test plan

Do not run this procedure against `brightloop-zeta.vercel.app` or any organization containing real customer data.

## Prepare an isolated environment

1. Create a separate Firebase project and Vercel Preview deployment.
2. Configure matching Firebase web variables, `FIREBASE_SERVICE_ACCOUNT_JSON`, `CRON_SECRET` and a disposable organization.
3. Deploy the current branch to the preview environment.
4. Seed only the isolated project with `POST /api/admin/seed?bulk=3000` using the preview `CRON_SECRET`.
5. Record the seed response and Firestore index state before testing.

## Measure

Use a load tool such as k6 or autocannon from a runner near the configured `bom1` region. Use a valid isolated admin token and run at least 30 requests per endpoint:

| Endpoint | Query | Required measurements |
|---|---|---|
| `/api/r/subscriptions` | `limit=20`, then status and search filters | p50, p95, p99, errors |
| `/api/r/invoices` | `limit=20`, open/overdue filters | p50, p95, p99, errors |
| `/api/r/customers` | `limit=20`, search | p50, p95, p99, errors |
| `/api/analytics` | fresh analytics request | p50, p95, p99, errors |

Pass criteria are p95 below two seconds, no authorization leaks, no missing-index errors, and no duplicate invoices after two concurrent billing requests. Save the raw tool output with dataset size, request count, region, deployment commit and environment name.

The existing local integration test verifies analytics computation under two seconds on seeded local data; it is not a substitute for this hosted Firestore measurement.
