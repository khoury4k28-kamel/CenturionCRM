"use client";

// Thin "use client" wrapper so app/layout.tsx (a server component) can mount
// the rail without pulling @liveblocks/react into the server bundle. Mirrors
// the TeamDockMount pattern from Phase 2g — see contexts/AuthContext.tsx
// comments for the underlying Next 16 boundary gotcha.

import { isLiveblocksEnabled } from "@/lib/liveblocks.config";
import ActivityRail from "./ActivityRail";

export default function ActivityRailMount() {
  // Local single-user dev never needs an activity log — gate the entire rail
  // on Liveblocks being configured. The BackendDataProvider already returns
  // activities: [] so even if it did mount, it would render the empty state.
  if (!isLiveblocksEnabled) return null;
  return <ActivityRail />;
}
