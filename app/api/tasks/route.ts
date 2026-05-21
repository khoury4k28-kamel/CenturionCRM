import { createTask, type CreateTaskInput } from "@/lib/server/tasks";
import { jsonOk, parseBody, withErrorHandler } from "@/lib/server/route-helpers";

export const POST = withErrorHandler(async (request: Request) => {
  const body = await parseBody<CreateTaskInput>(request);
  const created = await createTask(body);
  return jsonOk(created, 201);
});
