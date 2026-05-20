"use client";

// Client wrapper for app/layout.tsx (server component) — same pattern as
// TeamDockMount. Avoids pulling the data/auth context machinery into the
// server bundle.

import TopRightPanel from "./TopRightPanel";

export default function TopRightPanelMount() {
  return <TopRightPanel />;
}
