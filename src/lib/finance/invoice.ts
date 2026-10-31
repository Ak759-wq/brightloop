import { assertMinor, Minor, sum } from "./money";
import { computeLineTax, TaxRule } from "./tax";

export interface InvoiceLineInput {
  productId: string;
  description: string;
  quantity: number;
  /** pre-discount line amount (minor) – e.g. from priceLine() */
  amount: Minor;
  unitPrice: Minor;
  discount: Minor;
  taxRule: TaxRule | null;
  periodStart?: string;
  periodEnd?: string;
}

/** Immutable snapshot of a line at issue time. Old invoices are never recomputed. */
export interface InvoiceItemSnapshot {
  productId: string;
  description: string;
  quantity: number;
  unitPrice: Minor;
  amount: Minor;
  discount: Minor;
  taxable: Minor;
  taxName: string;
  taxRateBp: number;
  supply: "intra" | "inter" | "none";
  cgst: Minor;
  sgst: Minor;
  igst: Minor;
  tax: Minor;
  total: Minor;
  periodStart?: string;
  periodEnd?: string;
}

export interface InvoiceTotals {
  subtotal: Minor;
  discountTotal: Minor;
  taxableTotal: Minor;
  cgst: Minor;
  sgst: Minor;
  igst: Minor;
  taxTotal: Minor;
  total: Minor;
}

export function buildInvoiceItems(
  lines: InvoiceLineInput[],
  sellerState: string | null | undefined,
  placeOfSupply: string | null | undefined,
): { items: InvoiceItemSnapshot[]; totals: InvoiceTotals } {
  const items = lines.map((l): InvoiceItemSnapshot => {
    assertMinor(l.amount, "amount");
    assertMinor(l.discount, "discount");
    if (l.discount < 0 || l.discount > l.amount) throw new Error("Line discount must be between 0 and the line amount");
    const taxable = l.amount - l.discount;
    const tax = computeLineTax(taxable, l.taxRule, sellerState, placeOfSupply);
    return {
      productId: l.productId,
      description: l.description,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      amount: l.amount,
      discount: l.discount,
      taxable,
      taxName: l.taxRule?.name ?? "No tax",
      taxRateBp: tax.rateBp,
      supply: tax.supply,
      cgst: tax.cgst,
      sgst: tax.sgst,
      igst: tax.igst,
      tax: tax.total,
      total: taxable + tax.total,
      ...(l.periodStart ? { periodStart: l.periodStart, periodEnd: l.periodEnd } : {}),
    };
  });
  return { items, totals: totalsOf(items) };
}

export function totalsOf(items: InvoiceItemSnapshot[]): InvoiceTotals {
  const subtotal = sum(items.map((i) => i.amount));
  const discountTotal = sum(items.map((i) => i.discount));
  const taxableTotal = sum(items.map((i) => i.taxable));
  const cgst = sum(items.map((i) => i.cgst));
  const sgst = sum(items.map((i) => i.sgst));
  const igst = sum(items.map((i) => i.igst));
  const taxTotal = cgst + sgst + igst;
  return { subtotal, discountTotal, taxableTotal, cgst, sgst, igst, taxTotal, total: taxableTotal + taxTotal };
}
