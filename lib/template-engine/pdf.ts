import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { Binding } from "../types";
import { resolveFieldPath, type DealWithRelations } from "./fields";
import { formatValue } from "./formatters";

/**
 * Fill a PDF template with values from a deal.
 *
 * Two paths:
 *   - AcroForm fields: bindings whose token matches an existing form-field name are set via form.fill().
 *   - Visual bindings: bindings with pdfBox stamp a white rectangle over the original text and write the
 *     replacement value on top using Helvetica.
 *
 * Returns the populated PDF as a Buffer.
 */
export async function fillPdf(
  pdfBuffer: Buffer,
  bindings: Binding[],
  deal: DealWithRelations,
): Promise<Buffer> {
  const pdf = await PDFDocument.load(pdfBuffer);
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
      // White rectangle over the original text.
      page.drawRectangle({
        x: b.pdfBox.x,
        y: b.pdfBox.y,
        width: b.pdfBox.width,
        height: b.pdfBox.height,
        color: rgb(1, 1, 1),
      });
      // Stamp new text. Font size approximated from bbox height.
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

  // Flatten form fields so the output is a fixed document.
  form.flatten();

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}
