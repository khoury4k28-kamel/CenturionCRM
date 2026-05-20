"use client";

import { X } from "lucide-react";
import type { Binding } from "@/lib/types";

export function BindingsList({
  bindings,
  onRemove,
}: {
  bindings: Binding[];
  onRemove: (index: number) => void;
}) {
  if (bindings.length === 0) {
    return (
      <div className="text-xs text-[var(--color-text-faint)] text-center py-6 border border-dashed border-[var(--color-border)] rounded-md">
        No bindings yet. Highlight a value in the document on the left to start.
      </div>
    );
  }

  return (
    <ul className="space-y-1.5">
      {bindings.map((b, i) => (
        <li
          key={`${b.token}-${i}`}
          className="border border-[var(--color-border)] rounded-md p-2 text-xs flex items-start justify-between gap-2 bg-[var(--color-bg-elevated)]"
        >
          <div className="min-w-0 flex-1">
            <div className="font-mono truncate text-[var(--color-text-muted)]">
              "{b.originalText}"
            </div>
            <div className="mt-1 text-[var(--color-accent)] truncate">→ {b.label ?? b.fieldPath}</div>
            <div className="text-[10px] text-[var(--color-text-faint)] mt-0.5">{b.format}</div>
          </div>
          <button
            type="button"
            onClick={() => onRemove(i)}
            className="text-[var(--color-text-faint)] hover:text-[var(--color-danger)] mt-0.5"
            aria-label="Remove binding"
          >
            <X size={14} />
          </button>
        </li>
      ))}
    </ul>
  );
}
