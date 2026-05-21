"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

export function Dialog({
  open,
  onOpenChange,
  children,
  className,
  panelClassName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  className?: string;
  panelClassName?: string;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Portal target is only available after mount (SSR has no `document`).
  // Without this gate, callers rendered from inside a <tbody>/<tr> would
  // briefly emit the overlay <div> as a tbody child, tripping React's
  // hydration validator and silently breaking the modal.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onOpenChange(false);
      }
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onOpenChange]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === overlayRef.current) onOpenChange(false);
      }}
      className={cn(
        "fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 backdrop-blur-sm px-4 py-10",
        className,
      )}
    >
      <div
        className={cn(
          "w-full max-w-3xl rounded-lg border border-[var(--color-panel-border)] bg-[var(--color-panel)] shadow-[var(--shadow-card-hover)]",
          panelClassName,
        )}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function DialogHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="px-6 py-4 border-b border-[var(--color-panel-border)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-[var(--color-text)]">{title}</h2>
          {description ? (
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">{description}</p>
          ) : null}
        </div>
        {children}
      </div>
    </div>
  );
}

export function DialogBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("px-6 py-5", className)}>{children}</div>;
}

export function DialogFooter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "px-6 py-3 border-t border-[var(--color-panel-border)] flex justify-end gap-2",
        className,
      )}
    >
      {children}
    </div>
  );
}
