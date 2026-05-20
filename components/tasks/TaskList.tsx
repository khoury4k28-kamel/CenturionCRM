"use client";

import { useMemo } from "react";
import { useData } from "@/contexts/DataContext";
import { TaskRow, type TaskRowItem } from "./TaskRow";
import { TaskQuickAddForm } from "./TaskQuickAddForm";
import type { DealStage } from "@/lib/types";

// TaskList renders a flat list of tasks plus (optionally) an inline add form.
// - On /deals/detail: dealId is set, the form pre-fills it, and the deal-context
//   badge/address are hidden (showDealBadge=false).
// - On /tasks (via TasksBoard buckets): dealId is undefined and showDealBadge=true
//   so each row links back to its parent deal.
//
// Team-member drag-drop assignment is preserved inside <TaskRow>.
export function TaskList({
  tasks,
  dealId,
  allowAdd = false,
  showDealBadge = false,
  emptyHint = "No tasks",
  compactRows = false,
}: {
  tasks: TaskRowItem[];
  dealId?: string;
  allowAdd?: boolean;
  showDealBadge?: boolean;
  emptyHint?: string;
  compactRows?: boolean;
}) {
  const { deals } = useData();

  const dealLookup = useMemo(() => {
    const map = new Map<string, { address: string; stage: DealStage }>();
    for (const d of deals) map.set(d.id, { address: d.property.address, stage: d.stage });
    return map;
  }, [deals]);

  return (
    <div className="space-y-2">
      {tasks.length === 0 ? (
        <div className="text-xs text-[var(--color-text-faint)] text-center py-4">
          {emptyHint}
        </div>
      ) : (
        <ul className="space-y-1.5">
          {tasks.map((t) => {
            const deal = t.dealId ? dealLookup.get(t.dealId) : null;
            return (
              <TaskRow
                key={t.id}
                task={t}
                dealAddress={deal?.address ?? null}
                dealStage={deal?.stage ?? null}
                showDealBadge={showDealBadge}
                compact={compactRows}
              />
            );
          })}
        </ul>
      )}

      {allowAdd ? (
        <div className="pt-2">
          <TaskQuickAddForm dealId={dealId ?? null} compact />
        </div>
      ) : null}
    </div>
  );
}
