"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { SpreadCell } from "./SpreadCell";
import { useSpreadRow, useSpreadState } from "./SpreadStore";
import {
  COLUMN_IDS,
  COLUMN_LABELS,
  COLUMN_WIDTHS,
  COLUMN_ALIGN,
  type ColumnId,
} from "./types";
import { useData } from "@/contexts/DataContext";

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

// ─── New-row inline adder (still uses fetch+router.refresh since this
//     changes row membership, which the store can't predict locally) ────

function NewRow({ section }: { section: "ACTIVES" | "IN_ESCROW" }) {
  const [value, setValue] = useState("");
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const { refresh } = useData();

  function commit() {
    const v = value.trim();
    if (!v) return;
    start(async () => {
      // Goes through the spread-specific create path on the server (kind:"spread"
      // creates a stub deal with property only). Then refresh() re-pulls the
      // provider's deals[] so the new row appears and SpreadStore re-keys.
      const res = await fetch(`/api/deals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "spread", section, address: v }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "Failed to add row" }));
        toast.error(error ?? "Failed to add row");
        return;
      }
      setValue("");
      await refresh();
      queueMicrotask(() => inputRef.current?.focus());
    });
  }

  return (
    <tr className="border-b border-[var(--color-panel-border)] last:border-b-0">
      <td className="px-1 py-1 text-center text-[var(--color-text-faint)]">
        <Plus size={12} strokeWidth={1.5} />
      </td>
      <td colSpan={TOTAL_COLS - 1} className="px-1 py-1">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.currentTarget.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
          placeholder={`+ Add new ${section === "IN_ESCROW" ? "escrow" : "active"} property…`}
          disabled={pending}
          className="w-full bg-transparent border-none outline-none px-2 py-1 text-xs text-[var(--color-text-faint)] placeholder-[var(--color-text-faint)] focus:text-[var(--color-text)] focus:bg-[var(--color-bg-hover)]"
        />
      </td>
    </tr>
  );
}
