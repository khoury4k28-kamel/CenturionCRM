import { prisma } from "@/lib/db";
import { saveUpload, readUploadByUrl, saveBuffer } from "@/lib/upload";
import { tokenizeDocx } from "@/lib/template-engine/docx";
import type { Binding, TemplateFormat } from "@/lib/types";

function detectFormat(filename: string): TemplateFormat | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".docx")) return "DOCX";
  if (lower.endsWith(".pdf")) return "PDF";
  return null;
}

export type UploadTemplateInput = {
  name: string;
  description?: string | null;
  file: File;
};

export async function uploadTemplate({ name, description, file }: UploadTemplateInput) {
  const trimmed = name?.trim();
  if (!trimmed) throw new Error("Name required");
  const format = detectFormat(file.name);
  if (!format) throw new Error("Only .docx and .pdf are supported");
  const { url } = await saveUpload(file, "template");
  return prisma.template.create({
    data: {
      name: trimmed,
      description: description?.trim() || null,
      format,
      originalFileUrl: url,
      bindings: "[]",
    },
  });
}

export async function saveTemplateBindings(templateId: string, bindings: Binding[]) {
  const template = await prisma.template.findUnique({ where: { id: templateId } });
  if (!template) throw new Error("Template not found");

  let tokenizedFileUrl = template.tokenizedFileUrl ?? null;
  if (template.format === "DOCX") {
    const originalBuf = await readUploadByUrl(template.originalFileUrl);
    const tokenizedBuf = tokenizeDocx(originalBuf, bindings);
    const filename = `tokenized_${templateId}_${Date.now()}.docx`;
    const { url } = await saveBuffer(tokenizedBuf, filename);
    tokenizedFileUrl = url;
  }

  return prisma.template.update({
    where: { id: templateId },
    data: {
      bindings: JSON.stringify(bindings),
      tokenizedFileUrl,
    },
  });
}

export async function deleteTemplate(id: string) {
  try {
    await prisma.template.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}
