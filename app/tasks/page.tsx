"use client";

import { PageHeader } from "@/components/ui/page-header";
import { useData } from "@/contexts/DataContext";
import { TasksBoard } from "@/components/tasks/TasksBoard";

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
    </>
  );
}
