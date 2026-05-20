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
// Hosted mode also enforces Google sign-in via <AuthGate>, with the allowlist
// stored in Liveblocks (see components/auth/AuthGate.tsx). Local Prisma mode
// bypasses auth — it's a single-user dev environment.

import type { ReactNode } from "react";
import { BackendDataProvider } from "./BackendDataProvider";
import { LiveblocksDataProvider } from "./LiveblocksDataProvider";
import { AuthProvider } from "./AuthContext";
import AuthGate from "@/components/auth/AuthGate";
import { isLiveblocksEnabled } from "@/lib/liveblocks.config";

export function DataProvider({ children }: { children: ReactNode }) {
  if (isLiveblocksEnabled) {
    return (
      <AuthProvider>
        <LiveblocksDataProvider>
          <AuthGate>{children}</AuthGate>
        </LiveblocksDataProvider>
      </AuthProvider>
    );
  }
  return <BackendDataProvider>{children}</BackendDataProvider>;
}
