import { describe, expect, it } from "vitest";
import { entryMismatchMessage, roleMatchesEntry } from "@/lib/auth-entry";

describe("authentication entry points", () => {
  it("allows customers only through the customer entry", () => {
    expect(roleMatchesEntry("customer", "customer")).toBe(true);
    expect(roleMatchesEntry("admin", "customer")).toBe(false);
    expect(roleMatchesEntry("staff", "customer")).toBe(false);
  });

  it("allows admin and staff through the team entry", () => {
    expect(roleMatchesEntry("admin", "team")).toBe(true);
    expect(roleMatchesEntry("staff", "team")).toBe(true);
    expect(roleMatchesEntry("customer", "team")).toBe(false);
  });

  it("returns an actionable mismatch message", () => {
    expect(entryMismatchMessage("customer")).toContain("Admin / Staff");
    expect(entryMismatchMessage("team")).toContain("Customer");
  });
});
