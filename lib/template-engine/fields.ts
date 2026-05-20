// Resolve a dotted field path (e.g. "deal.property.askingPrice") against a deal+relations object.
// The caller is responsible for fetching the deal with the relations included.

export type DealWithRelations = {
  askingPrice?: unknown;
  ourOffer?: unknown;
  agreedPrice?: unknown;
  agreementType?: unknown;
  source?: unknown;
  notes?: unknown;
  stage?: unknown;
  property?: Record<string, unknown> | null;
  seller?: (Record<string, unknown> & { firstName?: string; lastName?: string }) | null;
  realtor?: (Record<string, unknown> & { firstName?: string; lastName?: string }) | null;
};

/**
 * Resolve `path` against the deal. Recognized prefixes:
 *   - "deal.*"               → deal fields
 *   - "deal.property.*"      → property fields
 *   - "deal.seller.*"        → seller fields  (special: "fullName")
 *   - "deal.realtor.*"       → realtor fields (special: "fullName")
 *   - "today"                → current date (Date object)
 */
export function resolveFieldPath(path: string, deal: DealWithRelations): unknown {
  if (path === "today") return new Date();

  const parts = path.split(".");
  if (parts[0] !== "deal") return undefined;

  if (parts.length === 1) return deal;

  // deal.<field>
  if (parts.length === 2) {
    return (deal as Record<string, unknown>)[parts[1]];
  }

  // deal.<relation>.<field>
  const relation = parts[1] as "property" | "seller" | "realtor";
  const rel = deal[relation] as Record<string, unknown> | null | undefined;
  if (!rel) return undefined;

  const field = parts.slice(2).join(".");

  if ((relation === "seller" || relation === "realtor") && field === "fullName") {
    const fn = (rel.firstName as string | undefined) ?? "";
    const ln = (rel.lastName as string | undefined) ?? "";
    return [fn, ln].filter(Boolean).join(" ") || undefined;
  }

  return rel[field];
}

/**
 * Turn a dotted path into a docxtemplater-safe token (no dots, lowercase).
 *   deal.property.askingPrice → deal_property_askingPrice
 */
export function pathToToken(path: string): string {
  return path.replace(/\./g, "_");
}
