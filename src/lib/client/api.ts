"use client";
import { useCallback, useEffect, useRef, useState } from "react";

type TokenGetter = () => Promise<string | null>;
let tokenGetter: TokenGetter = async () => null;
export function setTokenGetter(fn: TokenGetter) {
  tokenGetter = fn;
}

export class ApiError extends Error {
  constructor(public status: number, message: string, public fields?: Record<string, string>) {
    super(message);
  }
}

export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = await tokenGetter();
  const res = await fetch(path, {
    method: opts.method ?? (opts.body ? "POST" : "GET"),
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string; fields?: Record<string, string> };
  if (!res.ok) throw new ApiError(res.status, json.error ?? `Request failed (${res.status})`, json.fields);
  return json as T;
}

/** Tiny data hook with revalidation (no external deps). */
export function useApi<T>(path: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!path);
  const seq = useRef(0);
  const load = useCallback(async () => {
    if (!path) return;
    const n = ++seq.current;
    setLoading(true);
    try {
      const d = await api<T>(path);
      if (n === seq.current) { setData(d); setError(null); }
    } catch (e) {
      if (n === seq.current) setError((e as Error).message);
    } finally {
      if (n === seq.current) setLoading(false);
    }
  }, [path]);
  useEffect(() => { void load(); }, [load, ...deps]);
  return { data, error, loading, reload: load, setData };
}

export interface ListState<T> {
  items: T[];
  loading: boolean;
  error: string | null;
  page: number;
  hasNext: boolean;
  next: () => void;
  prev: () => void;
  reload: () => void;
  tookMs: number | null;
}

/** Server-side cursor pagination over /api/r/:collection with filters. */
export function useList<T>(collection: string, params: Record<string, string | undefined>, limit = 15): ListState<T> {
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [items, setItems] = useState<T[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tookMs, setTook] = useState<number | null>(null);
  const [tick, setTick] = useState(0);
  const key = JSON.stringify(params);
  useEffect(() => setCursors([null]), [key, collection]);
  const cursor = cursors[cursors.length - 1];
  useEffect(() => {
    let alive = true;
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v && qs.set(k, v));
    qs.set("limit", String(limit));
    if (cursor) qs.set("cursor", cursor);
    setLoading(true);
    api<{ items: T[]; nextCursor: string | null; tookMs: number }>(`/api/r/${collection}?${qs}`)
      .then((r) => { if (alive) { setItems(r.items); setNextCursor(r.nextCursor); setError(null); setTook(r.tookMs); } })
      .catch((e) => alive && setError((e as Error).message))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [collection, key, cursor, tick, limit]);
  return {
    items, loading, error, tookMs,
    page: cursors.length,
    hasNext: !!nextCursor,
    next: () => nextCursor && setCursors((c) => [...c, nextCursor]),
    prev: () => setCursors((c) => (c.length > 1 ? c.slice(0, -1) : c)),
    reload: () => setTick((t) => t + 1),
  };
}
