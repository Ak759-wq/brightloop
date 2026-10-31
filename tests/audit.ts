import { afterAll, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { isDeepStrictEqual } from "node:util";

interface AuditRecord {
  id: string;
  area: string;
  title: string;
  input: unknown;
  expected: unknown;
  actual: unknown;
  pass: boolean;
}

const records: AuditRecord[] = [];
let fileArea = "finance";

export function area(name: string) {
  fileArea = name;
}

/**
 * Registers a finance test whose input/expected/actual are recorded for
 * docs/FINANCIAL_AUDIT_REPORT.md. Errors become { error: message } so
 * validation tests can assert on the exact rejection.
 */
export function check<T>(id: string, title: string, input: unknown, expected: T, compute: () => T) {
  const areaName = fileArea;
  it(`${id} ${title}`, () => {
    let actual: unknown;
    try {
      actual = compute();
    } catch (e) {
      actual = { error: (e as Error).message };
    }
    const pass = isDeepStrictEqual(actual, expected);
    records.push({ id, area: areaName, title, input, expected, actual, pass });
    expect(actual).toEqual(expected);
  });
}

afterAll(() => {
  if (!records.length) return;
  const dir = join(process.cwd(), ".audit");
  mkdirSync(dir, { recursive: true });
  const name = basename(records[0].area).replace(/[^a-z0-9-]/gi, "_");
  writeFileSync(join(dir, `${name}.json`), JSON.stringify(records, null, 2));
});
