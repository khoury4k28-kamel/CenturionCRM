"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { useData } from "@/contexts/DataContext";
import { DealCombobox } from "@/components/ui/deal-combobox";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Inline task-add form used in three contexts:
//   1. /tasks page (no dealId pre-filled, deal picker visible)
//   2. /deals/detail page (dealId pre-filled, deal picker hidden)
//   3. Cmd+Shift+T global overlay (no dealId pre-filled, picker visible, autoFocus)
//
// In all three, the form is "always visible" — there's no expand/collapse step.
// On submit, posts via context.addTask(), clears, and toasts.
export function TaskQuickAddForm({
  dealId,
  autoFocus = false,
  onAdded,
  className,
  compact = false,
}: {
  dealId?: string | null;
  autoFocus?: boolean;
  onAdded?: (newTaskId: string) => void;
  className?: string;
  compact?: boolean;
}) {
  const { addTask, deals } = useData();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [pickedDealId, setPickedDealId] = useState<string | null>(dealId ?? null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) titleRef.current?.focus();
  }, [autoFocus]);

  function submit() {
    const t = title.trim();
    if (!t) return;
    startTransition(async () => {
      const id = await addTask({
        title: t,
        dealId: pickedDealId ?? null,
        dueDate: dueDate || null,
      });
      if (!id) return;
      setTitle("");
      setDueDate("");
      if (!dealId) setPickedDealId(null);
      toast.success("Task added");
      onAdded?.(id);
      // Refocus the title for rapid capture
      requestAnimationFrame(() => titleRef.current?.focus());
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className={cn(
        "rounded-md border border-[var(--color-panel-border)] bg-[var(--color-panel)]",
        className,
      )}
    >
      <div className={cn("flex items-center gap-2", compact ? "px-2 py-1.5" : "px-3 py-2")}>
        <Plus size={14} className="text-[var(--color-text-faint)] shrink-0" />
        <input
          ref={titleRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a task…"
          className="flex-1 bg-transparent text-sm placeholder:text-[var(--color-text-faint)] focus:outline-none"
          autoComplete="off"
        />
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="h-7 px-2 rounded bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-xs font-mono focus:border-[var(--color-accent)] focus:outline-none"
        />
        {!dealId ? (
          <div className="w-[180px] shrink-0">
            <DealCombobox
              value={pickedDealId}
              onChange={setPickedDealId}
              deals={deals}
              placeholder="No deal"
              className="h-7 text-xs"
            />
          </div>
        ) : null}
        <Button
          type="submit"
          size="sm"
          disabled={pending || !title.trim()}
          className="shrink-0"
        >
          Add
        </Button>
      </div>
    </form>
  );
}
