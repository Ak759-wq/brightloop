import { BarChart3, Bell, Bot, Boxes, CreditCard, FileText, Gauge, LayoutDashboard, Percent, Receipt, Repeat, ScrollText, Settings, ShoppingBag, Users, Wallet, Workflow, Landmark, Layers, UserCog, FileSignature } from "lucide-react";
import type { Role } from "@/lib/types";

export interface NavItem { href: string; label: string; icon: typeof Gauge; section?: string }

const ADMIN: NavItem[] = [
  { href: "/app/overview", label: "Overview", icon: LayoutDashboard, section: "Workspace" },
  { href: "/app/customers", label: "Customers", icon: Users },
  { href: "/app/products", label: "Products", icon: Boxes, section: "Catalog" },
  { href: "/app/plans", label: "Pricing Plans", icon: Layers },
  { href: "/app/subscriptions", label: "Subscriptions", icon: Repeat, section: "Billing" },
  { href: "/app/quotations", label: "Quotations", icon: FileSignature },
  { href: "/app/invoices", label: "Invoices", icon: FileText },
  { href: "/app/payments", label: "Payments", icon: CreditCard },
  { href: "/app/discounts", label: "Discounts", icon: Percent, section: "Rules" },
  { href: "/app/taxes", label: "Taxes", icon: Landmark },
  { href: "/app/usage", label: "Usage & Credits", icon: Wallet },
  { href: "/app/automations", label: "Automations", icon: Workflow },
  { href: "/app/analytics", label: "Analytics", icon: BarChart3, section: "Insights" },
  { href: "/app/assistant", label: "AI Assistant", icon: Bot },
  { href: "/app/audit", label: "Audit Logs", icon: ScrollText, section: "Admin" },
  { href: "/app/settings", label: "Settings", icon: Settings },
];
const STAFF_ALLOWED = ["/app/overview", "/app/customers", "/app/quotations", "/app/subscriptions", "/app/invoices", "/app/payments"];

const CUSTOMER: NavItem[] = [
  { href: "/portal/overview", label: "Overview", icon: Gauge, section: "My account" },
  { href: "/portal/plans", label: "Explore Plans", icon: ShoppingBag },
  { href: "/portal/subscriptions", label: "My Subscriptions", icon: Repeat },
  { href: "/portal/invoices", label: "Invoices", icon: Receipt },
  { href: "/portal/payments", label: "Payments", icon: CreditCard },
  { href: "/portal/usage", label: "Usage & Credits", icon: Wallet },
  { href: "/portal/notifications", label: "Notifications", icon: Bell },
  { href: "/portal/account", label: "Account Settings", icon: UserCog },
];

export function navFor(role: Role): NavItem[] {
  if (role === "admin") return ADMIN;
  if (role === "staff") return ADMIN.filter((i) => STAFF_ALLOWED.includes(i.href)).map((i, idx) => ({ ...i, section: idx === 0 ? "Workspace" : undefined }));
  return CUSTOMER;
}

export function homeFor(role: Role) {
  return role === "customer" ? "/portal/overview" : "/app/overview";
}

export function allowed(role: Role, path: string) {
  if (role === "customer") return path.startsWith("/portal");
  if (!path.startsWith("/app")) return false;
  if (role === "admin") return true;
  return STAFF_ALLOWED.some((p) => path === p || path.startsWith(p + "/"));
}
