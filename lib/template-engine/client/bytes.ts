// Browser-side byte helpers. Used by LiveblocksDataProvider to:
//  1. Read user-uploaded File → Uint8Array (for tokenization on save).
//  2. Encode bytes ⇄ data-URL so template files live in Liveblocks storage
//     and the existing <DocxBindingEditor>/<PdfBindingEditor> components can
//     `fetch(fileUrl)` against them with zero changes.
//  3. Trigger a browser download of generated DOCX/PDF bytes.

export const MIME_DOCX =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const MIME_PDF = "application/pdf";

export async function fileToUint8(file: File | Blob): Promise<Uint8Array> {
  const buf = await file.arrayBuffer();
  return new Uint8Array(buf);
}

export async function urlToUint8(url: string): Promise<Uint8Array> {
  // Works for data:, blob:, and http(s): URLs alike.
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url} (${res.status})`);
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}

export function uint8ToDataUrl(bytes: Uint8Array, mime: string): string {
  // For typical legal-doc templates (30-200KB) this stays well under URL/JSON
  // size limits in Liveblocks and in the bundled JSON snapshot.
  let binary = "";
  const chunk = 0x8000; // chunk to avoid call-stack blowups on big files
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, i + chunk);
    binary += String.fromCharCode.apply(null, Array.from(slice));
  }
  const b64 = btoa(binary);
  return `data:${mime};base64,${b64}`;
}

export function downloadBytes(
  bytes: Uint8Array,
  filename: string,
  mime: string,
): void {
  // Clone into a fresh ArrayBuffer slice so Blob can't be affected by later
  // mutation of the typed-array view.
  const sliced = bytes.slice().buffer;
  const blob = new Blob([sliced], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Release the object URL after a tick so the click has time to register.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function detectFormatFromName(
  filename: string,
): "DOCX" | "PDF" | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".docx")) return "DOCX";
  if (lower.endsWith(".pdf")) return "PDF";
  return null;
}

export function mimeForFormat(fmt: "DOCX" | "PDF"): string {
  return fmt === "DOCX" ? MIME_DOCX : MIME_PDF;
}
