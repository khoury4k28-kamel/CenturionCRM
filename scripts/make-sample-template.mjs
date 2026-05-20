// One-off script: generates a sample real-estate listing agreement PDF and
// uploads it to the local Centurion dev server as a Template. Used to verify
// the PDF binding editor after the workerSrc fix.

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { writeFileSync } from "node:fs";

const TEMPLATE_NAME = "Sample Listing Agreement";
const TEMPLATE_DESC = "Demo template for verifying PDF binding editor — drag a box over each italicized value to bind it to a CRM field.";
const OUT_PATH = "/tmp/sample-listing-agreement.pdf";
const API_URL = "http://localhost:3000/api/templates";

async function buildPdf() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]); // US Letter
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const helvBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const helvItalic = await doc.embedFont(StandardFonts.HelveticaOblique);

  const black = rgb(0.07, 0.07, 0.07);
  const grey = rgb(0.4, 0.4, 0.4);

  let y = 740;
  const left = 60;

  // Title
  page.drawText("EXCLUSIVE LISTING AGREEMENT", {
    x: left, y, font: helvBold, size: 18, color: black,
  });
  y -= 12;
  page.drawText("Centurion Realty — Property Marketing & Sale Authorization", {
    x: left, y, font: helv, size: 9, color: grey,
  });
  y -= 30;

  // Date row
  page.drawText("Date:", { x: left, y, font: helvBold, size: 11, color: black });
  page.drawText("May 20, 2026", { x: left + 60, y, font: helvItalic, size: 11, color: black });
  y -= 30;

  // Parties section
  page.drawText("1. PARTIES", { x: left, y, font: helvBold, size: 12, color: black });
  y -= 18;
  page.drawText("Seller:", { x: left, y, font: helvBold, size: 11, color: black });
  page.drawText("Jane Q. Sellerman", { x: left + 80, y, font: helvItalic, size: 11, color: black });
  y -= 16;
  page.drawText("Listing Agent:", { x: left, y, font: helvBold, size: 11, color: black });
  page.drawText("Greg M. Centurion", { x: left + 80, y, font: helvItalic, size: 11, color: black });
  y -= 30;

  // Property
  page.drawText("2. PROPERTY", { x: left, y, font: helvBold, size: 12, color: black });
  y -= 18;
  page.drawText("Address:", { x: left, y, font: helvBold, size: 11, color: black });
  page.drawText("1234 Sunset Boulevard, Honolulu, HI 96815", {
    x: left + 80, y, font: helvItalic, size: 11, color: black,
  });
  y -= 16;
  page.drawText("MLS #:", { x: left, y, font: helvBold, size: 11, color: black });
  page.drawText("HNL-202605-9981", { x: left + 80, y, font: helvItalic, size: 11, color: black });
  y -= 16;
  page.drawText("Bedrooms:", { x: left, y, font: helvBold, size: 11, color: black });
  page.drawText("4", { x: left + 80, y, font: helvItalic, size: 11, color: black });
  page.drawText("Bathrooms:", { x: left + 200, y, font: helvBold, size: 11, color: black });
  page.drawText("3.5", { x: left + 280, y, font: helvItalic, size: 11, color: black });
  y -= 16;
  page.drawText("Square Feet:", { x: left, y, font: helvBold, size: 11, color: black });
  page.drawText("2,840", { x: left + 80, y, font: helvItalic, size: 11, color: black });
  y -= 30;

  // Pricing
  page.drawText("3. PRICING & COMMISSION", { x: left, y, font: helvBold, size: 12, color: black });
  y -= 18;
  page.drawText("Asking Price:", { x: left, y, font: helvBold, size: 11, color: black });
  page.drawText("$1,895,000", { x: left + 90, y, font: helvItalic, size: 11, color: black });
  y -= 16;
  page.drawText("Commission:", { x: left, y, font: helvBold, size: 11, color: black });
  page.drawText("6.0%", { x: left + 90, y, font: helv, size: 11, color: black });
  y -= 16;
  page.drawText("List Period Ends:", { x: left, y, font: helvBold, size: 11, color: black });
  page.drawText("November 20, 2026", { x: left + 110, y, font: helvItalic, size: 11, color: black });
  y -= 30;

  // Body paragraph
  page.drawText("4. AUTHORIZATION", { x: left, y, font: helvBold, size: 12, color: black });
  y -= 18;
  const body = [
    "Seller hereby grants Listing Agent the exclusive right to market and",
    "sell the property described above at the Asking Price stated in",
    "Section 3. Seller acknowledges receipt of the Centurion Realty",
    "Disclosure Packet and confirms authority to enter into this agreement.",
  ];
  for (const line of body) {
    page.drawText(line, { x: left, y, font: helv, size: 11, color: black });
    y -= 14;
  }
  y -= 20;

  // Signature lines
  page.drawText("Seller signature:", { x: left, y, font: helvBold, size: 11, color: black });
  page.drawLine({ start: { x: left + 110, y: y - 2 }, end: { x: left + 350, y: y - 2 }, color: grey, thickness: 0.6 });
  y -= 30;
  page.drawText("Agent signature:", { x: left, y, font: helvBold, size: 11, color: black });
  page.drawLine({ start: { x: left + 110, y: y - 2 }, end: { x: left + 350, y: y - 2 }, color: grey, thickness: 0.6 });

  // Footer
  page.drawText("Page 1 of 1 · Centurion Realty · Confidential", {
    x: left, y: 40, font: helv, size: 8, color: grey,
  });

  return await doc.save();
}

async function main() {
  const bytes = await buildPdf();
  writeFileSync(OUT_PATH, bytes);
  console.log(`Built PDF: ${OUT_PATH} (${bytes.length} bytes)`);

  const fd = new FormData();
  fd.set("name", TEMPLATE_NAME);
  fd.set("description", TEMPLATE_DESC);
  fd.set("file", new File([bytes], "sample-listing-agreement.pdf", { type: "application/pdf" }));

  const res = await fetch(API_URL, { method: "POST", body: fd });
  const text = await res.text();
  if (!res.ok) {
    console.error(`Upload failed (${res.status}): ${text}`);
    process.exit(1);
  }
  const body = JSON.parse(text);
  console.log(`Uploaded. Template id: ${body.data?.id ?? "?"}`);
  console.log(`Open: http://localhost:3000/templates/detail?id=${body.data?.id ?? ""}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
