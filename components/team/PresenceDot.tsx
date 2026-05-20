"use client";

// Small green/gray status dot overlaid on a TeamMember avatar. Green if the
// member's email matches a currently-connected Liveblocks presence entry.

import { cn } from "@/lib/utils";

export default function PresenceDot({
  online,
  size = 8,
  className = "",
}: {
  online: boolean;
  size?: number;
  className?: string;
}) {
  return (
    <span
      title={online ? "Online" : "Offline"}
      className={cn(
        "absolute rounded-full ring-2 ring-[var(--color-panel)]",
        online ? "bg-[var(--color-accent)]" : "bg-[var(--color-text-faint)]",
        className,
      )}
      style={{ width: size, height: size, right: -1, bottom: -1 }}
    />
  );
}
