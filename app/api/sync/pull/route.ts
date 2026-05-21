import { pullFullState } from "@/lib/server/sync";
import { jsonOk, withErrorHandler } from "@/lib/server/route-helpers";

// Initial-load endpoint for BackendDataProvider. Returns the full app snapshot
// (deals, contacts, tasks, templates, documents) as flat DTOs. Excluded from
// the static export build via the `mv app/api app/_api_excluded` workflow step.
export const GET = withErrorHandler(async () => {
  const state = await pullFullState();
  return jsonOk(state);
});
