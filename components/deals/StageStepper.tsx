"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { DEAL_STAGE_LABELS, type DealStage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useData } from "@/contexts/DataContext";
import { emitStageChanged } from "@/lib/stage-task-events";

// Stages that represent the linear "happy path"; CLOSED and DEAD are terminal
// and shown separately.
const LINEAR: DealStage[] = [
  "NEW_LEAD",
  "RESEARCHING",
  "CONTACTED",
  "NEGOTIATING",
  "UNDER_AGREEMENT",
  "IN_ESCROW",
  "LISTED",
];

export function StageStepper({ dealId, current }: { dealId: string; current: DealStage }) {
  const [pending, startTransition] = useTransition();
  const { moveDealStage } = useData();

  function setStage(stage: DealStage) {
    if (stage === current) return;
    const fromStage = current;
    startTransition(async () => {
      const ok = await moveDealStage(dealId, stage);
      if (ok) {
        toast.success(`Stage: ${DEAL_STAGE_LABELS[stage]}`);
        emitStageChanged({ dealId, fromStage, toStage: stage });
      }
    });
  }

  const currentIndex = LINEAR.indexOf(current);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1.5 flex-wrap">
        {LINEAR.map((stage, i) => {
          const isCurrent = stage === current;
          const isDone = currentIndex > -1 && i < currentIndex;
          return (
            <button
              key={stage}
              type="button"
              onClick={() => setStage(stage)}
              disabled={pending}
              className={cn(
                "h-7 px-2.5 rounded-md text-xs font-medium tracking-tight border transition-colors flex items-center gap-1.5",
                isCurrent &&
                  "bg-[var(--color-accent-solid)] text-[var(--color-accent-fg)] border-[var(--color-accent-solid)]",
                !isCurrent && isDone &&
                  "bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] border-[var(--color-border)]",
                !isCurrent && !isDone &&
                  "bg-transparent text-[var(--color-text-faint)] border-[var(--color-border)] hover:text-[var(--color-text)] hover:border-[var(--color-border-strong)]",
              )}
            >
              {isDone ? <Check size={12} strokeWidth={2.5} /> : null}
              {DEAL_STAGE_LABELS[stage]}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2 text-xs text-[var(--color-text-faint)]">
        <span>Or mark as</span>
        <button
          type="button"
          onClick={() => setStage("CLOSED")}
          disabled={pending}
          className={cn(
            "px-2 py-0.5 rounded text-[10px] uppercase tracking-wider border transition-colors",
            current === "CLOSED"
              ? "bg-[var(--stage-closed-bg)] text-[var(--stage-closed-text)] border-[var(--stage-closed-border)]"
              : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--stage-closed-border)] hover:text-[var(--stage-closed-text)]",
          )}
        >
          Closed
        </button>
        <button
          type="button"
          onClick={() => setStage("DEAD")}
          disabled={pending}
          className={cn(
            "px-2 py-0.5 rounded text-[10px] uppercase tracking-wider border transition-colors",
            current === "DEAD"
              ? "bg-[var(--stage-dead-bg)] text-[var(--stage-dead-text)] border-[var(--stage-dead-border)]"
              : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--stage-dead-border)] hover:text-[var(--stage-dead-text)]",
          )}
        >
          Dead
        </button>
      </div>
    </div>
  );
}
