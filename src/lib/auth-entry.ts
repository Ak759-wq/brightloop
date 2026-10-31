import type { Role } from "./types";

export type AuthEntry = "customer" | "team";

export function roleMatchesEntry(role: Role, entry: AuthEntry): boolean {
  return entry === "customer" ? role === "customer" : role === "admin" || role === "staff";
}

export function entryMismatchMessage(entry: AuthEntry): string {
  return entry === "customer"
    ? "This is a team account. Use the Admin / Staff login."
    : "This is a customer account. Use the Customer login.";
}
