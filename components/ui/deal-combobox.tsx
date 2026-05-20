"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { Popover } from "./popover";
import { cn } from "@/lib/utils";
import type { DealDTO } from "@/lib/dto";

export function DealCombobox({
  value,
  onChange,
  deals,
  placeholder = "Link to deal…",
  className,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  deals: DealDTO[];
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(() => deals.find((d) => d.id === value) ?? null, [deals, value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return deals.slice(0, 50);
    return deals
      .filter((d) => {
        const a = d.property.address?.toLowerCase() ?? "";
        const c = d.property.city?.toLowerCase() ?? "";
        return a.includes(q) || c.includes(q);
      })
      .slice(0, 50);
  }, [deals, query]);

  // Focus the search input when the popover opens. Pure DOM side effect.
  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  // Reset activeIndex when the query changes — done in render via the
  // "setState during render to reset on prop change" pattern, which is
  // allowed in React 18+ and avoids a re-render cascade.
  const [lastQuery, setLastQuery] = useState(query);
  if (lastQuery !== query) {
    setLastQuery(query);
    setActiveIndex(0);
  }

  function openMenu() {
    setQuery("");
    setActiveIndex(0);
    setOpen(true);
  }

  function pick(id: string | null) {
    onChange(id);
    setOpen(false);
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = filtered[activeIndex];
      if (target) pick(target.id);
    }
  }

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openMenu())}
        className={cn(
          "h-9 w-full px-3 rounded-md bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-sm text-left flex items-center justify-between gap-2 hover:bg-[var(--color-bg-hover)] transition-colors",
          className,
        )}
      >
        <span
          className={cn(
            "truncate",
            selected ? "text-[var(--color-text)]" : "text-[var(--color-text-faint)]",
          )}
        >
          {selected ? selected.property.address : placeholder}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {selected ? (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange(null);
                }
              }}
              className="text-[var(--color-text-faint)] hover:text-[var(--color-danger)] cursor-pointer"
              aria-label="Clear deal selection"
            >
              <X size={14} />
            </span>
          ) : null}
          <ChevronDown size={14} className="text-[var(--color-text-faint)]" />
        </div>
      </button>

      <Popover
        anchorRef={anchorRef}
        open={open}
        onClose={() => setOpen(false)}
        placement="bottom-start"
        className="w-[320px] overflow-hidden"
      >
        <div className="p-2 border-b border-[var(--color-panel-border)]">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKey}
            placeholder="Search by address or city…"
            className="h-8 w-full px-2 rounded bg-[var(--color-bg)] border border-[var(--color-border)] text-sm focus:border-[var(--color-accent)] focus:outline-none"
          />
        </div>
        <ul className="max-h-64 overflow-y-auto py-1">
          {value !== null ? (
            <li>
              <button
                type="button"
                onClick={() => pick(null)}
                className="w-full px-3 py-1.5 text-left text-xs text-[var(--color-text-faint)] hover:bg-[var(--color-bg-hover)] flex items-center gap-2"
              >
                <X size={12} /> Remove deal link
              </button>
            </li>
          ) : null}
          {filtered.length === 0 ? (
            <li className="px-3 py-3 text-center text-xs text-[var(--color-text-faint)]">
              No matches
            </li>
          ) : (
            filtered.map((d, i) => {
              const isActive = i === activeIndex;
              const isSelected = d.id === value;
              return (
                <li key={d.id}>
                  <button
                    type="button"
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => pick(d.id)}
                    className={cn(
                      "w-full px-3 py-1.5 text-left flex items-start justify-between gap-2 transition-colors",
                      isActive
                        ? "bg-[var(--color-bg-hover)]"
                        : "hover:bg-[var(--color-bg-hover)]",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-[var(--color-text)] truncate">
                        {d.property.address}
                      </div>
                      {d.property.city ? (
                        <div className="text-[10px] text-[var(--color-text-faint)] truncate">
                          {d.property.city}
                          {d.property.state ? `, ${d.property.state}` : ""}
                        </div>
                      ) : null}
                    </div>
                    {isSelected ? (
                      <Check size={14} className="text-[var(--color-accent)] shrink-0 mt-0.5" />
                    ) : null}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </Popover>
    </>
  );
}
