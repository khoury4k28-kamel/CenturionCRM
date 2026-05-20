"use client";

import { useMemo } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { SpreadTable } from "@/components/spread/SpreadTable";
import { SpreadStore } from "@/components/spread/SpreadStore";
import type { SpreadDeal } from "@/components/spread/types";
import { useData } from "@/contexts/DataContext";

const IN_ESCROW_STAGE = "IN_ESCROW";
const HIDDEN_STAGES = new Set(["CLOSED", "DEAD"]);

export default function SpreadPage() {
  const { deals, isLoaded } = useData();

  // Sort by creation time (oldest first) — stable, predictable order during
  // weekly review. Flagged rows keep their position; the yellow tint conveys
  // priority without reordering.
  const view = useMemo(() => {
    const visible = deals
      .filter((d) => !HIDDEN_STAGES.has(d.stage))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    const all: SpreadDeal[] = visible.map((d) => ({
      id: d.id,
      stage: d.stage,
      agreedPrice: d.agreedPrice,
      listPrice: d.listPrice,
      acceptanceDate: d.acceptanceDate,
      expirationDate: d.expirationDate,
      termOfAgreement: d.termOfAgreement,
      amountOwed: d.amountOwed,
      weOwn: d.weOwn,
      flaggedForReview: d.flaggedForReview,
      notes: d.notes,
      property: {
        address: d.property.address,
        city: d.property.city,
        state: d.property.state,
        zip: d.property.zip,
      },
    }));

    const activeIds = all.filter((d) => d.stage !== IN_ESCROW_STAGE).map((d) => d.id);
    const inEscrowIds = all.filter((d) => d.stage === IN_ESCROW_STAGE).map((d) => d.id);
    const flagged = all.filter((d) => d.flaggedForReview).length;
    return { all, activeIds, inEscrowIds, flagged };
  }, [deals]);

  if (!isLoaded) {
    return (
      <>
        <PageHeader title="Spread" description="Loading…" />
        <div className="px-6 py-12 text-sm text-[var(--color-text-faint)]">Loading deals…</div>
      </>
    );
  }

  const { all, activeIds, inEscrowIds, flagged } = view;
  return (
    <>
      <PageHeader
        title="Spread"
        description={`${activeIds.length} active · ${inEscrowIds.length} in escrow${
          flagged ? ` · ${flagged} flagged for Richard` : ""
        }`}
      />
      <SpreadStore
        // Keying on the deal-set signature forces a fresh SpreadStore (with a
        // clean undo stack) when the underlying deals change identity — e.g.
        // after addDeal/deleteDeal mutations refresh the provider's deals[].
        key={`${all.length}:${activeIds.join(",")}:${inEscrowIds.join(",")}`}
        initialRows={all}
        activeIds={activeIds}
        inEscrowIds={inEscrowIds}
      >
        <SpreadTable />
      </SpreadStore>
    </>
  );
}
