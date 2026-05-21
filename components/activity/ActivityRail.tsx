"use client";

// Fixed-position right rail showing the shared activity log. Renders newest
// entries at the top. Collapsible to a 40px tab on the right edge; persists
// open/closed state to localStorage.
//
// Visual vocabulary mirrors TeamDock — same panel background, border radius,
// and label typography — so the rail feels like part of the existing chrome
// rather than a bolted-on widget.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, ChevronLeft, Activity } from "lucide-react";
import { useData } from "@/contexts/DataContext";
import type { ActivityEntry, TeamMember } from "@/lib/types";
import TeamMemberAvatar from "@/components/team/TeamMemberAvatar";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "centurion.activityRail.open";
const RAIL_OPEN_WIDTH = 340;
const RAIL_CLOSED_WIDTH = 40;

// Mirrors the search-param pattern from Phase 2c — dynamic routes were
// removed for static-export compatibility, so all detail pages take ?id=
// in the query string.
function entityHref(entry: ActivityEntry): string | null {
  if (!entry.entityType || !entry.entityId) return null;
  switch (entry.entityType) {
    case "deal":
      return `/deals/detail?id=${encodeURIComponent(entry.entityId)}`;
    case "contact":
      return `/contacts/detail?id=${encodeURIComponent(entry.entityId)}`;
    case "task":
      // No per-task page exists; routing to /tasks scrolls the list into view.
      return `/tasks`;
    case "template":
      return `/templates/detail?id=${encodeURIComponent(entry.entityId)}`;
    case "document":
      // For document events we stashed the dealId in entityLabel so the row
      // can route to the deal that owns the doc.
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
// existing TeamMemberAvatar component can render the actor without us
// duplicating its initials-vs-photo logic.
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

export default function ActivityRail() {
  const { activities } = useData();
  const router = useRouter();

  // Open state lives in localStorage so the rail's preferred state survives
  // page navigation. Default: open on first visit.
  const [open, setOpen] = useState<boolean>(true);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // One-shot mount sync to read the user's prior open/closed preference
    // from localStorage. Same eslint-disable pattern as BackendDataProvider's
    // initial-load effect — there isn't a cleaner alternative for a browser-
    // storage sync that has to wait for window to exist.
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored === "0") setOpen(false);
    } catch {
      // localStorage can throw in private windows — fall through with default.
    }
    setHydrated(true);
  }, []);

  // Broadcast the rail's reserved width via a CSS custom property on
  // document.documentElement. Pages can subscribe with `pr-[var(--activity-rail-width)]`
  // if they need to inset their max-width container. (Currently the main flex
  // doesn't reserve space — the rail just overlays the right edge, which is
  // empty space on every current page.)
  useEffect(() => {
    if (!hydrated) return;
    const w = open ? RAIL_OPEN_WIDTH : RAIL_CLOSED_WIDTH;
    document.documentElement.style.setProperty(
      "--activity-rail-width",
      `${w}px`,
    );
    return () => {
      document.documentElement.style.removeProperty("--activity-rail-width");
    };
  }, [open, hydrated]);

  const toggle = useCallback(() => {
    setOpen((cur) => {
      const next = !cur;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        // ignore — private window
      }
      return next;
    });
  }, []);

  // Sort newest-first. We don't mutate the underlying LiveList — useMemo
  // gives us a stable sorted snapshot per activities-array identity.
  const sorted = useMemo(
    () => [...activities].sort((a, b) => b.ts - a.ts),
    [activities],
  );

  // re-tick the "Xm ago" labels every minute. We don't need second-resolution
  // for any entry older than 60s, so a 1-minute interval is sufficient.
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Auto-scroll to top when a new entry arrives — but only if the user is
  // already near the top. Otherwise they're reading history and we shouldn't
  // yank them away.
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const lastTopId = useRef<string | null>(null);
  useEffect(() => {
    if (sorted.length === 0) return;
    const topId = sorted[0].id;
    if (topId === lastTopId.current) return;
    lastTopId.current = topId;
    const el = scrollerRef.current;
    if (!el) return;
    if (el.scrollTop <= 24) {
      el.scrollTop = 0;
    }
  }, [sorted]);

  // Wait for hydration before rendering — otherwise the open/closed state can
  // flicker on first paint (server has no localStorage).
  if (!hydrated) return null;

  const handleRowClick = (entry: ActivityEntry) => {
    const href = entityHref(entry);
    if (href) router.push(href);
  };

  return (
    <aside
      aria-label="Activity transcript"
      // top-20 clears the TopRightPanel pill (top-5 + ~36px pill height = ~56px
      // bottom edge); 80px from the top leaves a ~24px gap so the rail header
      // doesn't tuck immediately under the avatar/settings chip.
      className="fixed top-20 right-4 bottom-4 z-40 flex flex-col pointer-events-none"
      style={{ width: open ? RAIL_OPEN_WIDTH : RAIL_CLOSED_WIDTH }}
    >
      <div
        className={cn(
          "pointer-events-auto flex-1 min-h-0 flex flex-col",
          "bg-[var(--color-panel)] border border-[var(--color-panel-border)] rounded-2xl shadow-lg",
          "transition-[width] duration-200 ease-out",
        )}
      >
        {/* Header — uppercase label + toggle. In the collapsed state the
            label is hidden and only the vertical chevron tab is shown. */}
        <div
          className={cn(
            "flex items-center border-b border-[var(--color-panel-border)]",
            open ? "px-4 py-2.5 justify-between gap-2" : "px-0 py-2 justify-center",
          )}
        >
          {open ? (
            <>
              <span className="text-[10px] uppercase tracking-widest text-[var(--color-text-faint)] font-medium flex items-center gap-1.5">
                <Activity size={11} strokeWidth={2} />
                Activity
                {sorted.length > 0 ? (
                  <span className="text-[var(--color-text-muted)] font-normal lowercase tracking-normal">
                    · {sorted.length}
                  </span>
                ) : null}
              </span>
              <button
                type="button"
                onClick={toggle}
                title="Collapse"
                className="text-[var(--color-text-faint)] hover:text-[var(--color-accent)] transition-colors"
              >
                <ChevronRight size={14} strokeWidth={2} />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={toggle}
              title="Show activity"
              className="text-[var(--color-text-faint)] hover:text-[var(--color-accent)] transition-colors"
            >
              <ChevronLeft size={14} strokeWidth={2} />
            </button>
          )}
        </div>

        {/* Body — scrollable list. Hidden when collapsed; the chevron tab is
            the only affordance. */}
        {open ? (
          <div
            ref={scrollerRef}
            className="flex-1 min-h-0 overflow-y-auto px-2 py-2"
          >
            {sorted.length === 0 ? (
              <p className="text-[12px] text-[var(--color-text-faint)] px-3 py-6 text-center">
                No activity yet.
              </p>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {sorted.map((entry) => {
                  const href = entityHref(entry);
                  const clickable = !!href;
                  const member = actorAsMember(entry);
                  return (
                    <li key={entry.id}>
                      <button
                        type="button"
                        disabled={!clickable}
                        onClick={() => handleRowClick(entry)}
                        className={cn(
                          "w-full text-left rounded-lg px-2 py-1.5 flex items-start gap-2.5",
                          clickable
                            ? "hover:bg-[var(--color-bg-elevated)] cursor-pointer"
                            : "cursor-default",
                          "transition-colors",
                        )}
                      >
                        <TeamMemberAvatar
                          member={member}
                          size={22}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-1.5 leading-snug">
                            <span className="text-[12px] text-[var(--color-text)] font-medium truncate">
                              {entry.actorName || entry.actorEmail}
                            </span>
                            <span className="text-[10px] text-[var(--color-text-faint)] shrink-0">
                              {timeAgo(entry.ts, now)}
                            </span>
                          </div>
                          <div className="text-[12px] text-[var(--color-text-muted)] leading-snug break-words">
                            {entry.summary}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
