import { prisma } from "@/lib/db";
import { readUploadByUrl, saveBuffer } from "@/lib/upload";
import { fillDocx } from "@/lib/template-engine/docx";
import { fillPdf } from "@/lib/template-engine/pdf";
import type { Binding } from "@/lib/types";

function safeParseBindings(s: string): Binding[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? (v as Binding[]) : [];
  } catch {
    return [];
  }
}

export async function generateDocument(dealId: string, templateId: string) {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: { property: true, seller: true, realtor: true },
  });
  if (!deal) throw new Error("Deal not found");
  const template = await prisma.template.findUnique({ where: { id: templateId } });
  if (!template) throw new Error("Template not found");

  const bindings = safeParseBindings(template.bindings);
  const dealForResolver = {
    askingPrice: deal.askingPrice?.toString() ?? null,
    ourOffer: deal.ourOffer?.toString() ?? null,
    agreedPrice: deal.agreedPrice?.toString() ?? null,
    agreementType: deal.agreementType,
    source: deal.source,
    notes: deal.notes,
    stage: deal.stage,
    property: deal.property as unknown as Record<string, unknown>,
    seller: deal.seller as unknown as { firstName?: string; lastName?: string } | null,
    realtor: deal.realtor as unknown as { firstName?: string; lastName?: string } | null,
  };

  let resultUrl: string;
  if (template.format === "DOCX") {
    if (!template.tokenizedFileUrl) {
      throw new Error(
        "This DOCX template hasn't been tokenized yet — open the bindings editor and click Save first.",
      );
    }
    const tokenized = await readUploadByUrl(template.tokenizedFileUrl);
    const filled = fillDocx(tokenized, bindings, dealForResolver);
    const filename = `doc_${dealId}_${Date.now()}.docx`;
    resultUrl = (await saveBuffer(filled, filename)).url;
  } else {
    const original = await readUploadByUrl(template.originalFileUrl);
    const filled = await fillPdf(original, bindings, dealForResolver);
    const filename = `doc_${dealId}_${Date.now()}.pdf`;
    resultUrl = (await saveBuffer(filled, filename)).url;
  }

  return prisma.document.create({
    data: { dealId, templateId, fileUrl: resultUrl, status: "DRAFT" },
  });
}
