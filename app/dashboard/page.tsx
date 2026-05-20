"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { KanbanBoard, type KanbanDeal } from "@/components/pipeline/KanbanBoard";
import { useData } from "@/contexts/DataContext";

export default function DashboardPage() {
  const { deals, contacts, tasks, isLoaded } = useData();

  const kanban: KanbanDeal[] = useMemo(() => {
    // Newest-updated first for the pipeline view.
    const sorted = [...deals].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return sorted.map((d) => {
      const seller = d.sellerId ? contacts.find((c) => c.id === d.sellerId) : null;
      const openTaskCount = tasks.filter(
        (t) => t.dealId === d.id && t.completedAt === null,
      ).length;
      return {
        id: d.id,
        stage: d.stage,
        askingPrice: d.askingPrice !== null ? String(d.askingPrice) : null,
        ourOffer: d.ourOffer !== null ? String(d.ourOffer) : null,
        updatedAt: d.updatedAt,
        property: { address: d.property.address, city: d.property.city },
        seller: seller ? { firstName: seller.firstName, lastName: seller.lastName } : null,
        taskCount: openTaskCount,
      };
    });
  }, [deals, contacts, tasks]);

  const totalActive = kanban.filter((d) => d.stage !== "CLOSED" && d.stage !== "DEAD").length;

  if (!isLoaded) {
    return (
      <>
        <PageHeader title="Pipeline" description="Loading…" />
        <div className="px-8 py-12 text-sm text-[var(--color-text-faint)]">Loading deals…</div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Pipeline"
        description={`${totalActive} active deal${totalActive === 1 ? "" : "s"}`}
        actions={
          <Link href="/deals/new">
            <Button variant="primary" size="md">
              <Plus size={14} strokeWidth={2.5} />
              New deal
            </Button>
          </Link>
        }
      />
      <KanbanBoard deals={kanban} />
    </>
  );
}
