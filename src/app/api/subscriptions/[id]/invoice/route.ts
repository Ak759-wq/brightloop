import { route } from "@/server/http";
export const dynamic = "force-dynamic";
import { ctxFor } from "@/server/ctx";
import { createManualInvoice } from "@/server/services/invoices";

export const POST = route<{ params: { id: string } }>({ action: "invoice.create" }, async (_req, session, { params }) => createManualInvoice(await ctxFor(session), params.id));
