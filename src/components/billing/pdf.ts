"use client";
import type { Invoice } from "@/lib/types";
import { formatMoney } from "@/lib/finance/money";
import { INDIAN_STATES } from "@/lib/finance/tax";

/** Rupee sign is not in jsPDF's built-in fonts, so the PDF uses "Rs." */
const m = (p: number) => formatMoney(p).replace("₹", "Rs. ");

/** Client-side PDF (jsPDF). Renders the immutable invoice snapshot – never recomputes. */
export async function downloadInvoicePdf(inv: Invoice) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const L = 44, R = W - 44;
  let y = 52;
  doc.setFillColor(31, 74, 232);
  doc.roundedRect(L, y - 22, 26, 26, 6, 6, "F");
  doc.setFont("helvetica", "bold").setFontSize(16).setTextColor(15, 23, 42).text(inv.seller.name, L + 36, y - 4);
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(100, 116, 139);
  doc.text([inv.seller.address ?? "", `GSTIN ${inv.seller.gstin ?? "-"} · State ${INDIAN_STATES[inv.seller.state] ?? inv.seller.state} (${inv.seller.state})`], L + 36, y + 10);
  doc.setFont("helvetica", "bold").setFontSize(20).setTextColor(15, 23, 42).text("TAX INVOICE", R, y - 4, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(71, 85, 105).text(inv.number, R, y + 12, { align: "right" });
  y += 54;
  doc.setDrawColor(226, 232, 240).line(L, y, R, y);
  y += 22;
  doc.setFontSize(8).setTextColor(100, 116, 139).text("BILL TO", L, y);
  doc.text("DETAILS", R - 170, y);
  y += 14;
  doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(15, 23, 42).text(inv.customer.name, L, y);
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(71, 85, 105);
  doc.text([inv.customer.email, inv.customer.address || "", inv.customer.gstin ? `GSTIN ${inv.customer.gstin}` : "", `Place of supply: ${inv.customer.placeOfSupply ? `${INDIAN_STATES[inv.customer.placeOfSupply] ?? ""} (${inv.customer.placeOfSupply})` : "-"}`].filter(Boolean), L, y + 14);
  const details: [string, string][] = [["Invoice date", inv.invoiceDate], ["Due date", inv.dueDate], ["Status", inv.status.replace("_", " ").toUpperCase()], ...(inv.periodStart ? [["Period", `${inv.periodStart} to ${inv.periodEnd}`] as [string, string]] : []), ...(inv.subscriptionNumber ? [["Subscription", inv.subscriptionNumber] as [string, string]] : [])];
  details.forEach(([k, v], i) => { doc.setTextColor(100, 116, 139).text(k, R - 170, y + i * 14); doc.setTextColor(15, 23, 42).text(v, R, y + i * 14, { align: "right" }); });
  y += Math.max(70, details.length * 14 + 14);
  // table header
  const cols = { desc: L + 8, qty: L + 260, unit: L + 320, disc: L + 390, tax: L + 445, amt: R - 8 };
  doc.setFillColor(243, 246, 251).rect(L, y, R - L, 22, "F");
  doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(71, 85, 105);
  doc.text("DESCRIPTION", cols.desc, y + 14); doc.text("QTY", cols.qty, y + 14, { align: "right" }); doc.text("UNIT", cols.unit + 30, y + 14, { align: "right" });
  doc.text("DISCOUNT", cols.disc + 40, y + 14, { align: "right" }); doc.text("TAX", cols.tax + 40, y + 14, { align: "right" }); doc.text("AMOUNT", cols.amt, y + 14, { align: "right" });
  y += 22;
  doc.setFont("helvetica", "normal").setFontSize(9);
  for (const it of inv.items) {
    const lines = doc.splitTextToSize(it.description, 240) as string[];
    const h = Math.max(24, lines.length * 11 + 12);
    doc.setTextColor(15, 23, 42).text(lines, cols.desc, y + 15);
    doc.setTextColor(71, 85, 105);
    doc.text(String(it.quantity), cols.qty, y + 15, { align: "right" });
    doc.text(m(it.unitPrice), cols.unit + 30, y + 15, { align: "right" });
    doc.text(it.discount ? `-${m(it.discount)}` : "-", cols.disc + 40, y + 15, { align: "right" });
    doc.text(`${it.taxRateBp / 100}%`, cols.tax + 40, y + 15, { align: "right" });
    doc.setTextColor(15, 23, 42).text(m(it.taxable), cols.amt, y + 15, { align: "right" });
    y += h;
    doc.setDrawColor(241, 245, 249).line(L, y, R, y);
    if (y > 700) { doc.addPage(); y = 60; }
  }
  y += 16;
  const t = inv.totals;
  const rows: [string, string][] = [["Subtotal", m(t.subtotal)], ...(t.discountTotal ? [["Discount", `-${m(t.discountTotal)}`] as [string, string]] : []), ["Taxable value", m(t.taxableTotal)], ...(t.cgst ? [["CGST", m(t.cgst)] as [string, string], ["SGST", m(t.sgst)] as [string, string]] : []), ...(t.igst ? [["IGST", m(t.igst)] as [string, string]] : [])];
  rows.forEach(([k, v]) => { doc.setTextColor(100, 116, 139).text(k, R - 180, y); doc.setTextColor(15, 23, 42).text(v, R - 8, y, { align: "right" }); y += 15; });
  doc.setFillColor(31, 74, 232).roundedRect(R - 190, y - 4, 190, 28, 6, 6, "F");
  doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(255, 255, 255).text("Total", R - 180, y + 14).text(m(t.total), R - 8, y + 14, { align: "right" });
  y += 40;
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(71, 85, 105);
  const owed = Math.max(0, inv.total - inv.creditNoted - (inv.amountPaid - inv.amountRefunded));
  doc.text(`Paid ${m(inv.amountPaid - inv.amountRefunded)}${inv.creditNoted ? ` · Credits ${m(inv.creditNoted)}` : ""} · Balance due ${m(owed)}`, R - 8, y, { align: "right" });
  doc.setFontSize(8).setTextColor(148, 163, 184).text("Amounts computed by the Brightloop billing engine and frozen at issue. Rounding: half-up per line and tax component.", L, 800);
  doc.save(`${inv.number}.pdf`);
}
