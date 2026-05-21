"use client";

import { PageHeader } from "@/components/ui/page-header";
import { useData } from "@/contexts/DataContext";
import { TasksBoard } from "@/components/tasks/TasksBoard";
import ActivityRailMount from "@/components/activity/ActivityRailMount";

export default function TasksPage() {
  const { isLoaded } = useData();

  if (!isLoaded) {
    return (
      <>
        <PageHeader title="Tasks" description="Loading…" />
        <div className="px-8 py-12 text-sm text-[var(--color-text-faint)]">Loading tasks…</div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Tasks"
        description="Capture quickly. Today first. Linked to deals."
      />
      <TasksBoard />
      {/* Activity transcript lives only on the Tasks page — the rail is
          fixed-positioned so it visually anchors to the viewport's right edge
          regardless of where it mounts in the tree. Gated on isLiveblocksEnabled
          inside the Mount wrapper, so local single-user mode stays clean. */}
      <ActivityRailMount />
    </>
  );
}
