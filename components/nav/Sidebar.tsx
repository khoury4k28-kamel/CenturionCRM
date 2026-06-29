"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Table,
  Users,
  FileText,
  Activity,
  Inbox,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useOptionalAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { parseOwnerEmails } from "@/lib/auth-utils";
import TeamMemberAvatar from "@/components/team/TeamMemberAvatar";
import PresenceDot from "@/components/team/PresenceDot";
import AllowlistManager from "@/components/team/AllowlistManager";
import { isLiveblocksEnabled } from "@/lib/liveblocks.config";

const items = [
  { href: "/deals", label: "Pipeline", icon: Table },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/templates", label: "Templates", icon: FileText },
  { href: "/tasks", label: "Activity & Tasks", icon: Activity },
  { href: "/inbox", label: "Inbox", icon: Inbox },
];

const OWNER_EMAILS = parseOwnerEmails(process.env.NEXT_PUBLIC_OWNER_EMAILS);

export function Sidebar() {
  const pathname = usePathname();
  const auth = useOptionalAuth();
  const user = auth?.user ?? null;
  const { teamMembers, connectedEmails } = useData();
  const [showAllowlist, setShowAllowlist] = useState(false);

  const isOwner =
    !!user && OWNER_EMAILS.includes(user.email.toLowerCase());
  const onlineSet = new Set(connectedEmails.map((e) => e.toLowerCase()));

  return (
    <aside className="w-56 shrink-0 h-screen sticky top-0 border-r border-[var(--color-border)] flex flex-col bg-[var(--color-panel)]">
      <div className="px-5 py-5 border-b border-[var(--color-border)]">
        <Link href="/deals" className="flex items-baseline gap-1.5 group">
          <span className="text-lg font-semibold tracking-tight">Centurion</span>
          <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-accent)] font-medium">
            CRM
          </span>
        </Link>
      </div>

      <nav className="flex-1 py-4">
        {items.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-5 py-2 text-sm transition-colors",
                isActive
                  ? "text-[var(--color-text)] bg-[var(--color-bg-elevated)] border-l-2 border-[var(--color-accent)]"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-elevated)] border-l-2 border-transparent",
              )}
            >
              <Icon size={16} strokeWidth={1.75} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <SidebarFooter
        user={user}
        isOwner={isOwner}
        teamMembers={teamMembers}
        onlineSet={onlineSet}
        onOpenAllowlist={() => setShowAllowlist(true)}
      />

      {showAllowlist ? (
        <AllowlistManager onClose={() => setShowAllowlist(false)} />
      ) : null}
    </aside>
  );
}

type FooterProps = {
  user: { name: string; email: string; picture: string } | null;
  isOwner: boolean;
  teamMembers: ReturnType<typeof useData>["teamMembers"];
  onlineSet: Set<string>;
  onOpenAllowlist: () => void;
};

// Footer combines identity + team roster into one block so the sidebar's
// bottom edge reads as a single unit instead of an orphaned floating dock.
// Avatars stay draggable for assigning onto task cards.
function SidebarFooter({
  user,
  isOwner,
  teamMembers,
  onlineSet,
  onOpenAllowlist,
}: FooterProps) {
  const showTeamRow = isLiveblocksEnabled && (teamMembers.length > 0 || isOwner);

  return (
    <div className="px-5 py-4 border-t border-[var(--color-border)] space-y-3">
      {showTeamRow ? (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-faint)]">
              Team
            </span>
            {isOwner ? (
              <button
                type="button"
                onClick={onOpenAllowlist}
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
                    e.dataTransfer.setData("application/team-member", m.id);
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                  className="relative cursor-grab active:cursor-grabbing hover:scale-110 transition-transform"
                >
                  <TeamMemberAvatar member={m} size={24} />
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
      ) : null}

      <div>
        <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-faint)] mb-1 flex items-center gap-1">
          <span>Signed in as</span>
          {isOwner ? (
            <span
              title="Owner — can manage access"
              className="text-[var(--color-accent)]"
            >
              ★
            </span>
          ) : null}
        </div>
        <div className="text-xs text-[var(--color-text)] truncate">
          {user ? user.name : "Local dev"}
        </div>
      </div>
    </div>
  );
}
