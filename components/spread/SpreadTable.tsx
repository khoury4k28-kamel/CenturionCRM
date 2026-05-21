"use client";

import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { SpreadCell } from "./SpreadCell";
import { RowStageChip } from "./RowStageChip";
import { useSpreadRow, useSpreadState } from "./SpreadStore";
import {
  COLUMN_IDS,
  COLUMN_LABELS,
  COLUMN_WIDTHS,
  COLUMN_ALIGN,
} from "./types";
import type { DealStage } from "@/lib/types";
import { useDealPanel } from "@/contexts/DealPanelContext";

// Re-export the type for backward compat with `app/deals/page.tsx`.
export type { SpreadDeal } from "./types";

// Two leading <td>s sit OUTSIDE the COLUMN_IDS model so the SpreadStore's
// keyboard navigation (Tab / arrows) skips them — neither has a useful
// in-cell text-editing action to focus:
//   1. Expand chevron — opens the slide-out detail panel.
//   2. Stage chip    — moves the deal between pipeline stages.
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
              rowOrder.actives.map((id) => <SpreadRow key={id} dealId={id} />)
            )}

            <SectionHeader label="IN ESCROW" count={rowOrder.inEscrow.length} top />
            {rowOrder.inEscrow.length === 0 ? (
              <EmptyRow message="No deals in escrow — move a deal here from its stage chip." />
            ) : (
              rowOrder.inEscrow.map((id) => <SpreadRow key={id} dealId={id} />)
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-3 text-[10px] text-[var(--color-text-faint)] px-1">
        click to edit · enter saves & moves down · tab moves right · esc cancels · ⌘Z undo
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

function SpreadRow({ dealId }: { dealId: string }) {
  const row = useSpreadRow(dealId);
  const { selectedId, open } = useDealPanel();
  if (!row) return null;
  const isActive = selectedId === dealId;
  return (
    <tr
      data-deal-id={dealId}
      className={cn(
        "border-b border-[var(--color-panel-border)] last:border-b-0",
        row.flaggedForReview && "bg-[var(--color-highlight)] text-[var(--color-highlight-fg)]",
      )}
    >
      <td className="p-0 align-middle">
        <button
          type="button"
          onClick={() => open(dealId)}
          aria-label={`Open deal: ${row.property.address || "(no address)"}`}
          aria-expanded={isActive}
          className={cn(
            "group relative w-full h-7 flex items-center justify-center",
            "border-l-2",
            isActive
              ? "border-[var(--color-accent)] text-[var(--color-accent)]"
              : "border-transparent text-[var(--color-text-faint)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-hover)]",
            // When the row is flagged-yellow, swap to a darker accent so it stays visible.
            row.flaggedForReview && !isActive && "text-[var(--color-highlight-fg)]/60",
          )}
        >
          <ChevronRight
            size={14}
            strokeWidth={2.25}
            className={cn("transition-transform", isActive && "rotate-90")}
          />
        </button>
      </td>
      <td className="p-0 align-middle text-center">
        <RowStageChip dealId={dealId} stage={row.stage as DealStage} />
      </td>
      {COLUMN_IDS.map((col) => (
        <td key={col} className="p-0 align-top">
          <SpreadCell dealId={dealId} col={col} />
        </td>
      ))}
    </tr>
  );
}

