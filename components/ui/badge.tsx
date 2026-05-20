import * as React from "react";
import { cn } from "@/lib/utils";
import type { DealStage } from "@/lib/types";

const stageColors: Record<DealStage, string> = {
  NEW_LEAD:
    "bg-[var(--stage-new-lead-bg)] text-[var(--stage-new-lead-text)] border-[var(--stage-new-lead-border)]",
  RESEARCHING:
    "bg-[var(--stage-researching-bg)] text-[var(--stage-researching-text)] border-[var(--stage-researching-border)]",
  CONTACTED:
    "bg-[var(--stage-contacted-bg)] text-[var(--stage-contacted-text)] border-[var(--stage-contacted-border)]",
  NEGOTIATING:
    "bg-[var(--stage-negotiating-bg)] text-[var(--stage-negotiating-text)] border-[var(--stage-negotiating-border)]",
  UNDER_AGREEMENT:
    "bg-[var(--stage-under-agreement-bg)] text-[var(--stage-under-agreement-text)] border-[var(--stage-under-agreement-border)]",
  IN_ESCROW:
    "bg-[var(--stage-in-escrow-bg)] text-[var(--stage-in-escrow-text)] border-[var(--stage-in-escrow-border)]",
  LISTED:
    "bg-[var(--stage-listed-bg)] text-[var(--stage-listed-text)] border-[var(--stage-listed-border)]",
  CLOSED:
    "bg-[var(--stage-closed-bg)] text-[var(--stage-closed-text)] border-[var(--stage-closed-border)]",
  DEAD:
    "bg-[var(--stage-dead-bg)] text-[var(--stage-dead-text)] border-[var(--stage-dead-border)]",
};

export function StageBadge({ stage, className }: { stage: DealStage; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider border",
        stageColors[stage],
        className,
      )}
    >
      {stage.replace(/_/g, " ")}
    </span>
  );
}

export function Badge({
  children,
  className,
  variant = "default",
}: {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "muted" | "accent";
}) {
  const variants: Record<string, string> = {
    default: "bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] border-[var(--color-border)]",
    muted: "bg-transparent text-[var(--color-text-faint)] border-[var(--color-border)]",
    accent: "bg-[var(--color-accent)]/10 text-[var(--color-accent)] border-[var(--color-accent)]/30",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider border",
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
