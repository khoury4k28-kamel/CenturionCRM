"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import { Flag } from "lucide-react";
import { cn, formatMoney } from "@/lib/utils";
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
      return <DateCell dealId={dealId} col="expirationDate" value={row.expirationDate} />;
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
  const display = value === null ? "—" : formatMoney(value);
  return (
    <EditableTextCell
      dealId={dealId}
      col={col}
      initialDraft={value === null ? "" : String(value)}
      onCommit={(v, actions) => actions.commitField(dealId, col, v)}
      mono
      placeholder="—"
    >
      <span
        className={cn(
          "block w-full px-2 leading-7 text-xs font-mono tabular-nums truncate",
          value === null && "text-[var(--color-text-faint)]",
        )}
      >
        {display}
      </span>
    </EditableTextCell>
  );
}

// ─── Date cell ─────────────────────────────────────────────────────────

function DateCell({
  dealId,
  col,
  value,
}: {
  dealId: string;
  col: "acceptanceDate" | "expirationDate";
  value: string | null;
}) {
  const display = formatDateShort(value);
  return (
    <EditableTextCell
      dealId={dealId}
      col={col}
      initialDraft={value ?? ""}
      onCommit={(v, actions) => actions.commitField(dealId, col, v)}
      inputType="date"
    >
      <span
        className={cn(
          "block w-full px-2 leading-7 text-xs truncate",
          !value && "text-[var(--color-text-faint)]",
        )}
      >
        {display || "—"}
      </span>
    </EditableTextCell>
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
      initialDraft={value ?? ""}
      onCommit={(v, actions) => actions.commitField(dealId, col, v)}
    >
      <span
        className={cn(
          "block w-full px-2 leading-7 text-xs truncate",
          !value && "text-[var(--color-text-faint)]",
        )}
      >
        {value || "—"}
      </span>
    </EditableTextCell>
  );
}

// ─── Notes cell (multiline textarea on edit) ───────────────────────────

function NotesCell({ dealId, value }: { dealId: string; value: string | null }) {
  const meta = useCellMeta(dealId, "notes");
  const { commitField, exitEdit, navigate } = useSpreadActions();
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (meta.editing) {
      ref.current?.focus();
      ref.current?.select();
    }
  }, [meta.editing]);

  return (
    <CellShell
      dealId={dealId}
      col="notes"
      // Notes can grow when editing; otherwise constrained to h-7.
      className={meta.editing ? "h-auto min-h-7" : undefined}
      // Override: textarea consumes Enter, so we want it to ALSO commit-on-Enter.
      // The mousedown handler is fine.
    >
      {meta.editing ? (
        <textarea
          ref={ref}
          defaultValue={value ?? ""}
          rows={1}
          onInput={(e) => autoResize(e.currentTarget)}
          onBlur={(e) => {
            // Commit only; let selection changes handle exitEdit (see EditableTextCell note).
            commitField(dealId, "notes", e.currentTarget.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              commitField(dealId, "notes", e.currentTarget.value);
              exitEdit();
              navigate("down");
            } else if (e.key === "Tab") {
              e.preventDefault();
              commitField(dealId, "notes", e.currentTarget.value);
              exitEdit();
              navigate(e.shiftKey ? "shiftTab" : "tab");
            } else if (e.key === "Escape") {
              e.preventDefault();
              exitEdit();
            }
            // Shift+Enter passes through for newline.
          }}
          className="block w-full px-2 py-1 text-xs bg-transparent outline-none resize-none leading-tight"
          style={{ minHeight: 24 }}
        />
      ) : (
        <span
          className={cn(
            "block w-full px-2 leading-7 text-xs truncate",
            !value && "text-[var(--color-text-faint)]",
          )}
          title={value ?? undefined}
        >
          {value || "—"}
        </span>
      )}
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
  const display = weOwn
    ? "WE OWN"
    : amountOwed === null || amountOwed === 0
      ? "-0-"
      : formatMoney(amountOwed);

  const draft = weOwn
    ? "WE OWN"
    : amountOwed === null || amountOwed === 0
      ? ""
      : String(amountOwed);

  return (
    <EditableTextCell
      dealId={dealId}
      col="owed"
      initialDraft={draft}
      onCommit={(v, actions) => actions.commitOwed(dealId, v)}
      mono
      placeholder="-0-"
      title='Type a number, "we own", or leave blank for -0-'
    >
      <span
        className={cn(
          "block w-full px-2 leading-7 text-xs font-mono tabular-nums truncate",
          weOwn && "text-[var(--color-info)]",
          !weOwn && (amountOwed === null || amountOwed === 0) && "text-[var(--color-text-faint)]",
        )}
      >
        {display}
      </span>
    </EditableTextCell>
  );
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
// Renders an input when editing, else renders the provided display child.

function EditableTextCell({
  dealId,
  col,
  initialDraft,
  onCommit,
  children,
  inputType = "text",
  mono = false,
  placeholder,
  title,
}: {
  dealId: string;
  col: ColumnId;
  initialDraft: string;
  onCommit: (value: string, actions: ReturnType<typeof useSpreadActions>) => void;
  children: React.ReactNode;
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

  useEffect(() => {
    if (meta.editing) {
      ref.current?.focus();
      ref.current?.select();
    }
  }, [meta.editing]);

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      onCommit(e.currentTarget.value, actions);
      actions.exitEdit();
      actions.navigate("down");
    } else if (e.key === "Tab") {
      e.preventDefault();
      onCommit(e.currentTarget.value, actions);
      actions.exitEdit();
      actions.navigate(e.shiftKey ? "shiftTab" : "tab");
    } else if (e.key === "Escape") {
      e.preventDefault();
      actions.exitEdit();
    }
  }

  return (
    <CellShell dealId={dealId} col={col}>
      {meta.editing ? (
        <input
          ref={ref}
          type={inputType}
          defaultValue={initialDraft}
          placeholder={placeholder}
          title={title}
          onBlur={(e) => {
            // Always commit on blur. Don't dispatch exitEdit here — if focus moved to
            // another cell, that cell's mousedown already updated selection (which resets
            // `editing`); calling exitEdit here would race and clobber that update.
            onCommit(e.currentTarget.value, actions);
          }}
          onKeyDown={onKey}
          // Block native browser undo from triggering anything weird:
          // the input handles its own text undo internally.
          className={cn(
            "absolute inset-0 w-full h-full px-2 text-xs bg-[var(--color-bg)] outline-none",
            alignCls,
            mono && "font-mono tabular-nums",
          )}
        />
      ) : (
        <div className={cn("h-full w-full flex items-center", alignCls === "text-right" && "justify-end", alignCls === "text-center" && "justify-center")}>
          {children}
        </div>
      )}
    </CellShell>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────

function formatDateShort(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const yy = d.getUTCFullYear();
  return `${mm}/${dd}/${yy}`;
}

function autoResize(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 120) + "px";
}
