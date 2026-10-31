/**
 * Subscription lifecycle: DRAFT -> QUOTATION -> CONFIRMED -> ACTIVE <-> PAUSED -> CLOSED
 */
export type SubStatus = "draft" | "quotation" | "confirmed" | "active" | "paused" | "closed";
export type SubAction = "send_quotation" | "confirm" | "activate" | "pause" | "resume" | "renew" | "close" | "revert_to_draft";

const TRANSITIONS: Record<SubAction, { from: SubStatus[]; to: SubStatus }> = {
  send_quotation: { from: ["draft"], to: "quotation" },
  revert_to_draft: { from: ["quotation"], to: "draft" },
  confirm: { from: ["draft", "quotation"], to: "confirmed" },
  activate: { from: ["confirmed"], to: "active" },
  pause: { from: ["active"], to: "paused" },
  resume: { from: ["paused"], to: "active" },
  renew: { from: ["active", "closed"], to: "active" },
  close: { from: ["draft", "quotation", "confirmed", "active", "paused"], to: "closed" },
};

export interface PlanFlags {
  pausable: boolean;
  closable: boolean;
  renewable: boolean;
}

export function canTransition(status: SubStatus, action: SubAction, flags?: PlanFlags): { ok: boolean; reason?: string; to?: SubStatus } {
  const t = TRANSITIONS[action];
  if (!t) return { ok: false, reason: "Unknown action" };
  if (!t.from.includes(status)) return { ok: false, reason: `Cannot ${action.replace("_", " ")} a ${status} subscription` };
  if (flags) {
    if (action === "pause" && !flags.pausable) return { ok: false, reason: "This plan does not allow pausing" };
    if (action === "renew" && !flags.renewable) return { ok: false, reason: "This plan is not renewable" };
    if (action === "close" && status === "active" && !flags.closable) return { ok: false, reason: "This plan cannot be closed early" };
  }
  return { ok: true, to: t.to };
}

export function allowedActions(status: SubStatus, flags?: PlanFlags): SubAction[] {
  return (Object.keys(TRANSITIONS) as SubAction[]).filter((a) => canTransition(status, a, flags).ok);
}
