import { createTask, type CreateTaskInput } from "@/lib/server/tasks";
import { jsonOk, parseBody } from "@/lib/server/route-helpers";

export async function POST(request: Request) {
  const body = await parseBody<CreateTaskInput>(request);
  const created = await createTask(body);
  return jsonOk(created, 201);
}
