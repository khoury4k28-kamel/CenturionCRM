"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, X, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useData } from "@/contexts/DataContext";

type TaskItem = {
  id: string;
  title: string;
  dueDate: string | null;
  completedAt: string | null;
  dealId: string | null;
};

export function TaskList({
  tasks,
  dealId,
  allowAdd = false,
}: {
  tasks: TaskItem[];
  dealId?: string;
  allowAdd?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const { addTask, updateTask, deleteTask } = useData();

  function toggle(t: TaskItem) {
    startTransition(async () => {
      // Send the explicit new completedAt — provider does optimistic update
      // against tasks[], so caller pages re-render automatically.
      const nextCompletedAt = t.completedAt ? null : new Date().toISOString();
      await updateTask(t.id, { completedAt: nextCompletedAt });
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      await deleteTask(id);
    });
  }

  function onAdd(form: FormData) {
    const title = String(form.get("title") ?? "").trim();
    const dueDate = String(form.get("dueDate") ?? "") || null;
    if (!title) return;
    startTransition(async () => {
      const newId = await addTask({ title, dueDate, dealId: dealId ?? null });
      if (!newId) return;
      setShowForm(false);
      toast.success("Task added");
    });
  }

  return (
    <div className="space-y-2">
      {tasks.length === 0 ? (
        <div className="text-xs text-[var(--color-text-faint)] text-center py-4">
          No tasks
        </div>
      ) : (
        <ul className="space-y-1.5">
          {tasks.map((t) => {
            const done = !!t.completedAt;
            const overdue = !done && t.dueDate && new Date(t.dueDate) < new Date();
            return (
              <li key={t.id} className="flex items-start gap-2 group">
                <button
                  type="button"
                  onClick={() => toggle(t)}
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
                  <div
                    className={cn(
                      "text-sm",
                      done && "line-through text-[var(--color-text-faint)]",
                    )}
                  >
                    {t.title}
                  </div>
                  {t.dueDate ? (
                    <div
                      className={cn(
                        "text-[10px] mt-0.5",
                        overdue
                          ? "text-[var(--color-danger)]"
                          : "text-[var(--color-text-faint)]",
                      )}
                    >
                      {new Date(t.dueDate).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                      {overdue ? " · overdue" : ""}
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => remove(t.id)}
                  className="opacity-0 group-hover:opacity-100 text-[var(--color-text-faint)] hover:text-[var(--color-danger)] transition-opacity"
                  aria-label="Delete task"
                >
                  <X size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {allowAdd ? (
        showForm ? (
          <form action={onAdd} className="space-y-2 pt-2">
            {dealId ? <input type="hidden" name="dealId" value={dealId} /> : null}
            <Input name="title" placeholder="Task title" required autoFocus />
            <Input name="dueDate" type="date" />
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={pending}>
                Add
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="w-full mt-2 flex items-center gap-1.5 text-xs text-[var(--color-text-faint)] hover:text-[var(--color-accent)] transition-colors"
          >
            <Plus size={12} /> Add task
          </button>
        )
      ) : null}
    </div>
  );
}
