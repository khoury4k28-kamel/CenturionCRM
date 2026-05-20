"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

export type PopoverPlacement = "bottom-start" | "bottom-end" | "top-start" | "top-end";

// Anchor-positioned portal popover. Extracted from AddressPopover so it can
// be reused by DealCombobox, QuickReschedulePopover, and the stage-task tray.
//
// - Renders nothing when `open` is false (no portal mount).
// - Closes on outside mousedown (capture-phase so child stopPropagation can't swallow).
// - Closes on Escape.
// - Repositions on window resize.
//
// The popover's own contents handle keyboard interaction; this component
// only handles the boundary behavior.
export function Popover({
  anchorRef,
  open,
  onClose,
  placement = "bottom-start",
  offset = 4,
  className,
  children,
}: {
  anchorRef: RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  placement?: PopoverPlacement;
  offset?: number;
  className?: string;
  children: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return;
    setCoords(computeCoords(anchorRef.current.getBoundingClientRect(), placement, offset));
  }, [open, anchorRef, placement, offset]);

  useEffect(() => {
    if (!open) return;
    function reposition() {
      if (!anchorRef.current) return;
      setCoords(computeCoords(anchorRef.current.getBoundingClientRect(), placement, offset));
    }
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open, anchorRef, placement, offset]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (!rootRef.current) return;
      if (rootRef.current.contains(e.target as Node)) return;
      if (anchorRef.current?.contains(e.target as Node)) return;
      onClose();
    }
    document.addEventListener("mousedown", onMouseDown, true);
    return () => document.removeEventListener("mousedown", onMouseDown, true);
  }, [open, anchorRef, onClose]);

  if (!open || !mounted || !coords) return null;

  return createPortal(
    <div
      ref={rootRef}
      style={{ position: "fixed", top: coords.top, left: coords.left }}
      className={cn(
        "z-50 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-panel)] shadow-lg",
        className,
      )}
    >
      {children}
    </div>,
    document.body,
  );
}

function computeCoords(
  rect: DOMRect,
  placement: PopoverPlacement,
  offset: number,
): { top: number; left: number } {
  switch (placement) {
    case "bottom-start":
      return { top: rect.bottom + offset, left: rect.left };
    case "bottom-end":
      return { top: rect.bottom + offset, left: rect.right };
    case "top-start":
      return { top: rect.top - offset, left: rect.left };
    case "top-end":
      return { top: rect.top - offset, left: rect.right };
  }
}
