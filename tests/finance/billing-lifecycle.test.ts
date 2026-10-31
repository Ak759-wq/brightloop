import { describe } from "vitest";
import { area, check } from "../audit";
import { allowedActions, billingKey, canTransition, decideBilling } from "@/lib/finance";

area("billing-lifecycle");
const base = { id: "sub1", status: "active", startDate: "2026-01-31", anchorDate: "2026-01-31", interval: "monthly" as const, intervalCount: 1, nextBillingDate: "2026-10-31", endDate: null as string | null };

describe("billing runner decisions", () => {
  check("B-01", "due today → bill one period, advance to Nov 30", { ...base, today: "2026-10-31" },
    { action: "bill", periods: [{ start: "2026-10-31", end: "2026-11-29", endExclusive: "2026-11-30" }], nextBillingDate: "2026-11-30", closeAfter: false },
    () => decideBilling(base, "2026-10-31"));
  check("B-02", "not due yet → skip", { today: "2026-10-30" }, { action: "skip", reason: "not due" }, () => decideBilling(base, "2026-10-30"));
  check("B-03", "missed 3 periods → catch up all, none skipped", { nextBillingDate: "2026-08-31", today: "2026-10-31" },
    ["2026-08-31", "2026-09-30", "2026-10-31"], () => { const d = decideBilling({ ...base, nextBillingDate: "2026-08-31" }, "2026-10-31"); return d.action === "bill" ? d.periods.map((p) => p.start) : []; });
  check("B-04", "paused subscription never billed", { status: "paused" }, { action: "skip", reason: "status paused" }, () => decideBilling({ ...base, status: "paused" }, "2026-10-31"));
  check("B-05", "does not bill periods starting after expiry", { endDate: "2026-09-15", nextBillingDate: "2026-08-31", autoClose: true },
    { periods: ["2026-08-31"], closeAfter: true }, () => { const d = decideBilling({ ...base, nextBillingDate: "2026-08-31", endDate: "2026-09-15", autoClose: true }, "2026-10-31"); return d.action === "bill" ? { periods: d.periods.map((p) => p.start), closeAfter: d.closeAfter } : d; });
  check("B-06", "expired + auto-close → close", { endDate: "2026-10-01", autoClose: true }, { action: "close", reason: "expired" }, () => decideBilling({ ...base, endDate: "2026-10-01", autoClose: true }, "2026-10-31"));
  check("B-07", "idempotency key is deterministic per period", { sub: "sub1", period: "2026-10-31" }, "sub1__2026-10-31", () => billingKey("sub1", "2026-10-31"));
  check("B-08", "same input twice → same key (no duplicate invoice)", {}, true, () => billingKey("sub1", "2026-10-31") === billingKey("sub1", "2026-10-31"));
});

describe("lifecycle", () => {
  check("L-01", "draft → quotation allowed", { from: "draft", action: "send_quotation" }, { ok: true, to: "quotation" }, () => canTransition("draft", "send_quotation"));
  check("L-02", "cannot activate a draft directly", { from: "draft", action: "activate" }, { ok: false, reason: "Cannot activate a draft subscription" }, () => canTransition("draft", "activate"));
  check("L-03", "pause blocked when plan disallows", { flags: { pausable: false } }, { ok: false, reason: "This plan does not allow pausing" }, () => canTransition("active", "pause", { pausable: false, closable: true, renewable: true }));
  check("L-04", "closed cannot be paused", { from: "closed" }, { ok: false, reason: "Cannot pause a closed subscription" }, () => canTransition("closed", "pause"));
  check("L-05", "actions available for active", { status: "active" }, ["pause", "renew", "close"], () => allowedActions("active", { pausable: true, closable: true, renewable: true }));
});
