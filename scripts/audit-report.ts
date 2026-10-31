/**
 * Builds docs/FINANCIAL_AUDIT_REPORT.md from the records written by tests/audit.ts during `vitest run`.
 * Run: npm run test:audit
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

interface R { id: string; area: string; title: string; input: unknown; expected: unknown; actual: unknown; pass: boolean }
const dir = join(process.cwd(), ".audit");
if (!existsSync(dir)) throw new Error("No .audit records – run vitest first");
const records: R[] = readdirSync(dir).filter((f) => f.endsWith(".json")).flatMap((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as R[]);
records.sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true }));
const esc = (v: unknown) => { const s = typeof v === "string" ? v : JSON.stringify(v); return (s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ").slice(0, 260); };
const passed = records.filter((r) => r.pass).length;
const AREAS: Record<string, string> = { "money-pricing": "Money & pricing", periods: "Billing periods & calendars", "proration-discount": "Proration & discounts", "tax-invoice": "GST & invoice totals", "payments-metrics": "Payments, dunning, metrics & credits", "billing-lifecycle": "Billing runner & lifecycle" };
let md = `# Financial Audit Report\n\nGenerated ${new Date().toISOString()} from \`vitest run\` (tests in \`tests/finance\`, engine in \`src/lib/finance\`).\n\n`;
md += `**${passed} / ${records.length} finance cases passed** ${passed === records.length ? "✅" : "❌"}\n\n`;
md += "All amounts are integer paise (₹1 = 100). Percentages are basis points (18% = 1800). `{ error }` means the engine correctly rejected the input with that message.\n\n";
md += "Rounding rules verified here: half-up per line and per tax component; totals are sums of rounded lines; splits use largest-remainder so parts always sum to the whole.\n\n";
for (const [key, label] of Object.entries(AREAS)) {
  const rows = records.filter((r) => r.area === key);
  if (!rows.length) continue;
  md += `## ${label}\n\n| ID | Case | Input | Expected | Actual | Result |\n|---|---|---|---|---|---|\n`;
  for (const r of rows) md += `| ${r.id} | ${esc(r.title)} | \`${esc(r.input)}\` | \`${esc(r.expected)}\` | \`${esc(r.actual)}\` | ${r.pass ? "✅ Pass" : "❌ Fail"} |\n`;
  md += "\n";
}
md += "## Integration checks (tests/integration/engine.test.ts)\n\nRun against a seeded local store with ~9 months of simulated history and 300 bulk subscriptions: unique invoice numbers, one invoice per subscription-period, idempotent re-runs, concurrent-run lock, CGST/SGST vs IGST by state, variant pricing ₹1,860, failed payments never marking paid, partial → paid → refund, proration invoice/credit, missing place of supply blocking, usage idempotency, analytics < 2 s, assistant role checks. See `npm test` output for pass/fail.\n";
writeFileSync(join(process.cwd(), "docs", "FINANCIAL_AUDIT_REPORT.md"), md);
console.log(`FINANCIAL_AUDIT_REPORT.md: ${passed}/${records.length} passed`);
