"use client";

// Top-right control pill: user avatar + settings gear. Tapping the gear opens
// a popover with theme switcher, currently-online users, and sign out.
//
// Renders in both Liveblocks and local Prisma modes. In local mode we only
// show the gear (no user identity, no presence) and the popover degrades to
// just the theme switcher.

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { Settings as SettingsIcon, LogOut, Sun, Moon, Monitor } from "lucide-react";
import { useOptionalAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import TeamMemberAvatar from "@/components/team/TeamMemberAvatar";
import { cn } from "@/lib/utils";

export default function TopRightPanel() {
  const auth = useOptionalAuth();
  const user = auth?.user ?? null;
  const { teamMembers, connectedEmails } = useData();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on click outside or Escape.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Build the "online now" list for the popover. Match teamMembers by email
  // against connectedEmails; anything connected without a roster row (rare:
  // a teammate who just signed in but the roster hasn't replicated yet) gets
  // shown as a placeholder.
  const onlineSet = new Set(connectedEmails.map((e) => e.toLowerCase()));
  const onlineMembers = teamMembers.filter((m) =>
    onlineSet.has(m.email.toLowerCase()),
  );

  return (
    <div ref={rootRef} className="fixed top-5 right-6 z-40">
      <div
        className={cn(
          "flex items-center gap-1 px-1.5 py-1 rounded-full",
          "bg-[var(--color-panel)] border border-[var(--color-panel-border)] shadow-sm",
        )}
      >
        {user ? <UserChip name={user.name} picture={user.picture} /> : null}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          title="Settings"
          aria-label="Settings"
          className={cn(
            "h-7 w-7 rounded-full inline-flex items-center justify-center",
            "text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
            "hover:bg-[var(--color-bg-elevated)] transition-colors",
            open && "bg-[var(--color-bg-elevated)] text-[var(--color-text)]",
          )}
        >
          <SettingsIcon size={14} strokeWidth={1.75} />
        </button>
      </div>

      {open ? (
        <SettingsPopover
          user={user}
          onlineMembers={onlineMembers}
          onSignOut={auth?.signOut}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}

function UserChip({ name, picture }: { name: string; picture: string }) {
  // Lightweight avatar render — we don't have a real TeamMember object here
  // (Google identity vs. roster row), so build a minimal one for the avatar
  // component. Color isn't used when a picture is present.
  return (
    <TeamMemberAvatar
      member={{
        id: "self",
        email: "",
        name,
        picture,
        color: "#5b9bd5",
        addedAt: 0,
      }}
      size={26}
    />
  );
}

type OnlineMember = ReturnType<typeof useData>["teamMembers"][number];

function SettingsPopover({
  user,
  onlineMembers,
  onSignOut,
  onClose,
}: {
  user: { name: string; email: string; picture: string } | null;
  onlineMembers: OnlineMember[];
  onSignOut: (() => void) | undefined;
  onClose: () => void;
}) {
  return (
    <div
      className={cn(
        "absolute right-0 mt-2 w-72 rounded-xl shadow-lg overflow-hidden",
        "bg-[var(--color-panel)] border border-[var(--color-panel-border)]",
      )}
      role="dialog"
    >
      {user ? (
        <div className="px-4 py-3 border-b border-[var(--color-panel-border)]">
          <div className="text-sm font-medium text-[var(--color-text)] truncate">
            {user.name}
          </div>
          <div className="text-xs text-[var(--color-text-faint)] truncate">
            {user.email}
          </div>
        </div>
      ) : null}

      <Section title="Theme">
        <ThemeSegmented />
      </Section>

      {user ? (
        <Section title={`Online now · ${onlineMembers.length}`}>
          {onlineMembers.length === 0 ? (
            <div className="text-xs text-[var(--color-text-faint)] px-1">
              Just you for the moment.
            </div>
          ) : (
            <ul className="space-y-1.5">
              {onlineMembers.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center gap-2 px-1"
                  title={m.email}
                >
                  <span className="relative">
                    <TeamMemberAvatar member={m} size={20} />
                    <span
                      className="absolute -right-0.5 -bottom-0.5 w-2 h-2 rounded-full bg-[var(--color-accent)] ring-2 ring-[var(--color-panel)]"
                      aria-hidden
                    />
                  </span>
                  <span className="text-sm text-[var(--color-text)] truncate">
                    {m.name}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      ) : null}

      {user && onSignOut ? (
        <div className="border-t border-[var(--color-panel-border)]">
          <button
            type="button"
            onClick={() => {
              onClose();
              onSignOut();
            }}
            className={cn(
              "w-full px-4 py-2.5 text-left text-sm flex items-center gap-2",
              "text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
              "hover:bg-[var(--color-bg-elevated)] transition-colors",
            )}
          >
            <LogOut size={14} strokeWidth={1.75} />
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-4 py-3 border-b border-[var(--color-panel-border)] last:border-b-0">
      <div className="text-[10px] uppercase tracking-widest text-[var(--color-text-faint)] font-medium mb-2">
        {title}
      </div>
      {children}
    </div>
  );
}

function ThemeSegmented() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const current = mounted ? theme ?? "system" : "system";

  const options: { value: string; label: string; icon: typeof Sun }[] = [
    { value: "system", label: "Auto", icon: Monitor },
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
  ];

  return (
    <div className="grid grid-cols-3 gap-1 p-0.5 rounded-md bg-[var(--color-bg-elevated)]">
      {options.map((o) => {
        const active = current === o.value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => setTheme(o.value)}
            className={cn(
              "flex items-center justify-center gap-1.5 text-xs py-1.5 rounded transition-colors",
              active
                ? "bg-[var(--color-panel)] text-[var(--color-text)] shadow-sm"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
            )}
          >
            <Icon size={12} strokeWidth={1.75} />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
