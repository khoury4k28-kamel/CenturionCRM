import {
  createDeal,
  createSpreadRow,
  type DealCreateInput,
} from "@/lib/server/deals";
import { jsonOk, jsonError, parseBody } from "@/lib/server/route-helpers";

type PostBody =
  | ({ kind?: "full" } & DealCreateInput)
  | { kind: "spread"; section: "ACTIVES" | "IN_ESCROW"; address: string };

export async function POST(request: Request) {
  const body = await parseBody<PostBody>(request);
  if (body.kind === "spread") {
    const created = await createSpreadRow(body.section, body.address);
    return jsonOk(created, 201);
  }
  // default = "full"
  const created = await createDeal(body as DealCreateInput);
  return jsonOk(created, 201);
}

export function GET() {
  return jsonError("Listing not implemented; read deals via server components.", 405);
}
