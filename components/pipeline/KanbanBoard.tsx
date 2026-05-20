"use client";

import { useTransition } from "react";
import Link from "next/link";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragEndEvent,
} from "@dnd-kit/core";
import { toast } from "sonner";
import { DEAL_STAGE_LABELS, DEAL_STAGES, type DealStage } from "@/lib/types";
import { formatMoney, relativeTime, cn } from "@/lib/utils";
import { useData } from "@/contexts/DataContext";

export type KanbanDeal = {
  id: string;
  stage: DealStage;
  askingPrice: string | null;
  ourOffer: string | null;
  updatedAt: string;
  property: { address: string; city: string | null };
  seller: { firstName: string; lastName: string | null } | null;
  taskCount: number;
};

export function KanbanBoard({ deals }: { deals: KanbanDeal[] }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const [, startTransition] = useTransition();
  const { moveDealStage } = useData();

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const dealId = String(active.id);
    const newStage = String(over.id) as DealStage;
    if (!DEAL_STAGES.includes(newStage)) return;

    const deal = deals.find((d) => d.id === dealId);
    if (!deal || deal.stage === newStage) return;

    // Provider does the optimistic update against deals[]; we just toast on the
    // result. Page state re-renders from useData() automatically.
    startTransition(async () => {
      const ok = await moveDealStage(dealId, newStage);
      if (ok) toast.success(`Moved to ${DEAL_STAGE_LABELS[newStage]}`);
    });
  }

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="flex gap-3 overflow-x-auto px-8 py-6 min-h-[calc(100vh-7rem)]">
        {DEAL_STAGES.map((stage) => {
          const items = deals.filter((d) => d.stage === stage);
          return (
            <KanbanColumn key={stage} stage={stage} count={items.length}>
              {items.length === 0 ? (
                <EmptyHint />
              ) : (
                items.map((deal) => <KanbanCard key={deal.id} deal={deal} />)
              )}
            </KanbanColumn>
          );
        })}
      </div>
    </DndContext>
  );
}

function KanbanColumn({
  stage,
  count,
  children,
}: {
  stage: DealStage;
  count: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "w-72 shrink-0 rounded-lg border bg-[var(--color-panel)] flex flex-col",
        isOver ? "border-[var(--color-accent-solid)]" : "border-[var(--color-panel-border)]",
      )}
    >
      <div className="px-3 py-2.5 border-b border-[var(--color-panel-border)] flex items-center justify-between">
        <div className="text-xs font-semibold tracking-tight uppercase">
          {DEAL_STAGE_LABELS[stage]}
        </div>
        <div className="text-[10px] tracking-wider text-[var(--color-text-faint)] font-mono">
          {count}
        </div>
      </div>
      <div className="flex-1 p-2 space-y-2 overflow-y-auto">{children}</div>
    </div>
  );
}

function KanbanCard({ deal }: { deal: KanbanDeal }) {
  const { setNodeRef, attributes, listeners, transform, isDragging } = useDraggable({ id: deal.id });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <Link
      href={`/deals/detail?id=${deal.id}`}
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "block rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-3 hover:border-[var(--color-border-strong)] transition-colors cursor-grab active:cursor-grabbing",
        isDragging && "opacity-50",
      )}
    >
      <div className="text-sm font-medium leading-tight">{deal.property.address}</div>
      {deal.property.city ? (
        <div className="text-xs text-[var(--color-text-faint)] mt-0.5">{deal.property.city}</div>
      ) : null}

      <div className="mt-2.5 flex items-center justify-between text-xs">
        <div className="font-mono text-[var(--color-text)]">
          {formatMoney(deal.askingPrice, { short: true })}
        </div>
        {deal.ourOffer ? (
          <div className="font-mono text-[var(--color-accent)]">
            {formatMoney(deal.ourOffer, { short: true })}
          </div>
        ) : null}
      </div>

      <div className="mt-2 pt-2 border-t border-[var(--color-border)] flex items-center justify-between text-[10px] text-[var(--color-text-faint)]">
        <span>
          {deal.seller ? `${deal.seller.firstName} ${deal.seller.lastName ?? ""}`.trim() : "No seller"}
        </span>
        <span>{relativeTime(deal.updatedAt)}</span>
      </div>

      {deal.taskCount > 0 ? (
        <div className="mt-2 text-[10px] text-[var(--color-accent)]">
          {deal.taskCount} open task{deal.taskCount === 1 ? "" : "s"}
        </div>
      ) : null}
    </Link>
  );
}

function EmptyHint() {
  return (
    <div className="text-[10px] text-[var(--color-text-faint)] text-center py-6">No deals</div>
  );
}
