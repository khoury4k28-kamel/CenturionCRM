// Browser-safe twin of ../docx.ts. Same algorithm, swaps Buffer → Uint8Array
// and zip.generate({type:"nodebuffer"}) → "uint8array" so the bundle works
// inside Liveblocks-mode (static export, no Node runtime).
//
// PizZip + docxtemplater both work unchanged in the browser; pdf-lib is
// natively browser-friendly. Only this thin adapter is needed.

import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import type { Binding } from "@/lib/types";
import { resolveFieldPath, type DealWithRelations } from "../fields";
import { formatValue } from "../formatters";

export function tokenizeDocxClient(
  bytes: Uint8Array | ArrayBuffer,
  bindings: Binding[],
): Uint8Array {
  const zip = new PizZip(bytes);
  const docXml = zip.file("word/document.xml")?.asText();
  if (!docXml) throw new Error("DOCX missing word/document.xml");

  let updated = docXml;
  for (const b of bindings) {
    if (!b.originalText) continue;
    const safe = escapeRegex(b.originalText);
    const pattern = new RegExp(`(<w:t[^>]*>)([^<]*?)${safe}([^<]*?)(</w:t>)`, "g");
    updated = updated.replace(pattern, (_, open, before, after, close) => {
      return `${open}${before}{{${b.token}}}${after}${close}`;
    });
  }

  zip.file("word/document.xml", updated);
  return zip.generate({ type: "uint8array" }) as Uint8Array;
}

export function fillDocxClient(
  tokenizedBytes: Uint8Array | ArrayBuffer,
  bindings: Binding[],
  deal: DealWithRelations,
): Uint8Array {
  const zip = new PizZip(tokenizedBytes);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: "{{", end: "}}" },
  });

  const data: Record<string, string> = {};
  for (const b of bindings) {
    const raw = resolveFieldPath(b.fieldPath, deal);
    data[b.token] = formatValue(raw, b.format);
  }

  doc.render(data);
  return doc.getZip().generate({ type: "uint8array" }) as Uint8Array;
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
