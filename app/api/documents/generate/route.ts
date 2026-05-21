import { generateDocument } from "@/lib/server/documents";
import { jsonOk, jsonError, parseBody, withErrorHandler } from "@/lib/server/route-helpers";

type Body = { dealId: string; templateId: string };

export const POST = withErrorHandler(async (request: Request) => {
  const { dealId, templateId } = await parseBody<Body>(request);
  if (!dealId || !templateId) return jsonError("dealId and templateId required");
  const doc = await generateDocument(dealId, templateId);
  return jsonOk(doc, 201);
});
