"use client";

import { PageHeader } from "@/components/ui/page-header";
import { useData } from "@/contexts/DataContext";
import { TasksBoard } from "@/components/tasks/TasksBoard";
import { ActivityFeed } from "@/components/activity/ActivityFeed";
import { LogActivityForm } from "@/components/activity/LogActivityForm";

// Activity & Tasks — one coherent page with two clearly-labeled regions:
//   • Tasks    — things to do (bucketed: overdue / today / this week / later)
//   • Activity — things that happened (calls, notes, emails + auto system events)
// Previously these lived as a task board with a bolted-on floating rail; the
// in-page column makes the two concepts read as one product.
export default function ActivityAndTasksPage() {
  const { isLoaded, activities, deleteActivity } = useData();

  if (!isLoaded) {
    return (
      <>
        <PageHeader title="Activity & Tasks" description="Loading…" />
        <div className="px-8 py-12 text-sm text-[var(--color-text-faint)]">Loading…</div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Activity & Tasks"
        description="Capture tasks. Log what happened. Today first, all linked to deals."
      />
      <div className="flex items-start">
        {/* Tasks — primary column */}
        <div className="flex-1 min-w-0">
          <TasksBoard />
        </div>

        {/* Activity — secondary column, sticky so it stays in view while the
            task list scrolls. Lives in both data modes (local logs persist to
            localStorage; hosted logs sync via Liveblocks). */}
        <aside className="hidden lg:flex w-[380px] shrink-0 flex-col border-l border-[var(--color-border)] sticky top-0 h-screen">
          <div className="px-5 pt-6 pb-3">
            <h2 className="text-sm font-semibold tracking-tight text-[var(--color-text)]">
              Activity
            </h2>
            <p className="text-xs text-[var(--color-text-faint)] mt-0.5">
              Calls, notes, and what the team did.
            </p>
          </div>
          <div className="px-4 pb-3">
            <LogActivityForm showDealPicker />
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-6">
            <ActivityFeed
              entries={activities}
              onDelete={(id) => void deleteActivity(id)}
              emptyHint="No activity yet — log a call or note above."
            />
          </div>
        </aside>
      </div>
    </>
  );
}
