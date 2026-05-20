import { pullFullState } from "@/lib/server/sync";
import { jsonOk } from "@/lib/server/route-helpers";
import { NextResponse } from "next/server";

// Initial-load endpoint for BackendDataProvider. Returns the full app snapshot
// (deals, contacts, tasks, templates, documents) as flat DTOs. Excluded from
// the static export build via the `mv app/api app/_api_excluded` workflow step.
export async function GET() {
  try {
    const state = await pullFullState();
    return jsonOk(state);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load state";
    console.error("[/api/sync/pull]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
