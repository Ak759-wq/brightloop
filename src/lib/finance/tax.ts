import { applyBp, Minor } from "./money";

/** GST state codes (subset shown in UI; any 2-digit code is accepted). */
export const INDIAN_STATES: Record<string, string> = {
  "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh", "05": "Uttarakhand",
  "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh", "10": "Bihar", "11": "Sikkim",
  "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur", "15": "Mizoram", "16": "Tripura", "17": "Meghalaya",
  "18": "Assam", "19": "West Bengal", "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh",
  "24": "Gujarat", "26": "Dadra & Nagar Haveli and Daman & Diu", "27": "Maharashtra", "29": "Karnataka", "30": "Goa",
  "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry", "35": "Andaman & Nicobar Islands",
  "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh", "97": "Other Territory",
};

export interface TaxRule {
  id: string;
  name: string;
  /** basis points, 1800 = 18% */
  rateBp: number;
  kind: "GST" | "NONE";
  hsnSac?: string;
}

export class TaxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TaxError";
  }
}

export type SupplyType = "intra" | "inter" | "none";

export interface LineTax {
  supply: SupplyType;
  rateBp: number;
  cgst: Minor;
  sgst: Minor;
  igst: Minor;
  total: Minor;
}

/**
 * Determine supply type from CONFIGURED states only. Never guesses:
 * a missing seller state or place of supply is an error the admin must fix.
 */
export function supplyType(sellerState: string | null | undefined, placeOfSupply: string | null | undefined): Exclude<SupplyType, "none"> {
  if (!sellerState) throw new TaxError("Seller state is not configured in Settings");
  if (!placeOfSupply) throw new TaxError("Customer place of supply is not configured");
  return sellerState === placeOfSupply ? "intra" : "inter";
}

/**
 * Tax for one line's taxable value.
 * Intra-state: CGST = SGST = rate/2 each, each rounded half-up separately.
 * Inter-state: IGST = full rate.
 */
export function computeLineTax(taxable: Minor, rule: TaxRule | null, sellerState?: string | null, placeOfSupply?: string | null): LineTax {
  if (!rule || rule.kind === "NONE" || rule.rateBp === 0) {
    return { supply: "none", rateBp: 0, cgst: 0, sgst: 0, igst: 0, total: 0 };
  }
  const supply = supplyType(sellerState, placeOfSupply);
  if (supply === "intra") {
    const half = rule.rateBp / 2;
    const cgst = applyBp(taxable, half);
    const sgst = applyBp(taxable, half);
    return { supply, rateBp: rule.rateBp, cgst, sgst, igst: 0, total: cgst + sgst };
  }
  const igst = applyBp(taxable, rule.rateBp);
  return { supply, rateBp: rule.rateBp, cgst: 0, sgst: 0, igst, total: igst };
}
