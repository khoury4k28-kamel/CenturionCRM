import { toggleTask, deleteTask, updateTask, type UpdateTaskInput } from "@/lib/server/tasks";
import { jsonOk, notFound, parseBody, withErrorHandler } from "@/lib/server/route-helpers";

type Params = { params: Promise<{ id: string }> };

type PatchBody =
  | { action: "toggle" }
  | UpdateTaskInput;

export const PATCH = withErrorHandler(async (request: Request, { params }: Params) => {
  const { id } = await params;
  const body = await parseBody<PatchBody>(request);
  if ("action" in body && body.action === "toggle") {
    const updated = await toggleTask(id);
    if (!updated) return notFound("Task");
    return jsonOk(updated);
  }
  // Generic field update — used by the BackendDataProvider.updateTask path.
  const updated = await updateTask(id, body as UpdateTaskInput);
  if (!updated) return notFound("Task");
  return jsonOk(updated);
});

export const DELETE = withErrorHandler(async (_req: Request, { params }: Params) => {
  const { id } = await params;
  const ok = await deleteTask(id);
  if (!ok) return notFound("Task");
  return jsonOk({ deleted: true });
});
