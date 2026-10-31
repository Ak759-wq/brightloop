import type { FieldDef } from "./crud";
export const customerFields: FieldDef[] = [
  { name: "name", label: "Customer / company name", type: "text" },
  { name: "email", label: "Billing email", type: "email" },
  { name: "phone", label: "Phone", type: "text" },
  { name: "company", label: "Legal company name", type: "text" },
  { name: "gstin", label: "GSTIN (optional)", type: "text", placeholder: "29ABCDE1234F1Z5" },
  { name: "placeOfSupply", label: "Place of supply (GST state)", type: "state", nullable: true, hint: "Decides CGST+SGST vs IGST" },
  { name: "billingAddress", label: "Billing address", type: "text", span: 2 },
  { name: "city", label: "City", type: "text" },
  { name: "tags", label: "Tags (comma separated)", type: "tags" },
];
