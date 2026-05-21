"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { SpreadTable } from "@/components/spread/SpreadTable";
import { SpreadStore } from "@/components/spread/SpreadStore";
import type { SpreadDeal } from "@/components/spread/types";
import { useData } from "@/contexts/DataContext";
import DealPanelContext from "@/contexts/DealPanelContext";
import { SidePanel } from "@/components/ui/side-panel";
import { DealDetailPanel } from "@/components/deals/DealDetailPanel";
import { DealCreateModal } from "@/components/deals/DealCreateModal";

const IN_ESCROW_STAGE = "IN_ESCROW";
const HIDDEN_STAGES = new Set(["CLOSED", "DEAD"]);

export default function SpreadPage() {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader title="Pipeline" description="Loading…" />
          <div className="px-6 py-12 text-sm text-[var(--color-text-faint)]">
            Loading deals…
          </div>
        </>
      }
    >
      <SpreadPageInner />
    </Suspense>
  );
}

function SpreadPageInner() {
  const { deals, isLoaded } = useData();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Initialize from URL so deep links open the panel on first paint.
  const [selectedId, setSelectedId] = useState<string | null>(
    () => searchParams.get("selectedId"),
  );

  // Create-modal state lives at the page level so a single "+ Add deal"
  // button in the page header drives one modal — no per-section duplication.
  const [createOpen, setCreateOpen] = useState(false);
  // After a successful create, we hold the new id briefly so an effect can
  // scroll its row into view once the spread re-renders with the new data.
  const [pendingScrollId, setPendingScrollId] = useState<string | null>(null);

  // Mirror state → URL (?selectedId=...) so reload / link sharing reopens
  // the same panel. `scroll: false` keeps the spread's scroll position.
  useEffect(() => {
    const current = searchParams.get("selectedId");
    if (current === selectedId) return;
    const params = new URLSearchParams(searchParams.toString());
    if (selectedId) params.set("selectedId", selectedId);
    else params.delete("selectedId");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [selectedId, searchParams, router, pathname]);

  const openPanel = useCallback((id: string) => setSelectedId(id), []);
  const closePanel = useCallback(() => setSelectedId(null), []);

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

  // Scroll to a newly-created deal once the SpreadStore re-renders with the
  // new row in the DOM. SpreadStore re-keys on the deal-set signature
  // (see `key={...}` below), so the new row isn't in the DOM until after
  // this effect re-runs with the updated `view`. The small setTimeout lets
  // the remounted tbody paint before we query for the row.
  useEffect(() => {
    if (!pendingScrollId) return;
    const t = setTimeout(() => {
      const el = document.querySelector<HTMLElement>(
        `tr[data-deal-id="${pendingScrollId}"]`,
      );
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.style.transition = "background-color 0.4s";
        el.style.backgroundColor = "color-mix(in oklab, var(--color-accent) 18%, transparent)";
        setTimeout(() => {
          el.style.backgroundColor = "";
        }, 1500);
      }
      setPendingScrollId(null);
    }, 80);
    return () => clearTimeout(t);
  }, [pendingScrollId, view]);

  if (!isLoaded) {
    return (
      <>
        <PageHeader title="Pipeline" description="Loading…" />
        <div className="px-6 py-12 text-sm text-[var(--color-text-faint)]">Loading deals…</div>
      </>
    );
  }

  const { all, activeIds, inEscrowIds, flagged } = view;
  return (
    <DealPanelContext.Provider value={{ selectedId, open: openPanel, close: closePanel }}>
      <PageHeader
        title="Pipeline"
        description={`${activeIds.length} active · ${inEscrowIds.length} in escrow${
          flagged ? ` · ${flagged} flagged for Richard` : ""
        }`}
        actions={
          <Button
            variant="primary"
            size="md"
            onClick={() => setCreateOpen(true)}
          >
            <Plus size={14} strokeWidth={2} />
            Add deal
          </Button>
        }
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
        <SidePanel
          open={!!selectedId}
          onOpenChange={(o) => {
            if (!o) closePanel();
          }}
        >
          <DealDetailPanel dealId={selectedId} onClose={closePanel} />
        </SidePanel>
      </SpreadStore>
      <DealCreateModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(id) => setPendingScrollId(id)}
      />
    </DealPanelContext.Provider>
  );
}
