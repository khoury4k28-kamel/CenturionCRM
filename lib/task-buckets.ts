import type { TaskDTO } from "./dto";

export type TaskBuckets = {
  overdue: TaskDTO[];
  today: TaskDTO[];
  thisWeek: TaskDTO[];
  later: TaskDTO[];
  completed: TaskDTO[];
};

export type BucketKey = keyof TaskBuckets;

function dayBoundaries(now: Date = new Date()) {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
  const endOfWeek = new Date(startOfToday.getTime() + 7 * 24 * 60 * 60 * 1000);
  return { startOfToday, endOfToday, endOfWeek };
}

// Mirror the existing tasks page sort: completedAt asc then dueDate asc.
// Open tasks (empty completedAt) sort before completed ones; within each, earliest due first.
function sortTasks(tasks: TaskDTO[]): TaskDTO[] {
  return [...tasks].sort((a, b) => {
    const aDone = a.completedAt ?? "";
    const bDone = b.completedAt ?? "";
    if (aDone !== bDone) return aDone.localeCompare(bDone);
    const aDue = a.dueDate ?? "9999";
    const bDue = b.dueDate ?? "9999";
    return aDue.localeCompare(bDue);
  });
}

export function bucketTasks(tasks: TaskDTO[], now: Date = new Date()): TaskBuckets {
  const { startOfToday, endOfToday, endOfWeek } = dayBoundaries(now);
  const sorted = sortTasks(tasks);

  const buckets: TaskBuckets = {
    overdue: [],
    today: [],
    thisWeek: [],
    later: [],
    completed: [],
  };

  for (const t of sorted) {
    if (t.completedAt) {
      buckets.completed.push(t);
      continue;
    }
    const due = t.dueDate ? new Date(t.dueDate) : null;
    if (due && due < startOfToday) {
      buckets.overdue.push(t);
    } else if (due && due >= startOfToday && due < endOfToday) {
      buckets.today.push(t);
    } else if (due && due >= endOfToday && due < endOfWeek) {
      buckets.thisWeek.push(t);
    } else {
      buckets.later.push(t);
    }
  }

  return buckets;
}

export function todayAndOverdue(tasks: TaskDTO[], now: Date = new Date()): TaskDTO[] {
  const b = bucketTasks(tasks, now);
  return [...b.overdue, ...b.today];
}
