import { prisma } from "@/lib/db";

export type CreateTaskInput = {
  title: string;
  notes?: string | null;
  dueDate?: string | null;
  dealId?: string | null;
};

export async function createTask(input: CreateTaskInput) {
  const title = input.title?.trim();
  if (!title) throw new Error("Title required");
  const due = input.dueDate ? new Date(input.dueDate) : null;
  return prisma.task.create({
    data: {
      title,
      notes: input.notes ?? undefined,
      dueDate: due && !Number.isNaN(due.getTime()) ? due : undefined,
      dealId: input.dealId ?? undefined,
    },
  });
}

export async function toggleTask(id: string) {
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) return undefined;
  return prisma.task.update({
    where: { id },
    data: { completedAt: task.completedAt ? null : new Date() },
  });
}

export type UpdateTaskInput = Partial<{
  title: string;
  dealId: string | null;
  dueDate: string | null;
  completedAt: string | null;
  notes: string | null;
}>;

export async function updateTask(id: string, input: UpdateTaskInput) {
  const data: Record<string, unknown> = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.dealId !== undefined) data.dealId = input.dealId;
  if (input.notes !== undefined) data.notes = input.notes;
  if (input.dueDate !== undefined) {
    if (input.dueDate === null) data.dueDate = null;
    else {
      const d = new Date(input.dueDate);
      data.dueDate = Number.isNaN(d.getTime()) ? null : d;
    }
  }
  if (input.completedAt !== undefined) {
    if (input.completedAt === null) data.completedAt = null;
    else {
      const d = new Date(input.completedAt);
      data.completedAt = Number.isNaN(d.getTime()) ? null : d;
    }
  }
  try {
    return await prisma.task.update({ where: { id }, data });
  } catch {
    return undefined;
  }
}

export async function deleteTask(id: string) {
  try {
    await prisma.task.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}
