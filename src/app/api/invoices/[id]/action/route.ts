import { z } from "zod";
import { canDo } from "@/lib/permissions";
import { forbidden, route, body } from "@/server/http";
import { ctxFor } from "@/server/ctx";
import { cancelInvoice, confirmInvoice, issueCreditNote, sendInvoice } from "@/server/services/invoices";
import { invalidateAnalytics } from "@/server/services/analytics";

const schema = z.object({ action: z.enum(["confirm", "cancel", "send", "credit_note"]), reason: z.string().max(300).optional(), amount: z.number().int().positive().optional() });

export const POST = route<{ params: { id: string } }>({ roles: ["admin", "staff"] }, async (req, session, { params }) => {
  const input = schema.parse(await body(req));
  const ctx = await ctxFor(session);
  const map = { confirm: "invoice.confirm", cancel: "invoice.cancel", send: "invoice.send", credit_note: "invoice.credit_note" } as const;
  if (!canDo(session.role, map[input.action])) throw forbidden();
  let r: unknown;
  if (input.action === "confirm") r = await confirmInvoice(ctx, params.id);
  else if (input.action === "cancel") r = await cancelInvoice(ctx, params.id, input.reason ?? "");
  else if (input.action === "send") r = await sendInvoice(ctx, params.id);
  else r = await issueCreditNote(ctx, params.id, input.amount ?? 0, input.reason ?? "");
  invalidateAnalytics();
  return r;
});
