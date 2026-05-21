"use client";

import type { KeyboardEvent, MouseEvent } from "react";
import { Flag } from "lucide-react";
import { cn, formatDateDisplay, formatMoney } from "@/lib/utils";
import { RowStageChip } from "./RowStageChip";
import { useSpreadState } from "./SpreadStore";
import {
  COLUMN_ALIGN,
  COLUMN_IDS,
  COLUMN_LABELS,
  COLUMN_WIDTHS,
  type ColumnId,
  type SpreadDeal,
} from "./types";
import type { DealStage } from "@/lib/types";
import { useDealPanel } from "@/contexts/DealPanelContext";
import { useData } from "@/contexts/DataContext";

// Re-export the type for backward compat with `app/deals/page.tsx`.
export type { SpreadDeal } from "./types";

// The pipeline is a clickable list, not a spreadsheet. Each row's only job is
// to open the slide-out DealDetailPanel where editing, documents, and workflow
// live. Two in-row controls survive for fast triage:
//   1. Flag toggle — yellow-highlight a row for Richard's review.
//   2. Stage chip   — quick stage transition without opening the panel.
// Both stop click propagation so they don't double-trigger the row.
const EXPAND_COL_WIDTH = 28;
const STAGE_COL_WIDTH = 118;
const TABLE_COLUMN_COUNT = COLUMN_IDS.length + 2;

export function SpreadTable() {
  const { rowOrder } = useSpreadState();

  return (
    <div className="px-6 py-6 overflow-x-auto" data-spread-root>
      <div className="border border-[var(--color-panel-border)] rounded-md overflow-hidden">
        <table className="w-full border-collapse text-sm table-fixed">
          <colgroup>
            <col style={{ width: `${EXPAND_COL_WIDTH}px` }} />
            <col style={{ width: `${STAGE_COL_WIDTH}px` }} />
            {COLUMN_IDS.map((col) => {
              const w = COLUMN_WIDTHS[col];
              return <col key={col} style={w === null ? undefined : { width: `${w}px` }} />;
            })}
          </colgroup>
          <thead className="sticky top-0 z-20">
            <tr className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] border-b border-[var(--color-panel-border)] bg-[var(--color-panel)]">
              <th aria-hidden="true" />
              <th className="font-medium px-2 py-2 text-center">Stage</th>
              {COLUMN_IDS.map((col) => (
                <th
                  key={col}
                  className={cn(
                    "font-medium px-2 py-2",
                    COLUMN_ALIGN[col] === "right" && "text-right",
                    COLUMN_ALIGN[col] === "center" && "text-center",
                    COLUMN_ALIGN[col] === "left" && "text-left",
                  )}
                >
                  {COLUMN_LABELS[col]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <SectionHeader label="ACTIVES" count={rowOrder.actives.length} />
            {rowOrder.actives.length === 0 ? (
              <EmptyRow message="No active deals yet — use “+ Add deal” above." />
            ) : (
              rowOrder.actives.map((id) => <LeadRow key={id} dealId={id} />)
            )}

            <SectionHeader label="IN ESCROW" count={rowOrder.inEscrow.length} top />
            {rowOrder.inEscrow.length === 0 ? (
              <EmptyRow message="No deals in escrow — move a deal here from its stage chip." />
            ) : (
              rowOrder.inEscrow.map((id) => <LeadRow key={id} dealId={id} />)
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-3 text-[10px] text-[var(--color-text-faint)] px-1">
        Click a row to open it · Esc closes the panel
      </div>
    </div>
  );
}

// ─── Empty state row ──────────────────────────────────────────────────

function EmptyRow({ message }: { message: string }) {
  return (
    <tr>
      <td aria-hidden="true" />
      <td
        colSpan={TABLE_COLUMN_COUNT - 1}
        className="px-3 py-3 text-xs italic text-[var(--color-text-faint)] text-center"
      >
        {message}
      </td>
    </tr>
  );
}

// ─── Section header row ────────────────────────────────────────────────

function SectionHeader({
  label,
  count,
  top = false,
}: {
  label: string;
  count: number;
  top?: boolean;
}) {
  return (
    <tr className={cn("bg-[var(--color-bg-elevated)]", top && "border-t-2 border-[var(--color-border-strong)]")}>
      <td
        colSpan={TABLE_COLUMN_COUNT}
        className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text)]"
      >
        {label}
        <span className="ml-2 text-[var(--color-text-faint)] font-normal normal-case tracking-normal">
          {count} {count === 1 ? "deal" : "deals"}
        </span>
      </td>
    </tr>
  );
}

// ─── Row ───────────────────────────────────────────────────────────────

function LeadRow({ dealId }: { dealId: string }) {
  // Read the row straight from the provider (single source of truth). The
  // SpreadStore mirror is still used by DealDetailPanel for in-panel inline
  // edits, but the list itself should never lag behind a stage / flag / field
  // update made elsewhere — including from the panel.
  const { deals } = useData();
  const row = deals.find((d) => d.id === dealId);
  const { selectedId, open } = useDealPanel();
  if (!row) return null;
  const isActive = selectedId === dealId;

  function handleOpen() {
    open(dealId);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTableRowElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleOpen();
    }
  }

  return (
    <tr
      data-deal-id={dealId}
      role="button"
      tabIndex={0}
      aria-label={`Open deal: ${row.property.address || "(no address)"}`}
      aria-expanded={isActive}
      onClick={handleOpen}
      onKeyDown={handleKeyDown}
      className={cn(
        "border-b border-[var(--color-panel-border)] last:border-b-0 cursor-pointer outline-none",
        "hover:bg-[var(--color-bg-hover)] focus-visible:bg-[var(--color-bg-hover)]",
        isActive && "bg-[var(--color-bg-hover)]",
        row.flaggedForReview && "bg-[var(--color-highlight)] text-[var(--color-highlight-fg)] hover:bg-[var(--color-highlight)]",
      )}
    >
      {/* Leading column: pure visual indicator (no separate button). Left
          border turns accent when this row's panel is open. */}
      <td className="p-0 align-middle">
        <div
          aria-hidden="true"
          className={cn(
            "h-7 w-full border-l-2",
            isActive
              ? "border-[var(--color-accent)]"
              : "border-transparent",
          )}
        />
      </td>
      {/* Stage chip — keeps its native select behavior. stopPropagation here
          prevents clicking the chip from also opening the panel. */}
      <td
        className="p-0 align-middle text-center"
        onClick={stopRowEvent}
        onKeyDown={stopRowEvent}
      >
        <RowStageChip dealId={dealId} stage={row.stage as DealStage} />
      </td>
      {COLUMN_IDS.map((col) => (
        <td
          key={col}
          className={cn(
            "p-0 align-middle",
            COLUMN_ALIGN[col] === "right" && "text-right",
            COLUMN_ALIGN[col] === "center" && "text-center",
            COLUMN_ALIGN[col] === "left" && "text-left",
          )}
        >
          <DisplayCell dealId={dealId} col={col} row={row} />
        </td>
      ))}
    </tr>
  );
}

// Shared handler for in-row controls that should NOT bubble up to the row's
// click handler. Used by both onClick and onKeyDown so keyboard interaction
// with a control (e.g., opening the stage select via Space) doesn't also fire
// the row's "open panel" action.
function stopRowEvent(e: MouseEvent | KeyboardEvent) {
  e.stopPropagation();
}

// ─── Read-only display cells ──────────────────────────────────────────

function DisplayCell({
  dealId,
  col,
  row,
}: {
  dealId: string;
  col: ColumnId;
  row: SpreadDeal;
}) {
  switch (col) {
    case "flag":
      return <FlagCell dealId={dealId} flagged={row.flaggedForReview} />;
    case "address": {
      const subline = [
        row.property.city,
        [row.property.state, row.property.zip].filter(Boolean).join(" ").trim() || null,
      ]
        .filter(Boolean)
        .join(" · ");
      return (
        <div className="px-2 py-0.5 leading-tight">
          <div className="text-xs font-medium truncate">
            {row.property.address || "—"}
          </div>
          {subline ? (
            <div className="text-[10px] text-[var(--color-text-faint)] truncate">
              {subline}
            </div>
          ) : null}
        </div>
      );
    }
    case "agreedPrice":
      return <Money value={row.agreedPrice} />;
    case "listPrice":
      return <Money value={row.listPrice} />;
    case "expProfit": {
      const v =
        row.listPrice !== null && row.agreedPrice !== null
          ? row.listPrice - row.agreedPrice
          : null;
      return <Money value={v} muted />;
    }
    case "acceptanceDate":
      return <Plain text={formatDateDisplay(row.acceptanceDate)} placeholder="—" />;
    case "expirationDate":
      return <Plain text={formatDateDisplay(row.expirationDate)} placeholder="—" />;
    case "termOfAgreement":
      return <Plain text={row.termOfAgreement ?? ""} placeholder="—" />;
    case "owed": {
      const text = row.weOwn
        ? "WE OWN"
        : row.amountOwed === null || row.amountOwed === 0
          ? "-0-"
          : formatMoney(row.amountOwed);
      return (
        <div
          className={cn(
            "px-2 h-7 flex items-center justify-end text-xs font-mono tabular-nums",
            row.weOwn && "uppercase tracking-wider text-[var(--color-text-muted)]",
          )}
        >
          {text}
        </div>
      );
    }
    case "notes":
      return (
        <div
          className="px-2 h-7 flex items-center text-xs text-[var(--color-text-muted)] truncate"
          title={row.notes ?? undefined}
        >
          {row.notes || (
            <span className="text-[var(--color-text-faint)]">—</span>
          )}
        </div>
      );
  }
}

// Inline flag toggle. stopPropagation so toggling the flag doesn't open the
// panel underneath it. Routes through the provider directly so the visual
// state stays in lock-step with the data — no SpreadStore mirror to lag.
function FlagCell({ dealId, flagged }: { dealId: string; flagged: boolean }) {
  const { setDealFlag } = useData();
  const label = flagged ? "Unflag" : "Flag";
  return (
    <div className="px-2 h-7 flex items-center justify-center">
      <button
        type="button"
        aria-label={label}
        title={label}
        aria-pressed={flagged}
        onClick={(e) => {
          e.stopPropagation();
          void setDealFlag(dealId, !flagged);
        }}
        onKeyDown={stopRowEvent}
        className={cn(
          "inline-flex items-center justify-center w-5 h-5 rounded transition-colors",
          flagged
            ? "text-[var(--color-highlight-fg)]"
            : "text-[var(--color-text-faint)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-hover)]",
        )}
      >
        <Flag
          size={12}
          strokeWidth={2}
          fill={flagged ? "currentColor" : "none"}
        />
      </button>
    </div>
  );
}

function Money({ value, muted }: { value: number | null; muted?: boolean }) {
  return (
    <div
      className={cn(
        "px-2 h-7 flex items-center justify-end text-xs font-mono tabular-nums",
        muted && "text-[var(--color-text-muted)]",
      )}
    >
      {value === null ? "—" : formatMoney(value)}
    </div>
  );
}

function Plain({ text, placeholder }: { text: string; placeholder: string }) {
  return (
    <div className="px-2 h-7 flex items-center text-xs">
      {text || (
        <span className="text-[var(--color-text-faint)]">{placeholder}</span>
      )}
    </div>
  );
}
