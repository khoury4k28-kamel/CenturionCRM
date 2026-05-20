"use client";

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { Calendar as CalendarIcon, Flag } from "lucide-react";
import {
  cn,
  formatDateDisplay,
  formatMoney,
  parseDateInput,
  parseMoneyInput,
  parseTermInput,
} from "@/lib/utils";
import {
  useCellMeta,
  useSpreadActions,
  useSpreadRow,
} from "./SpreadStore";
import { AddressPopover } from "./AddressPopover";
import { COLUMN_ALIGN, isEditable, type ColumnId } from "./types";

type Props = {
  dealId: string;
  col: ColumnId;
};

export function SpreadCell({ dealId, col }: Props) {
  const row = useSpreadRow(dealId);
  if (!row) return null;

  switch (col) {
    case "flag":
      return <FlagCell dealId={dealId} flagged={row.flaggedForReview} />;
    case "address":
      return (
        <AddressCell
          dealId={dealId}
          address={row.property.address}
          city={row.property.city}
          state={row.property.state}
          zip={row.property.zip}
        />
      );
    case "agreedPrice":
      return <MoneyCell dealId={dealId} col="agreedPrice" value={row.agreedPrice} />;
    case "listPrice":
      return <MoneyCell dealId={dealId} col="listPrice" value={row.listPrice} />;
    case "expProfit": {
      const v =
        row.listPrice !== null && row.agreedPrice !== null
          ? row.listPrice - row.agreedPrice
          : null;
      return <DerivedCell dealId={dealId} col="expProfit" value={v} />;
    }
    case "acceptanceDate":
      return <DateCell dealId={dealId} col="acceptanceDate" value={row.acceptanceDate} />;
    case "expirationDate":
      // Anchor "N days" entry to the accepted date when present — typing "60"
      // in expiration almost always means "60 days after acceptance", not 60
      // days from today.
      return (
        <DateCell
          dealId={dealId}
          col="expirationDate"
          value={row.expirationDate}
          anchor={row.acceptanceDate}
        />
      );
    case "termOfAgreement":
      return <TextCell dealId={dealId} col="termOfAgreement" value={row.termOfAgreement} />;
    case "owed":
      return <OwedCell dealId={dealId} amountOwed={row.amountOwed} weOwn={row.weOwn} />;
    case "notes":
      return <NotesCell dealId={dealId} value={row.notes} />;
  }
}

// ─── Shared cell shell ─────────────────────────────────────────────────
// Every editable cell sits in a fixed-height (h-7 = 28px) container with a 1px border.
// The border is transparent when idle, accent when selected or editing. This guarantees
// that switching between display and edit modes never changes the box dimensions.

function CellShell({
  dealId,
  col,
  children,
  onClick,
  className,
  flaggedRow,
}: {
  dealId: string;
  col: ColumnId;
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
  flaggedRow?: boolean;
}) {
  const meta = useCellMeta(dealId, col);
  const { selectCell, enterEdit } = useSpreadActions();

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClick) {
      onClick(e);
      return;
    }
    if (!meta.selected) selectCell(dealId, col);
    if (isEditable(col) && !meta.editing) enterEdit();
  };

  return (
    <div
      onMouseDown={handleMouseDown}
      className={cn(
        "relative h-7 w-full cursor-text",
        "border border-transparent box-border",
        // hover hint when not selected
        !meta.selected && !meta.editing && "hover:bg-[var(--color-bg-hover)]",
        // selection / edit border
        (meta.selected || meta.editing) && "border-[var(--color-accent)] z-10",
        // flash on undo/redo
        meta.flashing && !meta.editing && "bg-[var(--color-accent)]/15",
        // flagged-row inherit handles its own coloring via parent <tr>
        className,
      )}
      data-cell={`${dealId}:${col}`}
    >
      {children}
      <SaveDot status={meta.status} flaggedRow={flaggedRow ?? false} />
    </div>
  );
}

// ─── Save status dot ──────────────────────────────────────────────────

function SaveDot({ status, flaggedRow }: { status: "idle" | "saving" | "saved" | "failed"; flaggedRow: boolean }) {
  if (status === "idle") return null;
  const color =
    status === "saving"
      ? "bg-[var(--color-accent)]"
      : status === "saved"
        ? "bg-[var(--color-success)]"
        : "bg-[var(--color-danger)]";
  return (
    <span
      className={cn(
        "absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full pointer-events-none",
        color,
        status === "saving" && "animate-pulse",
        flaggedRow && "ring-1 ring-[var(--color-highlight)]",
      )}
      aria-hidden="true"
    />
  );
}

// ─── Flag cell ────────────────────────────────────────────────────────

function FlagCell({ dealId, flagged }: { dealId: string; flagged: boolean }) {
  const { commitFlag, selectCell } = useSpreadActions();
  const meta = useCellMeta(dealId, "flag");

  return (
    <CellShell
      dealId={dealId}
      col="flag"
      onClick={(e) => {
        e.stopPropagation();
        if (!meta.selected) selectCell(dealId, "flag");
        commitFlag(dealId, !flagged);
      }}
      className="flex items-center justify-center cursor-pointer"
    >
      <Flag
        size={14}
        strokeWidth={2}
        fill={flagged ? "currentColor" : "none"}
        className={
          flagged
            ? "text-[var(--color-highlight-fg)]"
            : "text-[var(--color-text-faint)] hover:text-[var(--color-text)]"
        }
      />
    </CellShell>
  );
}

// ─── Address cell (popover editor) ────────────────────────────────────

function AddressCell({
  dealId,
  address,
  city,
  state,
  zip,
}: {
  dealId: string;
  address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
}) {
  const meta = useCellMeta(dealId, "address");
  const { exitEdit } = useSpreadActions();
  const anchorRef = useRef<HTMLDivElement>(null);

  const subline = [city, [state, zip].filter(Boolean).join(" ").trim() || null]
    .filter(Boolean)
    .join(" · ");

  return (
    <div ref={anchorRef}>
      <CellShell dealId={dealId} col="address" className="h-auto min-h-7">
        <div className="px-2 py-0.5 leading-tight text-left text-xs">
          <div className="text-[var(--color-text)] font-medium truncate">{address || "—"}</div>
          {subline ? (
            <div className="text-[10px] text-[var(--color-text-faint)] truncate">{subline}</div>
          ) : null}
        </div>
      </CellShell>
      {meta.editing ? (
        <AddressPopover
          dealId={dealId}
          initial={{ address, city, state, zip }}
          anchorRef={anchorRef}
          onClose={exitEdit}
        />
      ) : null}
    </div>
  );
}

// ─── Money cell ───────────────────────────────────────────────────────

function MoneyCell({
  dealId,
  col,
  value,
}: {
  dealId: string;
  col: "agreedPrice" | "listPrice";
  value: number | null;
}) {
  return (
    <EditableTextCell
      dealId={dealId}
      col={col}
      displayValue={value === null ? "" : formatMoney(value)}
      onCommit={(v, actions) => {
        const trimmed = v.trim();
        const n = trimmed === "" ? null : parseMoneyInput(trimmed);
        actions.commitField(dealId, col, n);
      }}
      validate={(d) => d.trim() === "" || parseMoneyInput(d) !== null}
      mono
      placeholder="—"
    />
  );
}

// ─── Date cell ─────────────────────────────────────────────────────────
// Hybrid: a text input for typing ("60" / "7/19" / "Jul 19" / "2026-07-19") AND
// a calendar icon that opens the browser's native date picker. The picker
// itself can't accept the shorthand input — it's locked to ISO — so we drive
// it from a hidden <input type="date"> and trigger showPicker() from a
// dedicated icon button. Selection in the picker commits the ISO date
// directly; typing still flows through parseDateInput on Enter/Tab/blur.
function DateCell({
  dealId,
  col,
  value,
  anchor,
}: {
  dealId: string;
  col: "acceptanceDate" | "expirationDate";
  value: string | null;
  anchor?: string | null;
}) {
  const meta = useCellMeta(dealId, col);
  const actions = useSpreadActions();
  const textRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLInputElement>(null);
  const align = COLUMN_ALIGN[col];
  const alignCls =
    align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";

  const displayValue = formatDateDisplay(value);
  const [draft, setDraft] = useState(displayValue);
  const focusedRef = useRef(false);
  const justHandledRef = useRef(false);

  useLayoutEffect(() => {
    if (!focusedRef.current) setDraft(displayValue);
  }, [displayValue]);

  useEffect(() => {
    if (meta.editing && document.activeElement !== textRef.current) {
      textRef.current?.focus();
      textRef.current?.select();
    }
  }, [meta.editing]);

  function commitText(text: string): boolean {
    const trimmed = text.trim();
    if (trimmed === "") {
      actions.commitField(dealId, col, null);
      setDraft(displayValue);
      return true;
    }
    const iso = parseDateInput(trimmed, anchor);
    if (iso === null) {
      setDraft(displayValue);
      return false;
    }
    actions.commitField(dealId, col, iso);
    setDraft(displayValue);
    return true;
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      focusedRef.current = false;
      justHandledRef.current = true;
      commitText(draft);
      actions.exitEdit();
      actions.navigate("down");
      textRef.current?.blur();
    } else if (e.key === "Tab") {
      e.preventDefault();
      focusedRef.current = false;
      justHandledRef.current = true;
      commitText(draft);
      actions.exitEdit();
      actions.navigate(e.shiftKey ? "shiftTab" : "tab");
      textRef.current?.blur();
    } else if (e.key === "Escape") {
      e.preventDefault();
      focusedRef.current = false;
      justHandledRef.current = true;
      setDraft(displayValue);
      actions.exitEdit();
      textRef.current?.blur();
    }
  }

  function openPicker(e: React.MouseEvent) {
    // mousedown on the icon would otherwise blur the text input and steal
    // selection. preventDefault keeps focus where it is; stopPropagation keeps
    // CellShell from also dispatching its own select/enterEdit (since the
    // picker handles the change itself).
    e.preventDefault();
    e.stopPropagation();
    pickerRef.current?.showPicker?.();
  }

  return (
    <CellShell dealId={dealId} col={col}>
      <input
        ref={textRef}
        type="text"
        value={draft}
        placeholder="—"
        title="Type a date, a number of days, or click the calendar icon"
        onFocus={(e) => {
          focusedRef.current = true;
          justHandledRef.current = false;
          actions.enterEdit();
          e.currentTarget.select();
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => {
          focusedRef.current = false;
          if (justHandledRef.current) {
            justHandledRef.current = false;
            return;
          }
          commitText(e.currentTarget.value);
        }}
        onKeyDown={onKey}
        className={cn(
          "absolute inset-0 w-full h-full pl-2 pr-7 text-xs bg-transparent outline-none",
          alignCls,
          "placeholder:text-[var(--color-text-faint)]",
        )}
      />
      <button
        type="button"
        tabIndex={-1}
        onMouseDown={openPicker}
        title="Pick from calendar"
        className="absolute right-0.5 top-1/2 -translate-y-1/2 z-20 inline-flex h-5 w-5 items-center justify-center rounded text-[var(--color-text-faint)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-hover)] cursor-pointer"
      >
        <CalendarIcon size={12} strokeWidth={1.75} />
      </button>
      {/*
        Hidden <input type="date"> hosts the native picker. We keep it in the
        layout (opacity-0, pointer-events-none) instead of display:none so
        showPicker() works across browsers — Chrome/Safari treat fully hidden
        inputs as ineligible. onChange fires when the user picks a date from
        the popup.
      */}
      <input
        ref={pickerRef}
        type="date"
        value={value ?? ""}
        onChange={(e) => {
          actions.commitField(dealId, col, e.target.value || null);
        }}
        tabIndex={-1}
        aria-hidden="true"
        className="absolute right-0.5 top-1/2 -translate-y-1/2 h-5 w-5 opacity-0 pointer-events-none"
      />
    </CellShell>
  );
}

// ─── Plain text cell (termOfAgreement) ────────────────────────────────

function TextCell({
  dealId,
  col,
  value,
}: {
  dealId: string;
  col: "termOfAgreement";
  value: string | null;
}) {
  return (
    <EditableTextCell
      dealId={dealId}
      col={col}
      displayValue={value ?? ""}
      onCommit={(v, actions) => actions.commitField(dealId, col, parseTermInput(v))}
      placeholder="—"
      title='Type a duration ("60", "60 days") or free text'
    />
  );
}

// ─── Notes cell ────────────────────────────────────────────────────────
// The textarea is ALWAYS rendered so a single click focuses it natively. The
// previous implementation swapped <span> ↔ <textarea> on the editing flag,
// which meant the first click landed on a non-focusable span and focus had to
// transfer via useEffect after a re-render — that race was the "sometimes I
// have to double-click" symptom.
//
// When not editing we clamp height to 28px with overflow-hidden so long /
// multi-line content visually truncates to a single row. On focus the
// textarea grows via autoResize, matching the prior editing layout.
function NotesCell({ dealId, value }: { dealId: string; value: string | null }) {
  const meta = useCellMeta(dealId, "notes");
  const actions = useSpreadActions();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState(value ?? "");
  const focusedRef = useRef(false);
  const justHandledRef = useRef(false);

  useLayoutEffect(() => {
    if (!focusedRef.current) setDraft(value ?? "");
  }, [value]);

  useEffect(() => {
    if (meta.editing && ref.current) autoResize(ref.current);
  }, [meta.editing]);

  return (
    <CellShell
      dealId={dealId}
      col="notes"
      className={meta.editing ? "h-auto min-h-7" : undefined}
    >
      <textarea
        ref={ref}
        value={draft}
        rows={1}
        placeholder="—"
        title={!meta.editing && value ? value : undefined}
        onFocus={(e) => {
          focusedRef.current = true;
          justHandledRef.current = false;
          actions.enterEdit();
          autoResize(e.currentTarget);
          e.currentTarget.select();
        }}
        onChange={(e) => {
          setDraft(e.target.value);
          autoResize(e.currentTarget);
        }}
        onBlur={(e) => {
          focusedRef.current = false;
          if (justHandledRef.current) {
            justHandledRef.current = false;
          } else {
            actions.commitField(dealId, "notes", e.currentTarget.value);
          }
          // Reset inline height so the cell collapses back to a single row.
          e.currentTarget.style.height = "";
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            focusedRef.current = false;
            justHandledRef.current = true;
            actions.commitField(dealId, "notes", draft);
            actions.exitEdit();
            actions.navigate("down");
            ref.current?.blur();
          } else if (e.key === "Tab") {
            e.preventDefault();
            focusedRef.current = false;
            justHandledRef.current = true;
            actions.commitField(dealId, "notes", draft);
            actions.exitEdit();
            actions.navigate(e.shiftKey ? "shiftTab" : "tab");
            ref.current?.blur();
          } else if (e.key === "Escape") {
            e.preventDefault();
            focusedRef.current = false;
            justHandledRef.current = true;
            setDraft(value ?? "");
            actions.exitEdit();
            ref.current?.blur();
          }
          // Shift+Enter passes through for newline.
        }}
        className={cn(
          "block w-full px-2 text-xs bg-transparent outline-none resize-none leading-tight",
          "placeholder:text-[var(--color-text-faint)]",
          meta.editing ? "py-1" : "py-0 leading-7 overflow-hidden",
          !value && !meta.editing && "text-[var(--color-text-faint)]",
        )}
        style={{
          minHeight: meta.editing ? 24 : undefined,
          height: meta.editing ? undefined : 28,
        }}
      />
    </CellShell>
  );
}

// ─── Owed cell (parses raw string like the server) ─────────────────────

function OwedCell({
  dealId,
  amountOwed,
  weOwn,
}: {
  dealId: string;
  amountOwed: number | null;
  weOwn: boolean;
}) {
  const displayValue = weOwn
    ? "WE OWN"
    : amountOwed === null || amountOwed === 0
      ? ""
      : formatMoney(amountOwed);

  return (
    <EditableTextCell
      dealId={dealId}
      col="owed"
      displayValue={displayValue}
      onCommit={(v, actions) => actions.commitOwed(dealId, v)}
      validate={isValidOwedDraft}
      mono
      placeholder="-0-"
      title='Type a number, "we own", or leave blank for -0-'
    />
  );
}

function isValidOwedDraft(d: string): boolean {
  const s = d.trim().toLowerCase();
  if (s === "" || s === "0" || s === "-0-" || s === "-") return true;
  if (s.includes("own")) return true;
  const n = Number(s.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n);
}

// ─── Derived cell (read-only) ──────────────────────────────────────────

function DerivedCell({
  dealId,
  col,
  value,
}: {
  dealId: string;
  col: "expProfit";
  value: number | null;
}) {
  return (
    <CellShell dealId={dealId} col={col} className="cursor-default">
      <span
        className={cn(
          "block w-full px-2 leading-7 text-xs font-mono tabular-nums truncate text-right",
          value === null && "text-[var(--color-text-faint)]",
          value !== null && value < 0 && "text-[var(--color-danger)]",
        )}
      >
        {value === null ? "—" : formatMoney(value)}
      </span>
    </CellShell>
  );
}

// ─── Shared editable text/input cell ───────────────────────────────────
// Always-rendered input. Local `draft` is what the user sees; the store value
// arrives via `displayValue`. Three pieces are load-bearing for consistent
// formatting:
//
//   1. The useEffect resyncs draft → displayValue whenever the store value
//      changes AND we aren't focused. Covers undo/redo, server pushes, etc.
//
//   2. commitOrRevert *always* setDraft(displayValue) after a successful
//      commit. This is what makes "40000" snap to "$40,000" even when the
//      parsed value equals the stored value — in that case the store doesn't
//      dispatch, displayValue never changes, and the useEffect wouldn't fire.
//
//   3. justHandledRef gates the blur-time commit. When Enter/Tab/Escape fire,
//      they call commitOrRevert themselves and we must NOT let the subsequent
//      blur run it again — that would read a stale stateRef and dispatch a
//      reverting op against our just-applied change.
function EditableTextCell({
  dealId,
  col,
  displayValue,
  onCommit,
  validate,
  inputType = "text",
  mono = false,
  placeholder,
  title,
}: {
  dealId: string;
  col: ColumnId;
  displayValue: string;
  onCommit: (value: string, actions: ReturnType<typeof useSpreadActions>) => void;
  validate?: (draft: string) => boolean;
  inputType?: "text" | "date";
  mono?: boolean;
  placeholder?: string;
  title?: string;
}) {
  const meta = useCellMeta(dealId, col);
  const actions = useSpreadActions();
  const ref = useRef<HTMLInputElement>(null);
  const align = COLUMN_ALIGN[col];
  const alignCls =
    align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";

  const [draft, setDraft] = useState(displayValue);
  const focusedRef = useRef(false);
  const justHandledRef = useRef(false);

  // useLayoutEffect (not useEffect) so the draft resyncs BEFORE paint when
  // displayValue changes. Otherwise the user briefly sees the OLD canonical
  // value (set by commitOrRevert's snap-back) before the next-render resync.
  useLayoutEffect(() => {
    if (!focusedRef.current) setDraft(displayValue);
  }, [displayValue]);

  useEffect(() => {
    if (meta.editing && document.activeElement !== ref.current) {
      ref.current?.focus();
      ref.current?.select();
    }
  }, [meta.editing]);

  function commitOrRevert(value: string): boolean {
    if (validate && !validate(value)) {
      setDraft(displayValue);
      return false;
    }
    onCommit(value, actions);
    // Snap to the canonical formatted form. Two cases:
    //   • No-op commit (parsed value equals stored): displayValue won't change,
    //     useEffect won't fire — without this line the raw typed text stays.
    //   • Value-changing commit: this briefly sets draft to the OLD display,
    //     but React batches with the dispatch above so the next render carries
    //     the new displayValue and the useEffect resyncs before paint.
    setDraft(displayValue);
    return true;
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      focusedRef.current = false;
      justHandledRef.current = true;
      commitOrRevert(draft);
      actions.exitEdit();
      actions.navigate("down");
      ref.current?.blur();
    } else if (e.key === "Tab") {
      e.preventDefault();
      focusedRef.current = false;
      justHandledRef.current = true;
      commitOrRevert(draft);
      actions.exitEdit();
      actions.navigate(e.shiftKey ? "shiftTab" : "tab");
      ref.current?.blur();
    } else if (e.key === "Escape") {
      e.preventDefault();
      focusedRef.current = false;
      justHandledRef.current = true;
      setDraft(displayValue);
      actions.exitEdit();
      ref.current?.blur();
    }
  }

  return (
    <CellShell dealId={dealId} col={col}>
      <input
        ref={ref}
        type={inputType}
        value={draft}
        placeholder={placeholder}
        title={title}
        onFocus={(e) => {
          focusedRef.current = true;
          justHandledRef.current = false;
          actions.enterEdit();
          e.currentTarget.select();
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => {
          focusedRef.current = false;
          // Skip when a key handler just ran commitOrRevert. Without this guard
          // the blur fires a second commit against stateRef.current — which is
          // still pre-dispatch — and ends up reverting the keyboard commit.
          if (justHandledRef.current) {
            justHandledRef.current = false;
            return;
          }
          commitOrRevert(e.currentTarget.value);
        }}
        onKeyDown={onKey}
        className={cn(
          "absolute inset-0 w-full h-full px-2 text-xs bg-transparent outline-none",
          alignCls,
          mono && "font-mono tabular-nums",
          "placeholder:text-[var(--color-text-faint)]",
        )}
      />
    </CellShell>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────

function autoResize(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 120) + "px";
}
