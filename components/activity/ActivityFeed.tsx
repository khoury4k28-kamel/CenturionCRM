"use client";

// In-flow activity timeline. Renders an append-only stream of events newest
// first — both auto-logged system events (stage changes, task completions, doc
// generation) and manually-logged calls/notes/emails/meetings.
//
// Reused by:
//   - the Activity & Tasks page (global feed, links rows to their entity)
//   - the deal panel's Activity tab (filtered to one deal, no row links)

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Phone, StickyNote, Mail, Users, Trash2 } from "lucide-react";
import type { ActivityEntry, ActivityKind, TeamMember } from "@/lib/types";
import { MANUAL_ACTIVITY_KINDS } from "@/lib/types";
import TeamMemberAvatar from "@/components/team/TeamMemberAvatar";
import { cn } from "@/lib/utils";

// Mirrors the search-param routing pattern used elsewhere — dynamic routes were
// removed for static-export compatibility, so detail pages take ?id= queries.
function entityHref(entry: ActivityEntry): string | null {
  if (!entry.entityType || !entry.entityId) return null;
  switch (entry.entityType) {
    case "deal":
      return `/deals/detail?id=${encodeURIComponent(entry.entityId)}`;
    case "contact":
      return `/contacts/detail?id=${encodeURIComponent(entry.entityId)}`;
    case "task":
      return `/tasks`;
    case "template":
      return `/templates/detail?id=${encodeURIComponent(entry.entityId)}`;
    case "document":
      // Document events stash the dealId in entityLabel so the row can route to
      // the deal that owns the doc (there's no per-document page).
      return entry.entityLabel
        ? `/deals/detail?id=${encodeURIComponent(entry.entityLabel)}`
        : null;
    case "team":
      return null;
    default:
      return null;
  }
}

function timeAgo(ts: number, now: number): string {
  const sec = Math.floor((now - ts) / 1000);
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

// Synthesize a TeamMember-shaped object from a frozen ActivityEntry so the
// existing TeamMemberAvatar can render the actor (photo or initials).
function actorAsMember(entry: ActivityEntry): TeamMember {
  return {
    id: entry.actorEmail,
    email: entry.actorEmail,
    name: entry.actorName || entry.actorEmail,
    picture: entry.actorPicture ?? "",
    color: entry.actorColor || "#6b6b6b",
    addedAt: entry.ts,
  };
}

const MANUAL_SET = new Set<ActivityKind>(MANUAL_ACTIVITY_KINDS);

function kindIcon(kind: ActivityKind) {
  switch (kind) {
    case "call.logged":
      return Phone;
    case "email.logged":
      return Mail;
    case "meeting.logged":
      return Users;
    case "note.logged":
      return StickyNote;
    default:
      return null;
  }
}

export function ActivityFeed({
  entries,
  dealId,
  linkEntities = true,
  onDelete,
  emptyHint = "No activity yet.",
  className,
}: {
  entries: ActivityEntry[];
  /** When set, only show entries attached to this deal. */
  dealId?: string;
  /** Route rows to their entity page on click. Off for deal-scoped panels. */
  linkEntities?: boolean;
  /** When provided, manually-logged entries show a delete affordance. */
  onDelete?: (id: string) => void;
  emptyHint?: string;
  className?: string;
}) {
  const router = useRouter();

  // Re-tick the relative timestamps every minute.
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const sorted = useMemo(() => {
    const scoped = dealId ? entries.filter((e) => e.dealId === dealId) : entries;
    return [...scoped].sort((a, b) => b.ts - a.ts);
  }, [entries, dealId]);

  if (sorted.length === 0) {
    return (
      <p
        className={cn(
          "text-[12px] text-[var(--color-text-faint)] px-3 py-6 text-center",
          className,
        )}
      >
        {emptyHint}
      </p>
    );
  }

  return (
    <ul className={cn("flex flex-col gap-0.5", className)}>
      {sorted.map((entry) => {
        const href = linkEntities ? entityHref(entry) : null;
        const clickable = !!href;
        const member = actorAsMember(entry);
        const Icon = kindIcon(entry.kind);
        const isManual = MANUAL_SET.has(entry.kind);
        return (
          <li key={entry.id} className="group/activity relative">
            <button
              type="button"
              disabled={!clickable}
              onClick={() => href && router.push(href)}
              className={cn(
                "w-full text-left rounded-lg px-2 py-1.5 flex items-start gap-2.5 transition-colors",
                clickable
                  ? "hover:bg-[var(--color-bg-elevated)] cursor-pointer"
                  : "cursor-default",
              )}
            >
              <TeamMemberAvatar member={member} size={22} className="mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-1.5 leading-snug">
                  <span className="text-[12px] text-[var(--color-text)] font-medium truncate">
                    {entry.actorName || entry.actorEmail}
                  </span>
                  <span className="text-[10px] text-[var(--color-text-faint)] shrink-0">
                    {timeAgo(entry.ts, now)}
                  </span>
                </div>
                <div className="text-[12px] text-[var(--color-text-muted)] leading-snug break-words flex items-center gap-1">
                  {Icon ? <Icon size={11} className="shrink-0 text-[var(--color-text-faint)]" /> : null}
                  <span>{entry.summary}</span>
                  {/* Manual logs have a generic summary ("logged a call"), so in the
                      global feed surface which deal it's attached to. */}
                  {linkEntities && isManual && entry.entityLabel ? (
                    <span className="text-[var(--color-text-faint)] truncate">
                      · {entry.entityLabel}
                    </span>
                  ) : null}
                </div>
                {entry.body ? (
                  <div className="mt-1 text-[12px] text-[var(--color-text)] leading-snug break-words whitespace-pre-wrap rounded-md bg-[var(--color-bg-elevated)] border border-[var(--color-panel-border)] px-2 py-1.5">
                    {entry.body}
                  </div>
                ) : null}
              </div>
            </button>
            {onDelete && isManual ? (
              <button
                type="button"
                aria-label="Delete activity"
                onClick={() => onDelete(entry.id)}
                className="absolute top-1.5 right-1.5 opacity-0 group-hover/activity:opacity-100 transition-opacity h-6 w-6 inline-flex items-center justify-center rounded-md text-[var(--color-text-faint)] hover:text-[var(--color-danger)] hover:bg-[var(--color-bg-hover)]"
              >
                <Trash2 size={12} />
              </button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
