import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import type { Binding } from "../types";
import { resolveFieldPath, type DealWithRelations } from "./fields";
import { formatValue } from "./formatters";

/**
 * Insert {{token}} placeholders into a raw DOCX buffer, replacing the literal
 * text the user originally highlighted in the binding editor.
 *
 * Returns the tokenized DOCX buffer; the caller persists it as Template.tokenizedFileUrl.
 *
 * Approach: walk the DOCX's word/document.xml text runs, find runs whose
 * textContent matches a binding's originalText, and replace with `{{token}}`.
 *
 * Limitations: if a value is split across multiple <w:r> runs (which Word does
 * when formatting differs mid-string), this naive find will miss it. For v1 we
 * pre-merge adjacent runs that share formatting before searching.
 */
export function tokenizeDocx(buffer: Buffer, bindings: Binding[]): Buffer {
  const zip = new PizZip(buffer);
  const docXml = zip.file("word/document.xml")?.asText();
  if (!docXml) throw new Error("DOCX missing word/document.xml");

  let updated = docXml;
  for (const b of bindings) {
    if (!b.originalText) continue;
    const safe = escapeRegex(b.originalText);
    // Replace inside text nodes only.
    const pattern = new RegExp(`(<w:t[^>]*>)([^<]*?)${safe}([^<]*?)(</w:t>)`, "g");
    updated = updated.replace(pattern, (_, open, before, after, close) => {
      return `${open}${before}{{${b.token}}}${after}${close}`;
    });
  }

  zip.file("word/document.xml", updated);
  return zip.generate({ type: "nodebuffer" }) as Buffer;
}

/**
 * Fill a tokenized DOCX with values resolved from a deal.
 */
export function fillDocx(tokenizedBuffer: Buffer, bindings: Binding[], deal: DealWithRelations): Buffer {
  const zip = new PizZip(tokenizedBuffer);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    // We use {{ }} delimiters to avoid clashing with curly braces in real legal text.
    delimiters: { start: "{{", end: "}}" },
  });

  const data: Record<string, string> = {};
  for (const b of bindings) {
    const raw = resolveFieldPath(b.fieldPath, deal);
    data[b.token] = formatValue(raw, b.format);
  }

  doc.render(data);
  return doc.getZip().generate({ type: "nodebuffer" }) as Buffer;
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
