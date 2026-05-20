"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { SpreadCell } from "./SpreadCell";
import { useSpreadRow, useSpreadState } from "./SpreadStore";
import {
  COLUMN_IDS,
  COLUMN_LABELS,
  COLUMN_WIDTHS,
  COLUMN_ALIGN,
} from "./types";
import { DealCreateModal } from "@/components/deals/DealCreateModal";

// Re-export the type for backward compat with `app/deals/page.tsx`.
export type { SpreadDeal } from "./types";

const TOTAL_COLS = COLUMN_IDS.length;

export function SpreadTable() {
  const { rowOrder } = useSpreadState();

  return (
    <div className="px-6 py-6 overflow-x-auto" data-spread-root>
      <div className="border border-[var(--color-panel-border)] rounded-md overflow-hidden">
        <table className="w-full border-collapse text-sm table-fixed">
          <colgroup>
            {COLUMN_IDS.map((col) => {
              const w = COLUMN_WIDTHS[col];
              return <col key={col} style={w === null ? undefined : { width: `${w}px` }} />;
            })}
          </colgroup>
          <thead className="sticky top-0 z-20">
            <tr className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] border-b border-[var(--color-panel-border)] bg-[var(--color-panel)]">
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
            {rowOrder.actives.map((id) => (
              <SpreadRow key={id} dealId={id} />
            ))}
            <NewRow section="ACTIVES" />

            <SectionHeader label="IN ESCROW" count={rowOrder.inEscrow.length} top />
            {rowOrder.inEscrow.map((id) => (
              <SpreadRow key={id} dealId={id} />
            ))}
            <NewRow section="IN_ESCROW" />
          </tbody>
        </table>
      </div>
      <div className="mt-3 text-[10px] text-[var(--color-text-faint)] px-1">
        click to edit · enter saves & moves down · tab moves right · esc cancels · ⌘Z undo
      </div>
    </div>
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
        colSpan={TOTAL_COLS}
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
  if (!row) return null;
  return (
    <tr
      className={cn(
        "border-b border-[var(--color-panel-border)] last:border-b-0",
        row.flaggedForReview && "bg-[var(--color-highlight)] text-[var(--color-highlight-fg)]",
      )}
    >
      {COLUMN_IDS.map((col) => (
        <td key={col} className="p-0 align-top">
          <SpreadCell dealId={dealId} col={col} />
        </td>
      ))}
    </tr>
  );
}

// ─── New-row trigger — opens DealCreateModal. The provider's addDeal()
//     refreshes deals[] on success → SpreadStore re-keys → new row appears. ──

function NewRow({ section }: { section: "ACTIVES" | "IN_ESCROW" }) {
  const [open, setOpen] = useState(false);
  const label = `+ Add new ${section === "IN_ESCROW" ? "escrow" : "active"} property…`;

  return (
    <>
      <tr className="border-b border-[var(--color-panel-border)] last:border-b-0">
        <td className="px-1 py-1 text-center text-[var(--color-text-faint)]">
          <Plus size={12} strokeWidth={1.5} />
        </td>
        <td colSpan={TOTAL_COLS - 1} className="px-1 py-1">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="w-full text-left bg-transparent border-none outline-none px-2 py-1 text-xs text-[var(--color-text-faint)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-hover)] cursor-pointer rounded-sm transition-colors"
          >
            {label}
          </button>
        </td>
      </tr>
      <DealCreateModal open={open} onOpenChange={setOpen} section={section} />
    </>
  );
}
