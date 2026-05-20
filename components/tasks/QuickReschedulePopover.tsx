"use client";

import { useState, type RefObject } from "react";
import { Popover } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export function QuickReschedulePopover({
  anchorRef,
  open,
  onClose,
  currentDate,
  onPick,
}: {
  anchorRef: RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  currentDate: string | null;
  onPick: (iso: string | null) => void;
}) {
  const [customMode, setCustomMode] = useState(false);

  function pick(iso: string | null) {
    onPick(iso);
    setCustomMode(false);
    onClose();
  }

  const today = isoFromOffsetDays(0);
  const tomorrow = isoFromOffsetDays(1);
  const nextMonday = isoForNextMonday();

  return (
    <Popover
      anchorRef={anchorRef}
      open={open}
      onClose={() => {
        setCustomMode(false);
        onClose();
      }}
      placement="bottom-start"
      className="w-[200px] p-1"
    >
      {customMode ? (
        <div className="p-2 space-y-2">
          <input
            type="date"
            defaultValue={currentDate ?? ""}
            autoFocus
            onChange={(e) => pick(e.target.value || null)}
            className="h-8 w-full px-2 rounded bg-[var(--color-bg)] border border-[var(--color-border)] text-sm focus:border-[var(--color-accent)] focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setCustomMode(false)}
            className="w-full text-[10px] uppercase tracking-wider text-[var(--color-text-faint)] hover:text-[var(--color-text)]"
          >
            ← Back
          </button>
        </div>
      ) : (
        <ul className="py-1 text-sm">
          <RescheduleButton
            label="Today"
            sub={formatShort(today)}
            active={currentDate === today}
            onClick={() => pick(today)}
          />
          <RescheduleButton
            label="Tomorrow"
            sub={formatShort(tomorrow)}
            active={currentDate === tomorrow}
            onClick={() => pick(tomorrow)}
          />
          <RescheduleButton
            label="Next Monday"
            sub={formatShort(nextMonday)}
            active={currentDate === nextMonday}
            onClick={() => pick(nextMonday)}
          />
          <li className="border-t border-[var(--color-panel-border)] my-1" />
          <RescheduleButton
            label="Pick a date…"
            sub=""
            active={false}
            onClick={() => setCustomMode(true)}
          />
          {currentDate ? (
            <RescheduleButton
              label="Clear date"
              sub=""
              active={false}
              danger
              onClick={() => pick(null)}
            />
          ) : null}
        </ul>
      )}
    </Popover>
  );
}

function RescheduleButton({
  label,
  sub,
  active,
  danger,
  onClick,
}: {
  label: string;
  sub: string;
  active: boolean;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "w-full px-3 py-1.5 flex items-center justify-between gap-3 text-left rounded transition-colors",
          active
            ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
            : danger
              ? "text-[var(--color-danger)] hover:bg-[var(--color-bg-hover)]"
              : "text-[var(--color-text)] hover:bg-[var(--color-bg-hover)]",
        )}
      >
        <span>{label}</span>
        {sub ? (
          <span className="text-[10px] text-[var(--color-text-faint)] font-mono">{sub}</span>
        ) : null}
      </button>
    </li>
  );
}

function isoFromOffsetDays(days: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return toLocalIso(d);
}

function isoForNextMonday(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay(); // 0=Sun, 1=Mon, ...
  const daysUntilMon = ((1 - dow + 7) % 7) || 7;
  d.setDate(d.getDate() + daysUntilMon);
  return toLocalIso(d);
}

function toLocalIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatShort(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
