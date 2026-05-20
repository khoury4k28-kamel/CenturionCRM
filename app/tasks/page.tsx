"use client";

import { useMemo } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useData } from "@/contexts/DataContext";
import type { TaskDTO } from "@/lib/dto";

type Bucket = { name: string; items: TaskDTO[]; tint?: string };

export default function TasksPage() {
  const { tasks, deals, isLoaded } = useData();

  // Resolve "address by deal id" once for the deal links shown alongside tasks.
  const dealAddressById = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of deals) map.set(d.id, d.property.address);
    return map;
  }, [deals]);

  const groups = useMemo<Bucket[]>(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
    const endOfWeek = new Date(startOfToday.getTime() + 7 * 24 * 60 * 60 * 1000);

    function dueOf(t: TaskDTO): Date | null {
      return t.dueDate ? new Date(t.dueDate) : null;
    }

    const sorted = [...tasks].sort((a, b) => {
      // Mirror the old server orderBy: completedAt asc then dueDate asc.
      const aDone = a.completedAt ?? "";
      const bDone = b.completedAt ?? "";
      if (aDone !== bDone) return aDone.localeCompare(bDone);
      const aDue = a.dueDate ?? "9999";
      const bDue = b.dueDate ?? "9999";
      return aDue.localeCompare(bDue);
    });

    const overdue = sorted.filter((t) => {
      const due = dueOf(t);
      return !t.completedAt && due && due < startOfToday;
    });
    const today = sorted.filter((t) => {
      const due = dueOf(t);
      return !t.completedAt && due && due >= startOfToday && due < endOfToday;
    });
    const thisWeek = sorted.filter((t) => {
      const due = dueOf(t);
      return !t.completedAt && due && due >= endOfToday && due < endOfWeek;
    });
    const later = sorted.filter((t) => {
      const due = dueOf(t);
      return !t.completedAt && (!due || due >= endOfWeek);
    });

    return [
      { name: "Overdue", items: overdue, tint: "text-[var(--color-danger)]" },
      { name: "Today", items: today, tint: "text-[var(--color-accent)]" },
      { name: "This week", items: thisWeek },
      { name: "Later / unscheduled", items: later },
    ];
  }, [tasks]);

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
      <PageHeader title="Tasks" description="Everything you need to do, grouped by urgency." />
      <div className="px-8 py-6 grid grid-cols-2 gap-6">
        {groups.map((g) => (
          <Card key={g.name}>
            <CardHeader>
              <CardTitle className={g.tint}>
                {g.name}{" "}
                <span className="text-[var(--color-text-faint)]">· {g.items.length}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {g.items.length === 0 ? (
                <div className="text-xs text-[var(--color-text-faint)] text-center py-4">
                  Nothing here
                </div>
              ) : (
                <ul className="space-y-2">
                  {g.items.map((t) => {
                    const dueLabel = t.dueDate
                      ? new Date(t.dueDate).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })
                      : null;
                    const dealAddress = t.dealId ? dealAddressById.get(t.dealId) : null;
                    return (
                      <li
                        key={t.id}
                        className="flex items-start justify-between gap-2 group border-b border-[var(--color-panel-border)] pb-2 last:border-b-0 last:pb-0"
                      >
                        <div className="flex-1">
                          <div className="text-sm">{t.title}</div>
                          {dealAddress ? (
                            <Link
                              href={`/deals/detail?id=${t.dealId}`}
                              className="text-xs text-[var(--color-text-faint)] hover:text-[var(--color-accent)]"
                            >
                              {dealAddress}
                            </Link>
                          ) : null}
                        </div>
                        {dueLabel ? (
                          <div className="text-xs text-[var(--color-text-faint)] font-mono">
                            {dueLabel}
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
