import { describe } from "vitest";
import { area, check } from "../audit";
import { buildInvoiceItems, computeLineTax, TaxRule } from "@/lib/finance";

area("tax-invoice");
const gst18: TaxRule = { id: "t18", name: "GST 18%", rateBp: 1800, kind: "GST" };
const gst5: TaxRule = { id: "t5", name: "GST 5%", rateBp: 500, kind: "GST" };

describe("GST", () => {
  check("T-01", "intra-state (KA→KA) ₹1,860 at 18% → CGST 9% + SGST 9%", { taxable: 186000, seller: "29", pos: "29" }, { supply: "intra", rateBp: 1800, cgst: 16740, sgst: 16740, igst: 0, total: 33480 }, () => computeLineTax(186000, gst18, "29", "29"));
  check("T-02", "inter-state (KA→MH) → IGST 18%", { taxable: 186000, seller: "29", pos: "27" }, { supply: "inter", rateBp: 1800, cgst: 0, sgst: 0, igst: 33480, total: 33480 }, () => computeLineTax(186000, gst18, "29", "27"));
  check("T-03", "odd paise: CGST/SGST each rounded half-up", { taxable: 999, rateBp: 500 }, { supply: "intra", rateBp: 500, cgst: 25, sgst: 25, igst: 0, total: 50 }, () => computeLineTax(999, gst5, "29", "29"));
  check("T-04", "missing place of supply is an error, never guessed", { pos: null }, { error: "Customer place of supply is not configured" }, () => computeLineTax(1000, gst18, "29", null));
  check("T-05", "missing seller state is an error", { seller: null }, { error: "Seller state is not configured in Settings" }, () => computeLineTax(1000, gst18, null, "29"));
  check("T-06", "no tax rule → zero tax, no state required", { rule: null }, { supply: "none", rateBp: 0, cgst: 0, sgst: 0, igst: 0, total: 0 }, () => computeLineTax(1000, null, null, null));
});

describe("invoice totals", () => {
  const lines = [
    { productId: "crm", description: "Brightloop CRM (Odoo) ×5", quantity: 5, unitPrice: 186000, amount: 930000, discount: 93000, taxRule: gst18 },
    { productId: "support", description: "Premium support", quantity: 1, unitPrice: 30000, amount: 30000, discount: 3000, taxRule: gst18 },
  ];
  check("I-01", "intra-state invoice with 10% discount", { lines, seller: "29", pos: "29" },
    { subtotal: 960000, discountTotal: 96000, taxableTotal: 864000, cgst: 77760, sgst: 77760, igst: 0, taxTotal: 155520, total: 1019520 },
    () => buildInvoiceItems(lines, "29", "29").totals);
  check("I-02", "inter-state same lines → IGST only, same total", { lines, seller: "29", pos: "07" },
    { subtotal: 960000, discountTotal: 96000, taxableTotal: 864000, cgst: 0, sgst: 0, igst: 155520, taxTotal: 155520, total: 1019520 },
    () => buildInvoiceItems(lines, "29", "07").totals);
  check("I-03", "line total = taxable + tax for every snapshot line", { lines }, [true, true],
    () => buildInvoiceItems(lines, "29", "29").items.map((i) => i.total === i.taxable + i.cgst + i.sgst + i.igst));
  check("I-04", "discount larger than line rejected", { amount: 100, discount: 200 }, { error: "Line discount must be between 0 and the line amount" },
    () => buildInvoiceItems([{ ...lines[0], amount: 100, discount: 200 }], "29", "29").totals);
  check("I-05", "mixed rates sum per line rounding", { rates: [1800, 500] },
    { subtotal: 2001, discountTotal: 0, taxableTotal: 2001, cgst: 115, sgst: 115, igst: 0, taxTotal: 230, total: 2231 },
    () => buildInvoiceItems([
      { productId: "a", description: "a", quantity: 1, unitPrice: 1001, amount: 1001, discount: 0, taxRule: gst18 },
      { productId: "b", description: "b", quantity: 1, unitPrice: 1000, amount: 1000, discount: 0, taxRule: gst5 },
    ], "29", "29").totals);
});
