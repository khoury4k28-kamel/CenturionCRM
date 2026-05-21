import { createDeal, type DealCreateInput } from "@/lib/server/deals";
import { jsonOk, jsonError, parseBody, withErrorHandler } from "@/lib/server/route-helpers";

export const POST = withErrorHandler(async (request: Request) => {
  const body = await parseBody<DealCreateInput>(request);
  const created = await createDeal(body);
  return jsonOk(created, 201);
});

export function GET() {
  return jsonError("Listing not implemented; read deals via server components.", 405);
}
