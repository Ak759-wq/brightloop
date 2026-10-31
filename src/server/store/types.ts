export type Op = "==" | "!=" | "<" | "<=" | ">" | ">=" | "in" | "array-contains";
export type Filter = [field: string, op: Op, value: unknown];

export interface ListQuery {
  where?: Filter[];
  orderBy?: string;
  direction?: "asc" | "desc";
  limit?: number;
  cursor?: string | null;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export type Doc = Record<string, unknown> & { id: string };

export class AlreadyExistsError extends Error {
  constructor(public col: string, public docId: string) {
    super(`${col}/${docId} already exists`);
    this.name = "AlreadyExistsError";
  }
}

/** Transaction: do ALL reads first, then queue writes (Firestore semantics). */
export interface Tx {
  get<T = Doc>(col: string, id: string): Promise<T | null>;
  query<T = Doc>(col: string, where: Filter[], limit?: number): Promise<T[]>;
  set(col: string, id: string, data: Record<string, unknown>): void;
  create(col: string, id: string, data: Record<string, unknown>): void;
  update(col: string, id: string, patch: Record<string, unknown>): void;
  delete(col: string, id: string): void;
}

export interface Store {
  readonly mode: "firestore" | "local";
  get<T = Doc>(col: string, id: string): Promise<T | null>;
  list<T = Doc>(col: string, q: ListQuery): Promise<Page<T>>;
  /** Unpaginated read for aggregation jobs (billing runner, analytics). */
  all<T = Doc>(col: string, where?: Filter[]): Promise<T[]>;
  count(col: string, where?: Filter[]): Promise<number>;
  create<T = Doc>(col: string, data: Record<string, unknown>, id?: string): Promise<T>;
  update(col: string, id: string, patch: Record<string, unknown>): Promise<void>;
  delete(col: string, id: string): Promise<void>;
  tx<R>(fn: (tx: Tx) => Promise<R>): Promise<R>;
  /** batched bulk write (seeding) */
  bulkSet(col: string, docs: Doc[]): Promise<void>;
}

export function newId(prefix = ""): string {
  const rnd = Array.from(crypto.getRandomValues(new Uint8Array(10)))
    .map((b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36])
    .join("");
  return `${prefix}${Date.now().toString(36)}${rnd}`;
}

export function matches(doc: Record<string, unknown>, [field, op, value]: Filter): boolean {
  const v = doc[field] as never;
  switch (op) {
    case "==": return v === value;
    case "!=": return v !== value;
    case "<": return v != null && v < (value as never);
    case "<=": return v != null && v <= (value as never);
    case ">": return v != null && v > (value as never);
    case ">=": return v != null && v >= (value as never);
    case "in": return (value as unknown[]).includes(v);
    case "array-contains": return Array.isArray(v) && (v as unknown[]).includes(value);
  }
}
