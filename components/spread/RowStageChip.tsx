"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { DEAL_STAGES, DEAL_STAGE_LABELS, type DealStage } from "@/lib/types";
import { useData } from "@/contexts/DataContext";
import { emitStageChanged } from "@/lib/stage-task-events";
import { cn } from "@/lib/utils";

// Compact native-select stage picker used per-row in the spread. Surfaces
// the stage transition that was previously buried in the detail panel's
// StageStepper. Native select keeps keyboard accessibility free and avoids
// owning a custom dropdown's open-state, positioning, and outside-click logic.
export function RowStageChip({ dealId, stage }: { dealId: string; stage: DealStage }) {
  const [pending, startTransition] = useTransition();
  const { moveDealStage } = useData();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as DealStage;
    if (next === stage) return;
    const fromStage = stage;
    startTransition(async () => {
      const ok = await moveDealStage(dealId, next);
      if (ok) {
        toast.success(`Moved to ${DEAL_STAGE_LABELS[next]}`);
        emitStageChanged({ dealId, fromStage, toStage: next });
      }
    });
  }

  return (
    <select
      value={stage}
      onChange={onChange}
      disabled={pending}
      aria-label="Change deal stage"
      className={cn(
        "h-6 w-full max-w-[110px] mx-auto px-1.5 text-[10px] font-medium uppercase tracking-wider",
        "rounded border border-transparent bg-transparent",
        "text-[var(--color-text-muted)] hover:border-[var(--color-border)] hover:text-[var(--color-text)]",
        "focus:border-[var(--color-accent)] focus:outline-none",
        "cursor-pointer disabled:opacity-50 disabled:cursor-wait",
      )}
    >
      {DEAL_STAGES.map((s) => (
        <option key={s} value={s}>
          {DEAL_STAGE_LABELS[s]}
        </option>
      ))}
    </select>
  );
}
