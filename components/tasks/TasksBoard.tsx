"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useData } from "@/contexts/DataContext";
import { bucketTasks, type BucketKey } from "@/lib/task-buckets";
import { TaskList } from "./TaskList";
import { TaskQuickAddForm } from "./TaskQuickAddForm";
import { cn } from "@/lib/utils";

const BUCKET_LABELS: Record<BucketKey, string> = {
  overdue: "Overdue",
  today: "Today",
  thisWeek: "This week",
  later: "Later / unscheduled",
  completed: "Completed",
};

const DEFAULT_COLLAPSED: Record<BucketKey, boolean> = {
  overdue: false,
  today: false,
  thisWeek: true,
  later: true,
  completed: true,
};

const STORAGE_KEY = "centurion.tasks.collapsed";

// Read collapse state lazily on first mount. Safe from hydration mismatch
// because <TasksBoard> only mounts after the parent's isLoaded gate flips —
// by then the server-rendered "Loading…" branch has already hydrated.
function readInitialCollapsed(): Record<BucketKey, boolean> {
  if (typeof window === "undefined") return DEFAULT_COLLAPSED;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_COLLAPSED;
    const parsed = JSON.parse(raw) as Partial<Record<BucketKey, boolean>>;
    return { ...DEFAULT_COLLAPSED, ...parsed };
  } catch {
    return DEFAULT_COLLAPSED;
  }
}

function useCollapsedBuckets() {
  const [collapsed, setCollapsed] = useState<Record<BucketKey, boolean>>(readInitialCollapsed);

  function toggle(key: BucketKey) {
    setCollapsed((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Storage may be disabled (Safari private mode) — keep the in-memory state
      }
      return next;
    });
  }

  return { collapsed, toggle };
}

export function TasksBoard() {
  const { tasks } = useData();
  const { collapsed, toggle } = useCollapsedBuckets();
  const buckets = useMemo(() => bucketTasks(tasks), [tasks]);

  const order: BucketKey[] = ["overdue", "today", "thisWeek", "later", "completed"];

  const tints: Partial<Record<BucketKey, string>> = {
    overdue: "text-[var(--color-danger)]",
    today: "text-[var(--color-accent)]",
  };

  return (
    <div className="px-8 py-6 space-y-6 max-w-4xl">
      <TaskQuickAddForm autoFocus={false} className="shadow-sm" />

      <div className="space-y-4">
        {order.map((key) => {
          const items = buckets[key];
          if (key === "completed" && items.length === 0) return null;
          const isCollapsed = collapsed[key];
          return (
            <section
              key={key}
              className="rounded-lg border border-[var(--color-panel-border)] bg-[var(--color-panel)]"
            >
              <button
                type="button"
                onClick={() => toggle(key)}
                className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-[var(--color-bg-hover)] transition-colors rounded-t-lg"
              >
                <div className="flex items-center gap-2">
                  {isCollapsed ? (
                    <ChevronRight size={14} className="text-[var(--color-text-faint)]" />
                  ) : (
                    <ChevronDown size={14} className="text-[var(--color-text-faint)]" />
                  )}
                  <span
                    className={cn(
                      "text-sm font-semibold tracking-tight",
                      tints[key] ?? "text-[var(--color-text)]",
                    )}
                  >
                    {BUCKET_LABELS[key]}
                  </span>
                  <span className="text-xs text-[var(--color-text-faint)] font-mono">
                    {items.length}
                  </span>
                </div>
              </button>
              {!isCollapsed ? (
                <div className="px-4 pb-3">
                  <TaskList
                    tasks={items}
                    showDealBadge
                    emptyHint={
                      key === "overdue"
                        ? "Nothing overdue — nice."
                        : key === "today"
                          ? "Nothing due today."
                          : key === "completed"
                            ? "No completed tasks yet."
                            : "Nothing here."
                    }
                  />
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}
