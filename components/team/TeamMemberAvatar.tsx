"use client";

// Round avatar for a TeamMember. Renders the Google profile photo when
// available, otherwise initials on a deterministic background color.
// Direct port of Mālama PM's shared/TeamMemberAvatar.

import type { TeamMember } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  member: TeamMember;
  size?: number;
  className?: string;
  ring?: boolean;
};

export default function TeamMemberAvatar({
  member,
  size = 24,
  className = "",
  ring = false,
}: Props) {
  const fontSize = Math.max(9, Math.round(size * 0.45));
  const ringClass = ring ? "ring-2 ring-[var(--color-panel)]" : "";

  if (member.picture) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={member.picture}
        alt={member.name}
        title={member.name}
        referrerPolicy="no-referrer"
        className={cn("rounded-full object-cover shrink-0", ringClass, className)}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      title={member.name}
      className={cn(
        "rounded-full flex items-center justify-center font-bold text-white shrink-0",
        ringClass,
        className,
      )}
      style={{ width: size, height: size, background: member.color, fontSize }}
    >
      {member.name.charAt(0).toUpperCase()}
    </span>
  );
}
