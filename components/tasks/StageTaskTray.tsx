"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { X, Check } from "lucide-react";
import { toast } from "sonner";
import { useData } from "@/contexts/DataContext";
import {
  getSuggestionsForStage,
  dueDateForTemplate,
  type StageTaskTemplate,
} from "@/lib/stage-tasks";
import { DEAL_STAGE_LABELS, type DealStage } from "@/lib/types";
import { cn } from "@/lib/utils";

const AUTO_DISMISS_MS = 12_000;

export function StageTaskTray({
  dealId,
  toStage,
  onClose,
}: {
  dealId: string;
  toStage: DealStage;
  onClose: () => void;
}) {
  const { deals, addTask } = useData();
  const [pending, startTransition] = useTransition();

  const suggestions = useMemo(() => getSuggestionsForStage(toStage), [toStage]);
  const [checked, setChecked] = useState<Set<number>>(
    () => new Set(suggestions.map((_, i) => i)),
  );
  const [now] = useState(() => new Date());
  const deal = deals.find((d) => d.id === dealId);

  useEffect(() => {
    const t = setTimeout(onClose, AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [onClose]);

  function toggle(idx: number) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function addAll() {
    const picks: StageTaskTemplate[] = suggestions.filter((_, i) => checked.has(i));
    if (picks.length === 0) {
      onClose();
      return;
    }
    startTransition(async () => {
      let created = 0;
      for (const p of picks) {
        const id = await addTask({
          title: p.title,
          dealId,
          dueDate: dueDateForTemplate(p, now),
        });
        if (id) created += 1;
      }
      toast.success(`Added ${created} task${created === 1 ? "" : "s"}`);
      onClose();
    });
  }

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-label={`Suggested tasks for ${DEAL_STAGE_LABELS[toStage]}`}
      className="fixed bottom-6 right-6 z-50 w-[360px] rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-panel)] shadow-xl animate-slide-in-right"
      style={{
        animation: "slideInRight 200ms ease-out",
      }}
    >
      <div className="px-4 pt-3 pb-2 flex items-start justify-between gap-2 border-b border-[var(--color-panel-border)]">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wider text-[var(--color-text-faint)]">
            Moved to {DEAL_STAGE_LABELS[toStage]}
          </div>
          <div className="text-sm font-semibold text-[var(--color-text)] truncate">
            Add tasks for {deal?.property.address ?? "this deal"}?
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-[var(--color-text-faint)] hover:text-[var(--color-text)] shrink-0"
          aria-label="Dismiss"
        >
          <X size={16} />
        </button>
      </div>

      <ul className="px-4 py-2 space-y-1.5 max-h-64 overflow-y-auto">
        {suggestions.map((s, i) => {
          const isChecked = checked.has(i);
          const due = dueDateForTemplate(s, now);
          return (
            <li key={i}>
              <button
                type="button"
                onClick={() => toggle(i)}
                className="w-full flex items-start gap-2 py-1 px-1 -mx-1 rounded hover:bg-[var(--color-bg-hover)] text-left transition-colors"
              >
                <div
                  className={cn(
                    "mt-0.5 size-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                    isChecked
                      ? "bg-[var(--color-accent)] border-[var(--color-accent)] text-[var(--color-accent-fg)]"
                      : "border-[var(--color-border-strong)]",
                  )}
                >
                  {isChecked ? <Check size={10} strokeWidth={3} /> : null}
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className={cn(
                      "text-sm",
                      !isChecked && "text-[var(--color-text-faint)] line-through",
                    )}
                  >
                    {s.title}
                  </div>
                  <div className="text-[10px] text-[var(--color-text-faint)] font-mono">
                    due {formatShortDate(due)}
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="px-4 py-3 flex items-center justify-end gap-2 border-t border-[var(--color-panel-border)]">
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className="text-xs px-3 py-1.5 rounded text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] transition-colors"
        >
          Dismiss
        </button>
        <button
          type="button"
          onClick={addAll}
          disabled={pending || checked.size === 0}
          className="text-xs px-3 py-1.5 rounded bg-[var(--color-accent-solid)] text-[var(--color-accent-fg)] hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-50"
        >
          Add {checked.size} task{checked.size === 1 ? "" : "s"}
        </button>
      </div>
    </div>
  );
}

function formatShortDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
