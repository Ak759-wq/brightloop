import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { canDo, type ActionName } from "@/lib/permissions";
import type { Role } from "@/lib/types";
import { getSession, type Session } from "./auth";
import { AlreadyExistsError, BackendConfigError } from "./store";

export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

export const bad = (msg: string, details?: unknown) => new HttpError(400, msg, details);
export const forbidden = (msg = "You do not have permission to do that") => new HttpError(403, msg);
export const notFound = (what = "Record") => new HttpError(404, `${what} not found`);

export function toResponse(e: unknown) {
  if (e instanceof HttpError) return NextResponse.json({ error: e.message, details: e.details }, { status: e.status });
  if (e instanceof BackendConfigError) return NextResponse.json({ error: e.message, code: "BACKEND_NOT_CONFIGURED" }, { status: 503 });
  if (e instanceof ZodError) {
    const fields: Record<string, string> = {};
    e.issues.forEach((i) => (fields[i.path.join(".") || "_"] ??= i.message));
    return NextResponse.json({ error: e.issues[0]?.message ?? "Invalid input", fields }, { status: 422 });
  }
  if (e instanceof AlreadyExistsError) return NextResponse.json({ error: "Duplicate request – this record already exists" }, { status: 409 });
  const name = (e as Error)?.name;
  if (["PricingError", "TaxError", "PaymentError", "MoneyError", "DomainError"].includes(name)) {
    return NextResponse.json({ error: (e as Error).message }, { status: 422 });
  }
  console.error("[api] unhandled", e);
  return NextResponse.json({ error: "Something went wrong on our side. Please try again." }, { status: 500 });
}

export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}

type Handler<C> = (req: Request, session: Session, ctx: C) => Promise<unknown>;

/** Wraps a route: requires a session, optional role/action check, JSON error mapping. */
export function route<C = { params: Record<string, string> }>(opts: { roles?: Role[]; action?: ActionName }, handler: Handler<C>) {
  return async (req: Request, ctx: C) => {
    try {
      const session = await getSession(req);
      if (!session) throw new HttpError(401, "Please sign in");
      if (opts.roles && !opts.roles.includes(session.role)) throw forbidden();
      if (opts.action && !canDo(session.role, opts.action)) throw forbidden();
      const result = await handler(req, session, ctx);
      return result instanceof Response ? result : NextResponse.json(result ?? { ok: true });
    } catch (e) {
      return toResponse(e);
    }
  };
}

export async function body<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw bad("Request body must be JSON");
  }
}
