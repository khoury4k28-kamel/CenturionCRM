// Copies pdfjs-dist's worker file into public/ so Next.js's static-asset
// pipeline serves it at /pdf.worker.min.mjs (local dev) or
// /CenturionCRM/pdf.worker.min.mjs (static export → GitHub Pages).
//
// PDF.js v5+ always requires a configured GlobalWorkerOptions.workerSrc;
// there is no "disable worker" mode. The legacy build is paired with
// pdf.worker.min.mjs (consumer of components/templates/PdfBindingEditor.tsx).
//
// Runs via npm lifecycle hooks (predev, prebuild) and at the start of the
// build:static chain in package.json. Pairs conceptually with
// scripts/inject-spa-redirect.mjs (other build-time asset helper).

import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const SRC = resolve(
  process.cwd(),
  "node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs",
);
const DEST = resolve(process.cwd(), "public/pdf.worker.min.mjs");

if (!existsSync(SRC)) {
  console.error(`copy-pdf-worker: source not found at ${SRC}`);
  console.error("copy-pdf-worker: did `npm install` complete?");
  process.exit(1);
}

mkdirSync(dirname(DEST), { recursive: true });
copyFileSync(SRC, DEST);
console.log(`copy-pdf-worker: ${SRC} -> ${DEST}`);
