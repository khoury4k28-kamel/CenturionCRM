import { createContact, type ContactInput } from "@/lib/server/contacts";
import { jsonOk, parseBody } from "@/lib/server/route-helpers";

export async function POST(request: Request) {
  const body = await parseBody<ContactInput>(request);
  const created = await createContact(body);
  return jsonOk(created, 201);
}
