"use client";

// Bottom-left team panel. Shows every TeamMember (the persistent roster), with
// a green presence dot for whoever is currently connected via Liveblocks.
// Drag a member onto a task card to assign them.
//
// Owner-only "+" button opens the AllowlistManager so the owner can grant
// access to new emails without redeploying.

import { useState } from "react";
import { Plus } from "lucide-react";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { parseOwnerEmails } from "@/lib/auth-utils";
import TeamMemberAvatar from "./TeamMemberAvatar";
import PresenceDot from "./PresenceDot";
import AllowlistManager from "./AllowlistManager";

const OWNER_EMAILS = parseOwnerEmails(process.env.NEXT_PUBLIC_OWNER_EMAILS);

export default function TeamDock() {
  const { teamMembers, connectedEmails } = useData();
  const { user } = useAuth();
  const [showAllowlist, setShowAllowlist] = useState(false);

  const isOwner =
    !!user && OWNER_EMAILS.includes(user.email.toLowerCase());
  const onlineSet = new Set(connectedEmails.map((e) => e.toLowerCase()));

  if (teamMembers.length === 0 && !isOwner) return null;

  return (
    <>
      {/* left-60 = 15rem; sidebar is w-56 (14rem) + 1rem gutter so the dock
          sits just to the right of the sidebar's bottom edge instead of
          overlapping it. */}
      <div className="fixed bottom-4 left-60 z-40">
        <div className="bg-[var(--color-panel)] border border-[var(--color-panel-border)] rounded-2xl px-3 py-2.5 shadow-lg flex flex-col gap-2 min-w-[112px]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] uppercase tracking-widest text-[var(--color-text-faint)] font-medium">
              Team
            </span>
            {isOwner ? (
              <button
                type="button"
                onClick={() => setShowAllowlist(true)}
                title="Manage access"
                className="text-[var(--color-text-faint)] hover:text-[var(--color-accent)] transition-colors"
              >
                <Plus size={12} strokeWidth={2} />
              </button>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {teamMembers.map((m) => {
              const online = onlineSet.has(m.email.toLowerCase());
              return (
                <div
                  key={m.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(
                      "application/team-member",
                      m.id,
                    );
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                  className="relative cursor-grab active:cursor-grabbing hover:scale-110 transition-transform"
                >
                  <TeamMemberAvatar member={m} size={28} />
                  <PresenceDot online={online} />
                </div>
              );
            })}
            {teamMembers.length === 0 ? (
              <span className="text-[11px] text-[var(--color-text-faint)] py-1">
                No teammates yet
              </span>
            ) : null}
          </div>
        </div>
      </div>
      {showAllowlist ? (
        <AllowlistManager onClose={() => setShowAllowlist(false)} />
      ) : null}
    </>
  );
}
