import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { AlreadyExistsError, Doc, Filter, ListQuery, matches, newId, Page, Store, Tx } from "./types";

type DB = Record<string, Record<string, Doc>>;

/**
 * LOCAL MODE store: a single JSON file, held in memory and flushed after writes.
 * Transactions are serialised with a promise-chain mutex, so concurrent requests in one
 * process cannot interleave (good enough for dev/demo; production uses Firestore).
 */
export class FileStore implements Store {
  readonly mode = "local" as const;
  private db: DB;
  private chain: Promise<unknown> = Promise.resolve();
  private flushTimer: NodeJS.Timeout | null = null;
  private file: string;

  private persist: boolean;

  /** `dir = null` creates a purely in-memory store (never touches disk). */
  constructor(dir: string | null) {
    this.persist = dir !== null;
    this.file = dir ? join(dir, "brightloop-db.json") : "";
    if (dir) mkdirSync(dir, { recursive: true });
    this.db = dir && existsSync(this.file) ? (JSON.parse(readFileSync(this.file, "utf8")) as DB) : {};
  }

  /** Snapshot of every collection (used to copy a simulated seed into Firestore). */
  dump(): Record<string, Doc[]> {
    return Object.fromEntries(Object.entries(this.db).map(([col, docs]) => [col, Object.values(docs)]));
  }

  isEmpty() {
    return !this.db.organizations || Object.keys(this.db.organizations).length === 0;
  }

  private colMap(col: string) {
    return (this.db[col] ??= {});
  }

  private scheduleFlush() {
    if (!this.persist || this.flushTimer) return;
    this.flushTimer = setTimeout(() => this.flushNow(), 50);
  }

  flushNow() {
    if (!this.persist) return;
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = null;
    const tmp = this.file + ".tmp";
    writeFileSync(tmp, JSON.stringify(this.db));
    renameSync(tmp, this.file);
  }

  private lock<R>(fn: () => Promise<R>): Promise<R> {
    const run = this.chain.then(fn, fn);
    this.chain = run.catch(() => undefined);
    return run;
  }

  async get<T = Doc>(col: string, id: string): Promise<T | null> {
    const d = this.colMap(col)[id];
    return d ? (structuredClone(d) as unknown as T) : null;
  }

  private filtered(col: string, where: Filter[] = []): Doc[] {
    return Object.values(this.colMap(col)).filter((d) => where.every((f) => matches(d, f)));
  }

  async list<T = Doc>(col: string, q: ListQuery): Promise<Page<T>> {
    const orderBy = q.orderBy ?? "createdAt";
    const dir = q.direction === "asc" ? 1 : -1;
    const rows = this.filtered(col, q.where).sort((a, b) => {
      const av = a[orderBy] as string, bv = b[orderBy] as string;
      if (av === bv) return a.id < b.id ? dir : -dir;
      return (av > bv ? 1 : -1) * dir;
    });
    const limit = Math.min(q.limit ?? 25, 200);
    let start = 0;
    if (q.cursor) {
      const idx = rows.findIndex((r) => r.id === q.cursor);
      start = idx >= 0 ? idx + 1 : 0;
    }
    const items = rows.slice(start, start + limit);
    const nextCursor = start + limit < rows.length && items.length ? items[items.length - 1].id : null;
    return { items: structuredClone(items) as unknown as T[], nextCursor };
  }

  async all<T = Doc>(col: string, where?: Filter[]): Promise<T[]> {
    return structuredClone(this.filtered(col, where)) as unknown as T[];
  }

  async count(col: string, where?: Filter[]) {
    return this.filtered(col, where).length;
  }

  async create<T = Doc>(col: string, data: Record<string, unknown>, id?: string): Promise<T> {
    return this.lock(async () => {
      const docId = id ?? (data.id as string) ?? newId();
      if (this.colMap(col)[docId]) throw new AlreadyExistsError(col, docId);
      const doc = { ...structuredClone(data), id: docId } as Doc;
      this.colMap(col)[docId] = doc;
      this.scheduleFlush();
      return structuredClone(doc) as unknown as T;
    });
  }

  async update(col: string, id: string, patch: Record<string, unknown>) {
    return this.lock(async () => {
      const cur = this.colMap(col)[id];
      if (!cur) throw new Error(`${col}/${id} not found`);
      this.colMap(col)[id] = { ...cur, ...structuredClone(patch), id };
      this.scheduleFlush();
    });
  }

  async delete(col: string, id: string) {
    return this.lock(async () => {
      delete this.colMap(col)[id];
      this.scheduleFlush();
    });
  }

  async tx<R>(fn: (tx: Tx) => Promise<R>): Promise<R> {
    return this.lock(async () => {
      const writes: (() => void)[] = [];
      const pendingCreates = new Set<string>();
      const tx: Tx = {
        get: async <T>(col: string, id: string) => {
          const d = this.colMap(col)[id];
          return d ? (structuredClone(d) as unknown as T) : null;
        },
        query: async <T>(col: string, where: Filter[], limit?: number) =>
          structuredClone(this.filtered(col, where).slice(0, limit ?? 1000)) as unknown as T[],
        set: (col, id, data) => writes.push(() => (this.colMap(col)[id] = { ...structuredClone(data), id } as Doc)),
        create: (col, id, data) => {
          if (this.colMap(col)[id] || pendingCreates.has(`${col}/${id}`)) throw new AlreadyExistsError(col, id);
          pendingCreates.add(`${col}/${id}`);
          writes.push(() => (this.colMap(col)[id] = { ...structuredClone(data), id } as Doc));
        },
        update: (col, id, patch) =>
          writes.push(() => {
            const cur = this.colMap(col)[id];
            if (!cur) throw new Error(`${col}/${id} not found`);
            this.colMap(col)[id] = { ...cur, ...structuredClone(patch), id };
          }),
        delete: (col, id) => writes.push(() => delete this.colMap(col)[id]),
      };
      const result = await fn(tx);
      // apply atomically: snapshot to roll back on failure
      const snapshot = JSON.stringify(this.db);
      try {
        writes.forEach((w) => w());
      } catch (e) {
        this.db = JSON.parse(snapshot) as DB;
        throw e;
      }
      this.scheduleFlush();
      return result;
    });
  }

  async bulkSet(col: string, docs: Doc[]) {
    return this.lock(async () => {
      for (const d of docs) this.colMap(col)[d.id] = structuredClone(d);
      this.scheduleFlush();
    });
  }
}
