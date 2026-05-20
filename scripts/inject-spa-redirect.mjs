// Postbuild step for the GitHub Pages static export.
//
// GitHub Pages serves `out/404.html` for any unmatched path. This script
// injects a synchronous redirect at the top of `<head>` in `out/404.html`
// so typos, deleted routes, or stale bookmarks don't show a hard 404 — the
// redirect encodes the unmatched path into a query string and hops to the
// basePath index, where the restore script in app/layout.tsx puts the URL
// back and Next's client router takes over. Adapted from
// rafgraph/spa-github-pages.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const FILE = resolve(process.cwd(), "out/404.html");

// Derive basePath from next.config.ts so this script never drifts from the
// build config. Looks for `basePath: '/X'` or `basePath: "/X"`.
const NEXT_CONFIG = resolve(process.cwd(), "next.config.ts");
function readBasePath() {
  if (!existsSync(NEXT_CONFIG)) {
    console.error(`inject-spa-redirect: ${NEXT_CONFIG} not found`);
    process.exit(1);
  }
  const text = readFileSync(NEXT_CONFIG, "utf8");
  const match = text.match(/basePath:\s*['"]([^'"]+)['"]/);
  if (!match) {
    console.error("inject-spa-redirect: could not find basePath in next.config.ts");
    process.exit(1);
  }
  return match[1];
}

const BASE_PATH = readBasePath();
const BASE_PATH_SEGMENTS = BASE_PATH.split("/").filter(Boolean).length;

const REDIRECT = `<script>(function(){var n=${BASE_PATH_SEGMENTS},l=window.location;l.replace(l.protocol+'//'+l.hostname+(l.port?':'+l.port:'')+l.pathname.split('/').slice(0,1+n).join('/')+'/?/'+l.pathname.slice(1).split('/').slice(n).join('/').replace(/&/g,'~and~')+(l.search?'&'+l.search.slice(1).replace(/&/g,'~and~'):'')+l.hash);})();</script>`;

if (!existsSync(FILE)) {
  console.error(`inject-spa-redirect: ${FILE} not found — did the build run?`);
  process.exit(1);
}

const html = readFileSync(FILE, "utf8");
if (html.includes("var n=" + BASE_PATH_SEGMENTS + ",l=window.location")) {
  console.log("inject-spa-redirect: already injected, skipping");
  process.exit(0);
}

const head = html.indexOf("<head>");
if (head === -1) {
  console.error("inject-spa-redirect: no <head> tag in 404.html");
  process.exit(1);
}

const out = html.slice(0, head + "<head>".length) + REDIRECT + html.slice(head + "<head>".length);
writeFileSync(FILE, out);
console.log(
  `inject-spa-redirect: injected redirect for basePath="${BASE_PATH}" (${BASE_PATH_SEGMENTS} segments) into ${FILE}`,
);
