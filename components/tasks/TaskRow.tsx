"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useData } from "@/contexts/DataContext";
import TeamMemberAvatar from "@/components/team/TeamMemberAvatar";
import { StageBadge } from "@/components/ui/badge";
import { QuickReschedulePopover } from "./QuickReschedulePopover";
import type { DealStage } from "@/lib/types";

export type TaskRowItem = {
  id: string;
  title: string;
  dueDate: string | null;
  completedAt: string | null;
  dealId: string | null;
  assignees?: string[];
};

export function TaskRow({
  task,
  dealAddress,
  dealStage,
  showDealBadge = false,
  compact = false,
}: {
  task: TaskRowItem;
  dealAddress?: string | null;
  dealStage?: DealStage | null;
  showDealBadge?: boolean;
  compact?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const { updateTask, deleteTask, teamMembers, assignTask, unassignTask } = useData();
  const [dragOver, setDragOver] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [rescheduling, setRescheduling] = useState(false);

  const dateRef = useRef<HTMLButtonElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const dateAddRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (editingTitle) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [editingTitle]);

  function beginTitleEdit() {
    if (done) return;
    setTitleDraft(task.title);
    setEditingTitle(true);
  }

  const done = !!task.completedAt;
  const overdue = !done && task.dueDate && new Date(task.dueDate) < startOfToday();
  const assigneeIds = task.assignees ?? [];
  const assignedMembers = teamMembers.filter((m) => assigneeIds.includes(m.id));

  function toggle() {
    startTransition(async () => {
      const next = done ? null : new Date().toISOString();
      await updateTask(task.id, { completedAt: next });
    });
  }

  function remove() {
    startTransition(async () => {
      await deleteTask(task.id);
    });
  }

  function saveTitle() {
    const next = titleDraft.trim();
    setEditingTitle(false);
    if (!next || next === task.title) {
      setTitleDraft(task.title);
      return;
    }
    startTransition(async () => {
      await updateTask(task.id, { title: next });
    });
  }

  function pickDate(iso: string | null) {
    startTransition(async () => {
      await updateTask(task.id, { dueDate: iso });
    });
  }

  return (
    <li
      className={cn(
        "group flex items-start gap-2 rounded-md px-1.5 py-1 -mx-1.5 transition-colors",
        dragOver && "bg-[var(--color-accent)]/10 ring-1 ring-[var(--color-accent)]/40",
      )}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("application/team-member")) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
          setDragOver(true);
        }
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        const memberId = e.dataTransfer.getData("application/team-member");
        setDragOver(false);
        if (!memberId) return;
        e.preventDefault();
        assignTask(task.id, memberId);
        const member = teamMembers.find((m) => m.id === memberId);
        if (member) toast.success(`Assigned to ${member.name}`);
      }}
    >
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        className={cn(
          "mt-0.5 size-4 rounded border flex items-center justify-center shrink-0 transition-colors",
          done
            ? "bg-[var(--color-accent)] border-[var(--color-accent)] text-[var(--color-accent-fg)]"
            : "border-[var(--color-border-strong)] hover:border-[var(--color-accent)]",
        )}
        aria-label={done ? "Mark incomplete" : "Mark complete"}
      >
        {done ? <Check size={10} strokeWidth={3} /> : null}
      </button>

      <div className="flex-1 min-w-0">
        {editingTitle ? (
          <input
            ref={titleInputRef}
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                saveTitle();
              } else if (e.key === "Escape") {
                e.preventDefault();
                setTitleDraft(task.title);
                setEditingTitle(false);
              }
            }}
            className="w-full bg-transparent border-b border-[var(--color-accent)] text-sm focus:outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={beginTitleEdit}
            className={cn(
              "block text-left w-full text-sm leading-snug truncate",
              done && "line-through text-[var(--color-text-faint)] cursor-default",
              !done && "hover:text-[var(--color-accent)] transition-colors",
            )}
            title={done ? task.title : "Click to edit"}
          >
            {task.title}
          </button>
        )}

        {!compact ? (
          <div className="flex items-center gap-2 mt-0.5 min-h-[14px]">
            {showDealBadge && dealStage ? (
              <StageBadge stage={dealStage} className="text-[9px] px-1.5 py-0" />
            ) : null}
            {showDealBadge && dealAddress && task.dealId ? (
              <Link
                href={`/deals/detail?id=${task.dealId}`}
                className="text-[10px] text-[var(--color-text-faint)] hover:text-[var(--color-accent)] truncate transition-colors"
              >
                {dealAddress}
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>

      {assignedMembers.length > 0 ? (
        <div className="flex items-center -space-x-1 shrink-0 mt-0.5">
          {assignedMembers.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => unassignTask(task.id, m.id)}
              title={`${m.name} — click to remove`}
              className="hover:scale-110 transition-transform"
            >
              <TeamMemberAvatar member={m} size={18} ring />
            </button>
          ))}
        </div>
      ) : null}

      {task.dueDate ? (
        <button
          ref={dateRef}
          type="button"
          onClick={() => setRescheduling(true)}
          className={cn(
            "text-[10px] font-mono shrink-0 mt-0.5 px-1.5 py-0.5 rounded hover:bg-[var(--color-bg-hover)] transition-colors",
            overdue ? "text-[var(--color-danger)]" : "text-[var(--color-text-faint)]",
          )}
          title="Click to reschedule"
        >
          {formatShortDate(task.dueDate)}
          {overdue ? " · overdue" : ""}
        </button>
      ) : (
        <button
          ref={dateAddRef}
          type="button"
          onClick={() => setRescheduling(true)}
          className="opacity-0 group-hover:opacity-100 text-[10px] text-[var(--color-text-faint)] hover:text-[var(--color-accent)] shrink-0 mt-0.5 transition-opacity"
          title="Add due date"
        >
          + date
        </button>
      )}

      <QuickReschedulePopover
        anchorRef={task.dueDate ? dateRef : dateAddRef}
        open={rescheduling}
        onClose={() => setRescheduling(false)}
        currentDate={task.dueDate}
        onPick={pickDate}
      />

      <button
        type="button"
        onClick={remove}
        className="opacity-0 group-hover:opacity-100 text-[var(--color-text-faint)] hover:text-[var(--color-danger)] transition-opacity shrink-0 mt-0.5"
        aria-label="Delete task"
      >
        <X size={14} />
      </button>
    </li>
  );
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatShortDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
