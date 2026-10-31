import { describe } from "vitest";
import { area, check } from "../audit";
import { addMonthsAnchored, isLeapYear, nextPeriodStart, periodAt, periodStartN } from "@/lib/finance";

area("periods");
describe("billing periods", () => {
  check("D-01", "monthly anchored Jan 31 → Feb 28 (non-leap)", { anchor: "2027-01-31", n: 1 }, "2027-02-28", () => periodStartN("2027-01-31", "monthly", 1, 1));
  check("D-02", "monthly anchored Jan 31 → Feb 29 (leap 2028)", { anchor: "2028-01-31", n: 1 }, "2028-02-29", () => periodStartN("2028-01-31", "monthly", 1, 1));
  check("D-03", "Feb 28 restores to Mar 31 for Jan 31 anchor", { anchor: "2027-01-31", current: "2027-02-28" }, "2027-03-31", () => nextPeriodStart("2027-01-31", "monthly", 1, "2027-02-28"));
  check("D-04", "Mar 31 → Apr 30", { anchor: "2027-01-31", current: "2027-03-31" }, "2027-04-30", () => nextPeriodStart("2027-01-31", "monthly", 1, "2027-03-31"));
  check("D-05", "12 consecutive monthly starts from Jan 31", { anchor: "2026-01-31" },
    ["2026-01-31","2026-02-28","2026-03-31","2026-04-30","2026-05-31","2026-06-30","2026-07-31","2026-08-31","2026-09-30","2026-10-31","2026-11-30","2026-12-31"],
    () => Array.from({ length: 12 }, (_, n) => periodStartN("2026-01-31", "monthly", 1, n)));
  check("D-06", "yearly from leap day Feb 29 2028 → Feb 28 2029", { anchor: "2028-02-29" }, "2029-02-28", () => periodStartN("2028-02-29", "yearly", 1, 1));
  check("D-07", "yearly leap anchor returns to Feb 29 in 2032", { anchor: "2028-02-29", n: 4 }, "2032-02-29", () => periodStartN("2028-02-29", "yearly", 1, 4));
  check("D-08", "weekly period crosses year end", { anchor: "2026-12-29" }, "2027-01-05", () => periodStartN("2026-12-29", "weekly", 1, 1));
  check("D-09", "daily period", { anchor: "2026-10-31" }, "2026-11-01", () => periodStartN("2026-10-31", "daily", 1, 1));
  check("D-10", "quarterly (every 3 months) from Nov 30", { anchor: "2026-11-30" }, "2027-02-28", () => periodStartN("2026-11-30", "monthly", 3, 1));
  check("D-11", "period object for Feb 2028 (leap) has 29 days", { anchor: "2028-02-01" }, { start: "2028-02-01", endExclusive: "2028-03-01", end: "2028-02-29", days: 29 }, () => periodAt("2028-02-01", "monthly", 1, "2028-02-01"));
  check("D-12", "leap year rules 1900/2000/2024/2026", [1900, 2000, 2024, 2026], [false, true, true, false], () => [1900, 2000, 2024, 2026].map(isLeapYear));
  check("D-13", "addMonthsAnchored negative months", { iso: "2027-03-31", months: -1 }, "2027-02-28", () => addMonthsAnchored("2027-03-31", -1));
  check("D-14", "invalid date rejected", "2027-02-30", { error: "Invalid ISO date: 2027-02-30" }, () => periodStartN("2027-02-30", "monthly", 1, 1));
});
