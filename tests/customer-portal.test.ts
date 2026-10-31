import { describe, expect, it } from "vitest";
import { allowed } from "@/components/shell/nav";
import { scopeFilters } from "@/server/resources";
import type { Session } from "@/server/auth";

const customer: Session = { uid: "customer_uid", email: "customer@example.com", name: "Customer", role: "customer", orgId: "org_brightloop", customerId: "cust_123" };

describe("customer portal authorization", () => {
  it("limits customer collections to the authenticated customer's record", () => {
    for (const collection of ["subscriptions", "invoices", "payments", "refunds", "credit_wallets"]) {
      expect(scopeFilters(customer, collection)).toContainEqual(["customerId", "==", "cust_123"]);
    }
  });

  it("keeps customer and team routes separate", () => {
    expect(allowed("customer", "/portal/overview")).toBe(true);
    expect(allowed("customer", "/app/overview")).toBe(false);
    expect(allowed("admin", "/portal/overview")).toBe(false);
    expect(allowed("staff", "/app/overview")).toBe(true);
  });

  it("does not allow a customer without a linked customer record to query owned data", () => {
    expect(() => scopeFilters({ ...customer, customerId: null }, "invoices")).toThrow();
  });
});
