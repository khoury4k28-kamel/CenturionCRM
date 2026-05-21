import { createContact, type ContactInput } from "@/lib/server/contacts";
import { jsonOk, parseBody, withErrorHandler } from "@/lib/server/route-helpers";

export const POST = withErrorHandler(async (request: Request) => {
  const body = await parseBody<ContactInput>(request);
  const created = await createContact(body);
  return jsonOk(created, 201);
});
