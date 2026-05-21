import { updateContact, deleteContact, type ContactInput } from "@/lib/server/contacts";
import { jsonOk, notFound, parseBody, withErrorHandler } from "@/lib/server/route-helpers";

type Params = { params: Promise<{ id: string }> };

export const PATCH = withErrorHandler(async (request: Request, { params }: Params) => {
  const { id } = await params;
  const updates = await parseBody<Partial<ContactInput>>(request);
  const updated = await updateContact(id, updates);
  return jsonOk(updated);
});

export const DELETE = withErrorHandler(async (_req: Request, { params }: Params) => {
  const { id } = await params;
  const ok = await deleteContact(id);
  if (!ok) return notFound("Contact");
  return jsonOk({ deleted: true });
});
