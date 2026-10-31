import type { Firestore, Query, Transaction } from "firebase-admin/firestore";
import { AlreadyExistsError, Doc, Filter, ListQuery, newId, Page, Store, Tx } from "./types";

/** Firestore (firebase-admin) implementation of the Store contract. */
export class FirestoreStore implements Store {
  readonly mode = "firestore" as const;
  constructor(private db: Firestore) {}

  private applyWhere(q: Query, where: Filter[] = []) {
    return where.reduce((acc, [f, op, v]) => acc.where(f, op, v), q);
  }

  async get<T = Doc>(col: string, id: string): Promise<T | null> {
    const snap = await this.db.collection(col).doc(id).get();
    return snap.exists ? ({ ...snap.data(), id: snap.id } as T) : null;
  }

  async list<T = Doc>(col: string, q: ListQuery): Promise<Page<T>> {
    const limit = Math.min(q.limit ?? 25, 200);
    let query = this.applyWhere(this.db.collection(col), q.where).orderBy(q.orderBy ?? "createdAt", q.direction ?? "desc");
    if (q.cursor) {
      const cur = await this.db.collection(col).doc(q.cursor).get();
      if (cur.exists) query = query.startAfter(cur);
    }
    const snap = await query.limit(limit + 1).get();
    const docs = snap.docs.slice(0, limit).map((d) => ({ ...d.data(), id: d.id }) as T);
    return { items: docs, nextCursor: snap.docs.length > limit ? snap.docs[limit - 1].id : null };
  }

  async all<T = Doc>(col: string, where?: Filter[]): Promise<T[]> {
    const snap = await this.applyWhere(this.db.collection(col), where).get();
    return snap.docs.map((d) => ({ ...d.data(), id: d.id }) as T);
  }

  async count(col: string, where?: Filter[]) {
    const snap = await this.applyWhere(this.db.collection(col), where).count().get();
    return snap.data().count;
  }

  async create<T = Doc>(col: string, data: Record<string, unknown>, id?: string): Promise<T> {
    const docId = id ?? (data.id as string) ?? newId();
    try {
      await this.db.collection(col).doc(docId).create({ ...data, id: docId });
    } catch (e) {
      if ((e as { code?: number }).code === 6) throw new AlreadyExistsError(col, docId);
      throw e;
    }
    return { ...data, id: docId } as T;
  }

  async update(col: string, id: string, patch: Record<string, unknown>) {
    await this.db.collection(col).doc(id).update(patch);
  }

  async delete(col: string, id: string) {
    await this.db.collection(col).doc(id).delete();
  }

  async tx<R>(fn: (tx: Tx) => Promise<R>): Promise<R> {
    try {
      return await this.db.runTransaction(async (t: Transaction) => {
        const tx: Tx = {
          get: async <T>(col: string, id: string) => {
            const s = await t.get(this.db.collection(col).doc(id));
            return s.exists ? ({ ...s.data(), id: s.id } as T) : null;
          },
          query: async <T>(col: string, where: Filter[], limit?: number) => {
            const s = await t.get(this.applyWhere(this.db.collection(col), where).limit(limit ?? 1000));
            return s.docs.map((d) => ({ ...d.data(), id: d.id }) as T);
          },
          set: (col, id, data) => void t.set(this.db.collection(col).doc(id), { ...data, id }),
          create: (col, id, data) => void t.create(this.db.collection(col).doc(id), { ...data, id }),
          update: (col, id, patch) => void t.update(this.db.collection(col).doc(id), patch),
          delete: (col, id) => void t.delete(this.db.collection(col).doc(id)),
        };
        return fn(tx);
      });
    } catch (e) {
      const code = (e as { code?: number }).code;
      if (code === 6) throw new AlreadyExistsError("tx", "unknown");
      throw e;
    }
  }

  async bulkSet(col: string, docs: Doc[]) {
    for (let i = 0; i < docs.length; i += 400) {
      const batch = this.db.batch();
      docs.slice(i, i + 400).forEach((d) => batch.set(this.db.collection(col).doc(d.id), d));
      await batch.commit();
    }
  }
}
