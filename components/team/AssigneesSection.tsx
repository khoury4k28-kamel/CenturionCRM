"use client";

// Toggle-pill UI for assigning teammates to a task. Direct port of Mālama PM's
// AssigneesSection. Green pills = assigned, neutral = available. Click to
// toggle.

import { useData } from "@/contexts/DataContext";
import TeamMemberAvatar from "./TeamMemberAvatar";

export default function AssigneesSection({
  taskId,
  assignees,
}: {
  taskId: string;
  assignees: string[];
}) {
  const { teamMembers, assignTask, unassignTask } = useData();
  const assignedMembers = teamMembers.filter((m) => assignees.includes(m.id));
  const unassignedMembers = teamMembers.filter(
    (m) => !assignees.includes(m.id),
  );

  function toggle(memberId: string) {
    if (assignees.includes(memberId)) unassignTask(taskId, memberId);
    else assignTask(taskId, memberId);
  }

  if (teamMembers.length === 0) {
    return (
      <div>
        <span className="text-[10px] uppercase tracking-widest text-[var(--color-text-faint)] font-medium block mb-1.5">
          Assignees
        </span>
        <span className="text-xs text-[var(--color-text-faint)]">
          Sign in to populate teammates.
        </span>
      </div>
    );
  }

  return (
    <div>
      <span className="text-[10px] uppercase tracking-widest text-[var(--color-text-faint)] font-medium block mb-1.5">
        Assignees
      </span>
      <div className="flex flex-wrap gap-1.5">
        {assignedMembers.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => toggle(m.id)}
            className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 text-[var(--color-text)] hover:bg-[var(--color-accent)]/20 transition-colors"
          >
            <TeamMemberAvatar member={m} size={16} />
            {m.name}
            <span className="text-[var(--color-text-faint)] ml-0.5">×</span>
          </button>
        ))}
        {unassignedMembers.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => toggle(m.id)}
            className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border border-[var(--color-panel-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-border-strong)] transition-colors"
          >
            <TeamMemberAvatar member={m} size={16} className="opacity-50" />
            {m.name}
          </button>
        ))}
      </div>
    </div>
  );
}
