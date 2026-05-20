// Browser-safe twin of ../pdf.ts. pdf-lib is environment-agnostic, so the
// only adjustment vs. the server file is that we accept and return Uint8Array
// instead of Node's Buffer.

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { Binding } from "@/lib/types";
import { resolveFieldPath, type DealWithRelations } from "../fields";
import { formatValue } from "../formatters";

export async function fillPdfClient(
  pdfBytes: Uint8Array | ArrayBuffer,
  bindings: Binding[],
  deal: DealWithRelations,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(pdfBytes);
  const helvetica = await pdf.embedFont(StandardFonts.Helvetica);
  const form = pdf.getForm();
  const formFields = new Set(form.getFields().map((f) => f.getName()));

  for (const b of bindings) {
    const raw = resolveFieldPath(b.fieldPath, deal);
    const text = formatValue(raw, b.format);

    if (formFields.has(b.token)) {
      const field = form.getTextField(b.token);
      field.setText(text);
      continue;
    }

    if (b.pdfBox) {
      const page = pdf.getPage(b.pdfBox.page);
      page.drawRectangle({
        x: b.pdfBox.x,
        y: b.pdfBox.y,
        width: b.pdfBox.width,
        height: b.pdfBox.height,
        color: rgb(1, 1, 1),
      });
      const size = Math.max(8, b.pdfBox.height * 0.8);
      page.drawText(text, {
        x: b.pdfBox.x + 1,
        y: b.pdfBox.y + (b.pdfBox.height - size) / 2,
        size,
        font: helvetica,
        color: rgb(0, 0, 0),
      });
    }
  }

  form.flatten();
  return await pdf.save();
}
