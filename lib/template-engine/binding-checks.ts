// Pre-generation linkage checks. A template can bind to seller/realtor contact
// fields, but a deal may not have a seller/realtor linked yet — in which case
// those values render blank. Rather than silently emitting an incomplete
// document, the providers call this to warn the user first.

import type { Binding } from "@/lib/types";

/**
 * Returns a human-readable confirmation prompt when a template references
 * seller/realtor contact fields that aren't linked on the deal, or null when
 * everything the template needs is present. The providers show this via
 * `confirm()` before generating.
 */
export function unlinkedContactWarning(
  bindings: Binding[],
  opts: { hasSeller: boolean; hasRealtor: boolean },
): string | null {
  const needsSeller = bindings.some((b) => b.fieldPath.startsWith("deal.seller."));
  const needsRealtor = bindings.some((b) => b.fieldPath.startsWith("deal.realtor."));

  const missing: string[] = [];
  if (needsSeller && !opts.hasSeller) missing.push("seller");
  if (needsRealtor && !opts.hasRealtor) missing.push("realtor");
  if (missing.length === 0) return null;

  const list = missing.join(" and ");
  const plural = missing.length > 1;
  return `This template fills ${list} field${plural ? "s" : ""}, but the deal has no ${list} linked — those values will be blank. Generate anyway?`;
}
