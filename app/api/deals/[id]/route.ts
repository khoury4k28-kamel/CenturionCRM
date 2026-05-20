import {
  updateDeal,
  moveDealStage,
  deleteDeal,
  updateSpreadField,
  toggleFlag,
  setFlag,
  setWeOwn,
  setOwed,
  updateAddress,
  type DealUpdateInput,
  type UpdateAddressInput,
} from "@/lib/server/deals";
import { jsonOk, jsonError, notFound, parseBody } from "@/lib/server/route-helpers";
import type { DealStage, SpreadField } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

type PatchBody =
  | ({ kind?: "update" } & DealUpdateInput)
  | { kind: "stage"; stage: DealStage }
  | { kind: "spread-cell"; field: SpreadField; value: string | number | null }
  | { kind: "flag" }
  | { kind: "setFlag"; flagged: boolean }
  | { kind: "weOwn"; value: boolean }
  | { kind: "owed"; raw: string }
  | ({ kind: "address" } & UpdateAddressInput);

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await parseBody<PatchBody>(request);

  switch (body.kind) {
    case "stage": {
      const updated = await moveDealStage(id, body.stage);
      return jsonOk(updated);
    }
    case "spread-cell": {
      const updated = await updateSpreadField(id, body.field, body.value);
      return jsonOk(updated);
    }
    case "flag": {
      const updated = await toggleFlag(id);
      return jsonOk(updated);
    }
    case "setFlag": {
      const updated = await setFlag(id, body.flagged);
      return jsonOk(updated);
    }
    case "weOwn": {
      const updated = await setWeOwn(id, body.value);
      return jsonOk(updated);
    }
    case "owed": {
      const updated = await setOwed(id, body.raw);
      return jsonOk(updated);
    }
    case "address": {
      const { kind: _kind, ...fields } = body;
      const updated = await updateAddress(id, fields);
      return jsonOk(updated);
    }
    case "update":
    case undefined: {
      await updateDeal(id, body as DealUpdateInput);
      return jsonOk({ ok: true });
    }
    default:
      return jsonError(`Unknown patch kind: ${(body as { kind: string }).kind}`);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const ok = await deleteDeal(id);
  if (!ok) return notFound("Deal");
  return jsonOk({ deleted: true });
}
