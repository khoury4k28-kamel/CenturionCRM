"use client";

// Top-level data provider dispatcher.
//
// Picks between BackendDataProvider (local Next.js + /api routes + SQLite via
// Prisma) and LiveblocksDataProvider (production static export → real-time
// shared storage) based on whether NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY is set.
//
// Both providers implement the same DataContextType, so every consumer using
// useData() works in either mode without modification.
//
// Phase 2d note: the static-export build excludes app/api at deploy time via
// `mv app/api app/_api_excluded` in the GH Actions workflow, so the
// LiveblocksDataProvider becomes the only source of truth there.

import type { ReactNode } from "react";
import { BackendDataProvider } from "./BackendDataProvider";
import { LiveblocksDataProvider } from "./LiveblocksDataProvider";
import { isLiveblocksEnabled } from "@/lib/liveblocks.config";

export function DataProvider({ children }: { children: ReactNode }) {
  if (isLiveblocksEnabled) {
    return <LiveblocksDataProvider>{children}</LiveblocksDataProvider>;
  }
  return <BackendDataProvider>{children}</BackendDataProvider>;
}
