# Firestore emulator security test plan

The application uses `firebase-admin`, which bypasses Firestore rules for server operations. Rules still protect any direct client SDK access and must be tested separately in an isolated emulator project.

## Setup

1. Install the Firebase CLI outside the application dependency tree.
2. Run `firebase emulators:start --only firestore,auth`.
3. Use a disposable Firebase project ID and emulator host variables; never point this test at production.
4. Load the generated rules from `firestore.rules`.

## Required assertions

- Anonymous users cannot read or write any collection.
- A customer can read only documents with their own `customerId`.
- A customer cannot read another customer's invoices, subscriptions, payments, refunds or usage.
- Staff cannot write products, taxes, discounts, settings, audit logs or profiles.
- Only admins can write automation rules and create staff through the server API.
- Financial documents cannot be created or deleted directly by a client.
- Invoice direct updates allow only draft-to-confirmed/cancelled status changes and cannot alter amounts or line items.
- Notification updates can change only `read` for the correct audience and owner.

The API authorization tests in `tests/customer-portal.test.ts` and `tests/security/hardening.test.ts` cover the server-side half of these invariants. Emulator execution remains a deployment-environment task because the Firebase emulator and rules-unit-testing package are not installed in this repository.
