// Restore the original URL after a 404 redirect on GitHub Pages.
//
// Pairs with scripts/inject-spa-redirect.mjs (postbuild). That script injects
// a redirect into out/404.html which encodes the unmatched path into a query
// string and bounces to the basePath index. This script reads the query, decodes
// it, and replaceState's the URL back to the original before React hydrates —
// so Next's client router can pick up the route as if no redirect happened.
//
// Adapted from rafgraph/spa-github-pages. Served as a static asset (no JSX)
// so the layout can reference it with <script src> rather than inlining.
//
// Attempt counter caps retries at 1 so a genuinely unknown URL (e.g. stale
// bookmark to a deleted deal ID) doesn't loop forever — we bail to the bare
// pathname and let the app render its 404 state instead.
(function (l) {
  var TARGET = "__spa_redirect_target";
  var COUNT = "__spa_redirect_count";
  if (l.search[1] !== "/") {
    try {
      sessionStorage.removeItem(COUNT);
    } catch (e) {}
    return;
  }
  var attempts = 0;
  try {
    attempts = parseInt(sessionStorage.getItem(COUNT) || "0", 10);
  } catch (e) {}
  if (attempts >= 1) {
    try {
      sessionStorage.removeItem(COUNT);
      sessionStorage.removeItem(TARGET);
    } catch (e) {}
    window.history.replaceState(null, "", l.pathname);
    return;
  }
  var decoded = l.search
    .slice(1)
    .split("&")
    .map(function (s) {
      return s.replace(/~and~/g, "&");
    })
    .join("?");
  var target = l.pathname.slice(0, -1) + decoded + l.hash;
  try {
    sessionStorage.setItem(TARGET, target);
    sessionStorage.setItem(COUNT, String(attempts + 1));
  } catch (e) {}
  window.history.replaceState(null, "", target);
})(window.location);
