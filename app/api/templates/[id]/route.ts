import { saveTemplateBindings, deleteTemplate } from "@/lib/server/templates";
import { jsonOk, notFound, parseBody } from "@/lib/server/route-helpers";
import type { Binding } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

type PatchBody = { bindings: Binding[] };

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const { bindings } = await parseBody<PatchBody>(request);
  const updated = await saveTemplateBindings(id, bindings);
  return jsonOk(updated);
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const ok = await deleteTemplate(id);
  if (!ok) return notFound("Template");
  return jsonOk({ deleted: true });
}
