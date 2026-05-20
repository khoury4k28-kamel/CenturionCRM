import { uploadTemplate } from "@/lib/server/templates";
import { jsonOk, jsonError } from "@/lib/server/route-helpers";

export async function POST(request: Request) {
  const fd = await request.formData();
  const name = String(fd.get("name") ?? "");
  const description = String(fd.get("description") ?? "");
  const file = fd.get("file");
  if (!(file instanceof File)) return jsonError("File required");
  const created = await uploadTemplate({ name, description, file });
  return jsonOk(created, 201);
}
