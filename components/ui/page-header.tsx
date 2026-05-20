import * as React from "react";
import { cn } from "@/lib/utils";

// Top row: title (left) and primary actions (right) on the same baseline so
// the gold "+ New …" button visually aligns with the fixed TopRightPanel pill
// (avatar + settings) sitting at top-5 right-6. Description, when present,
// drops to its own row underneath the title.
// The pr-32 reserves space on the right so the action button never slides
// underneath the floating pill.
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "px-8 py-5 pr-32 border-b border-[var(--color-border)]",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-tight min-w-0 truncate">
          {title}
        </h1>
        {actions ? (
          <div className="flex items-center gap-2 shrink-0">{actions}</div>
        ) : null}
      </div>
      {description ? (
        <p className="text-sm text-[var(--color-text-muted)] mt-1">{description}</p>
      ) : null}
    </div>
  );
}
