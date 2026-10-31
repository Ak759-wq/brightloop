import { newId } from "../store/types";
import { audit, notify, stamp, type Ctx } from "./core";

export type EventType =
  | "invoice.created" | "invoice.overdue" | "payment.failed" | "payment.succeeded"
  | "subscription.activated" | "subscription.closed" | "credits.low" | "renewal.upcoming" | "dunning.exhausted";

interface Rule {
  id: string;
  name: string;
  trigger: EventType;
  minAmount?: number | null;
  action: "notify_customer" | "notify_staff" | "email_customer" | "tag_customer";
  message: string;
  tag?: string;
  enabled: boolean;
}

export interface EventPayload {
  customerId?: string | null;
  amount?: number;
  entity: string;
  entityId: string;
  label: string;
  link?: string;
}

/** Records a billing event and runs matching automation rules, logging each execution. */
export async function emit(ctx: Ctx, type: EventType, p: EventPayload) {
  await ctx.store.create("billing_events", { ...stamp(ctx.org.id), type, ...p, actor: ctx.actor.name }, newId("evt_"));
  const rules = await ctx.store.all<Rule>("automation_rules", [["orgId", "==", ctx.org.id], ["trigger", "==", type], ["enabled", "==", true]]);
  for (const rule of rules) {
    if (rule.minAmount != null && (p.amount ?? 0) < rule.minAmount) continue;
    let status: "success" | "skipped" | "failed" = "success";
    let detail = "";
    try {
      const msg = rule.message.replace(/\{label\}/g, p.label).replace(/\{amount\}/g, p.amount != null ? `₹${(p.amount / 100).toLocaleString("en-IN")}` : "");
      switch (rule.action) {
        case "notify_customer":
        case "email_customer":
          if (!p.customerId) { status = "skipped"; detail = "No customer on event"; break; }
          await notify(ctx, { audience: "customer", customerId: p.customerId, title: rule.name, body: msg, level: "info", link: p.link, channel: rule.action === "email_customer" ? (process.env.RESEND_API_KEY ? "email_sent" : "email_logged") : "in_app" });
          detail = rule.action === "email_customer" && !process.env.RESEND_API_KEY ? "Email provider not configured – logged as notification" : "Notified customer";
          break;
        case "notify_staff":
          await notify(ctx, { audience: "staff", title: rule.name, body: msg, level: "warning", link: p.link });
          detail = "Notified staff";
          break;
        case "tag_customer": {
          if (!p.customerId || !rule.tag) { status = "skipped"; detail = "Missing customer or tag"; break; }
          const c = await ctx.store.get<{ tags?: string[] }>("customers", p.customerId);
          if (c) await ctx.store.update("customers", p.customerId, { tags: Array.from(new Set([...(c.tags ?? []), rule.tag])) });
          detail = `Tagged “${rule.tag}”`;
          break;
        }
      }
    } catch (e) {
      status = "failed";
      detail = (e as Error).message;
    }
    await ctx.store.create("automation_executions", { ...stamp(ctx.org.id), ruleId: rule.id, ruleName: rule.name, trigger: type, status, detail, entity: p.entity, entityId: p.entityId, label: p.label }, newId("aex_"));
  }
}

export { audit };
