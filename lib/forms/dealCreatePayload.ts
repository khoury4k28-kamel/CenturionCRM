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
    source: str("source"),
    notes: str("notes"),
  };
}
