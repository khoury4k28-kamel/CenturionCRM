"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { useSpreadActions, type AddressBundle } from "./SpreadStore";

export function AddressPopover({
  dealId,
  initial,
  anchorRef,
  onClose,
}: {
  dealId: string;
  initial: AddressBundle;
  // The DOM element the popover should anchor to (the address cell).
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
}) {
  const { commitAddress } = useSpreadActions();
  const [address, setAddress] = useState(initial.address);
  const [city, setCity] = useState(initial.city ?? "");
  const [state, setState] = useState(initial.state ?? "");
  const [zip, setZip] = useState(initial.zip ?? "");
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const firstRef = useRef<HTMLInputElement>(null);
  const skipUnmountSaveRef = useRef(false);

  // Keep latest input values accessible inside the unmount-cleanup closure.
  const valuesRef = useRef({ address, city, state, zip });
  valuesRef.current = { address, city, state, zip };

  // SSR safety: portals require document.body, which doesn't exist server-side.
  useEffect(() => setMounted(true), []);

  // Position the popover. Use layout effect so it appears in the right place on the first paint.
  useLayoutEffect(() => {
    if (!anchorRef.current) return;
    const r = anchorRef.current.getBoundingClientRect();
    setCoords({ top: r.bottom + 4, left: r.left });
  }, [anchorRef]);

  // Reposition on window resize. (Skipping scroll listener for simplicity — short-lived popover.)
  useEffect(() => {
    function reposition() {
      if (!anchorRef.current) return;
      const r = anchorRef.current.getBoundingClientRect();
      setCoords({ top: r.bottom + 4, left: r.left });
    }
    window.addEventListener("resize", reposition);
    return () => window.removeEventListener("resize", reposition);
  }, [anchorRef]);

  useEffect(() => {
    firstRef.current?.focus();
    firstRef.current?.select();
  }, []);

  const commitNow = useCallback(() => {
    const v = valuesRef.current;
    commitAddress(dealId, {
      address: v.address.trim() || initial.address,
      city: v.city.trim() || null,
      state: v.state.trim() || null,
      zip: v.zip.trim() || null,
    });
  }, [dealId, initial.address, commitAddress]);

  const save = useCallback(() => {
    skipUnmountSaveRef.current = true;
    commitNow();
    onClose();
  }, [commitNow, onClose]);

  const cancel = useCallback(() => {
    skipUnmountSaveRef.current = true;
    onClose();
  }, [onClose]);

  // Save on unmount unless explicitly saved/cancelled. Safety net for cases where the
  // click-outside listener can't catch a target cell's React stopPropagation.
  useEffect(() => {
    return () => {
      if (!skipUnmountSaveRef.current) commitNow();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Esc cancels, Cmd-Enter saves. Capture-phase so it wins over the global SpreadStore listener.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        cancel();
      } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        save();
      }
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [save, cancel]);

  // Click outside popover → save. Capture-phase so a target cell's stopPropagation can't
  // swallow the event before we see it.
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (!rootRef.current) return;
      if (rootRef.current.contains(e.target as Node)) return;
      // Also ignore clicks on the anchor cell itself (the cell that triggered this popover) —
      // re-clicking the address cell shouldn't save+reopen.
      if (anchorRef.current?.contains(e.target as Node)) return;
      save();
    }
    document.addEventListener("mousedown", onMouseDown, true);
    return () => document.removeEventListener("mousedown", onMouseDown, true);
  }, [save, anchorRef]);

  if (!mounted || !coords) return null;

  return createPortal(
    <div
      ref={rootRef}
      style={{ position: "fixed", top: coords.top, left: coords.left }}
      className="z-50 w-[360px] rounded-md border border-[var(--color-border-strong)] bg-[var(--color-panel)] shadow-lg p-3 space-y-2"
    >
      <label className="block">
        <span className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">Street address</span>
        <input
          ref={firstRef}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="mt-0.5 w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-2 py-1 text-sm"
        />
      </label>
      <label className="block">
        <span className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">City</span>
        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="mt-0.5 w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-2 py-1 text-sm"
        />
      </label>
      <div className="flex gap-2">
        <label className="block w-24">
          <span className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">State</span>
          <input
            value={state}
            onChange={(e) => setState(e.target.value.toUpperCase().slice(0, 2))}
            className="mt-0.5 w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-2 py-1 text-sm uppercase tracking-wider"
            maxLength={2}
          />
        </label>
        <label className="block flex-1">
          <span className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">ZIP</span>
          <input
            value={zip}
            onChange={(e) => setZip(e.target.value)}
            className="mt-0.5 w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-2 py-1 text-sm font-mono"
            maxLength={10}
          />
        </label>
      </div>
      <div className="flex justify-between items-center pt-1">
        <span className="text-[10px] text-[var(--color-text-faint)]">⌘↵ saves · esc cancels</span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={cancel}
            className="text-xs px-2 py-1 rounded text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            className="text-xs px-3 py-1 rounded bg-[var(--color-accent)] text-[var(--color-accent-fg)] hover:bg-[var(--color-accent-hover)]"
          >
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
