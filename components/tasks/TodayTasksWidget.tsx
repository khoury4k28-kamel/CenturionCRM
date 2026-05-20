"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useData } from "@/contexts/DataContext";
import { todayAndOverdue } from "@/lib/task-buckets";
import { TaskList } from "./TaskList";
import { TaskQuickAddForm } from "./TaskQuickAddForm";

const VISIBLE_LIMIT = 5;

// Dashboard widget: shows up to 5 overdue+today tasks with full TaskRow
// behavior (toggle, reschedule, deal link). Includes inline quick-add so the
// dashboard can be the daily landing page.
export function TodayTasksWidget() {
  const { tasks } = useData();
  const visible = useMemo(() => {
    const all = todayAndOverdue(tasks);
    return all.slice(0, VISIBLE_LIMIT);
  }, [tasks]);

  const all = useMemo(() => todayAndOverdue(tasks), [tasks]);
  const overflow = all.length - visible.length;

  return (
    <div className="px-8 pt-6 pb-2">
      <div className="rounded-lg border border-[var(--color-panel-border)] bg-[var(--color-panel)]">
        <div className="px-4 pt-3 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold tracking-tight text-[var(--color-accent)]">
              Today
            </span>
            <span className="text-xs text-[var(--color-text-faint)] font-mono">
              {all.length}
            </span>
          </div>
          <Link
            href="/tasks"
            className="text-xs text-[var(--color-text-faint)] hover:text-[var(--color-accent)] inline-flex items-center gap-1 transition-colors"
          >
            All tasks <ArrowRight size={12} />
          </Link>
        </div>
        <div className="px-4 pb-3">
          {visible.length === 0 ? (
            <div className="text-xs text-[var(--color-text-faint)] text-center py-3">
              Nothing due today. Add one to start the day:
            </div>
          ) : (
            <TaskList
              tasks={visible}
              showDealBadge
              compactRows
              emptyHint="Nothing here"
            />
          )}
          {overflow > 0 ? (
            <div className="pt-2 text-[10px] text-[var(--color-text-faint)] uppercase tracking-wider text-center">
              +{overflow} more —{" "}
              <Link
                href="/tasks"
                className="text-[var(--color-accent)] hover:underline"
              >
                view all
              </Link>
            </div>
          ) : null}
        </div>
        <div className="px-3 pb-3">
          <TaskQuickAddForm compact />
        </div>
      </div>
    </div>
  );
}
