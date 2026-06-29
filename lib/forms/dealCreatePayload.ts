import type { DealCreateInput } from "@/contexts/DataContext";

// Single source of truth for the "new deal" payload shape. Used by both
// DealCreateModal (the spread's inline add) and DealCreateForm (the /deals/new
// page). Reads the superset of fields — any input not present in a given form
// resolves to null, which the server already treats as "not set."
export function dealCreatePayloadFromFormData(fd: FormData): DealCreateInput {
  const str = (key: string) => String(fd.get(key) ?? "").trim() || null;
  const num = (key: string) => String(fd.get(key) ?? "") || null;
  return {
    address: String(fd.get("address") ?? "").trim(),
    city: str("city"),
    state: str("state"),
    zip: str("zip"),
    bedrooms: num("bedrooms"),
    bathrooms: num("bathrooms"),
    sqft: num("sqft"),
    lotSize: num("lotSize"),
    yearBuilt: num("yearBuilt"),
    askingPrice: num("askingPrice"),
    ourOffer: num("ourOffer"),
    // Deal-progression fields (all optional). Dates come from <input type="date">
    // as YYYY-MM-DD; weOwn is a checkbox (absent when unchecked).
    agreedPrice: num("agreedPrice"),
    listPrice: num("listPrice"),
    acceptanceDate: str("acceptanceDate"),
    expirationDate: str("expirationDate"),
    termOfAgreement: str("termOfAgreement"),
    amountOwed: num("amountOwed"),
    weOwn: fd.get("weOwn") != null,
    source: str("source"),
    notes: str("notes"),
  };
}
