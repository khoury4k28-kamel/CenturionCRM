"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

// Right-aligned slide-in panel. The desktop variant has NO backdrop — the
// page underneath stays fully interactive so the user can click another row's
// expand button without closing first. Mobile (< sm) gets a tappable backdrop
// and body scroll lock so it behaves like a true modal sheet.
//
// ESC always closes. Focus is restored to whatever was focused before open
// (usually the row's expand button), but we don't autofocus inside the panel
// — that would steal focus from the user's reading flow.
export function SidePanel({
  open,
  onOpenChange,
  children,
  widthClassName = "sm:w-[500px]",
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  widthClassName?: string;
  className?: string;
}) {
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onOpenChange(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    return () => {
      const prev = previouslyFocused.current;
      if (prev && typeof prev.focus === "function") prev.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const mq = window.matchMedia("(max-width: 639px)");
    if (!mq.matches) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40 sm:hidden"
        aria-hidden="true"
        onClick={() => onOpenChange(false)}
      />
      <aside
        role="dialog"
        aria-modal="true"
        className={cn(
          "fixed top-0 right-0 z-50 h-screen w-full",
          widthClassName,
          "bg-[var(--color-panel)] border-l border-[var(--color-panel-border)]",
          "shadow-[var(--shadow-card-hover)] overflow-y-auto",
          className,
        )}
        style={{ animation: "slideInRight 0.2s ease" }}
      >
        {children}
      </aside>
    </>
  );
}

// Sticky header with a built-in close (×) button. Caller fills the children
// slot with whatever title / subtitle / inline-edit affordance they want.
export function SidePanelHeader({
  onClose,
  children,
}: {
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="sticky top-0 z-10 bg-[var(--color-panel)] border-b border-[var(--color-panel-border)] px-5 py-3 flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">{children}</div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close panel"
        className="-mr-1 -mt-0.5 h-7 w-7 inline-flex items-center justify-center rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-hover)] text-lg leading-none"
      >
        ×
      </button>
    </div>
  );
}

// Standard padded section with optional small uppercase label.
export function SidePanelSection({
  label,
  children,
  className,
}: {
  label?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("px-5 py-3 border-b border-[var(--color-panel-border)]", className)}>
      {label ? (
        <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-semibold mb-2">
          {label}
        </div>
      ) : null}
      {children}
    </div>
  );
}
