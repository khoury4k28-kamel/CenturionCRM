"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import Link from "next/link";
import {
  Flag,
  Home,
  Trash2,
  ExternalLink,
  FileText,
  Mail,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import {
  cn,
  formatMoney,
  formatDateDisplay,
  parseMoneyInput,
  parseDateInput,
  parseTermInput,
  relativeTime,
} from "@/lib/utils";
import { useData } from "@/contexts/DataContext";
import { useSpreadActions } from "@/components/spread/SpreadStore";
import type { AddressBundle } from "@/components/spread/SpreadStore";
import { StageStepper } from "./StageStepper";
import { TaskList } from "@/components/tasks/TaskList";
import { Badge } from "@/components/ui/badge";
import { AGREEMENT_TYPES, DEAL_STAGES, type DealStage } from "@/lib/types";

// Tabbed deal slide-out. The Overview tab carries forward the inline-edit
// fields that were previously the entire panel; Tasks / Documents / Emails
// surface the per-listing workflow actions in-place so Kam can execute them
// without leaving the spread.
//
//   - Reads the deal from useData().deals (source of truth).
//   - Per-field saves: text/number on blur, selects/dates/toggles on change.
//   - Spread-tracked fields (address, agreedPrice, listPrice, dates, term,
//     notes, flag, owed) route through SpreadStore actions so the spread cell
//     updates in lock-step. Non-spread fields (askingPrice, ourOffer, source,
//     agreementType, sellerId, realtorId, weOwn — partially, see below) go
//     straight to the provider since SpreadStore doesn't track them.
//   - "We own" toggle reuses `commitOwed("we own" | "-0-")` to keep SpreadStore
//     in sync without adding a new SpreadStore action.

type DealPanelTab = "overview" | "tasks" | "documents" | "emails";

export function DealDetailPanel({
  dealId,
  onClose,
}: {
  dealId: string | null;
  onClose: () => void;
}) {
  const { deals, contacts, tasks, documents, updateDeal, deleteDeal } = useData();
  const spread = useSpreadActions();
  const [deletePending, startDelete] = useTransition();
  // Reset to Overview whenever the user opens a different deal — otherwise
  // the panel reopens on the previous tab, which is almost never what you
  // want when context-switching between listings. Pattern: track the dealId
  // the tab state belongs to, and snap back to overview the render in which
  // that id changes. (React-idiomatic alternative to a setState-in-effect.)
  const [tab, setTab] = useState<DealPanelTab>("overview");
  const [tabForDealId, setTabForDealId] = useState<string | null>(dealId);
  if (tabForDealId !== dealId) {
    setTabForDealId(dealId);
    setTab("overview");
  }

  const deal = useMemo(
    () => (dealId ? deals.find((d) => d.id === dealId) ?? null : null),
    [deals, dealId],
  );

  // Auto-close when the selected deal vanishes (deleted from another tab,
  // or our own delete after the provider's optimistic update lands). The
  // brief "not available" flash would otherwise be visible during the
  // SpreadStore re-key that happens between delete and the onClose call.
  useEffect(() => {
    if (dealId && !deal) onClose();
  }, [dealId, deal, onClose]);

  const dealTasks = useMemo(
    () =>
      deal
        ? tasks
            .filter((t) => t.dealId === deal.id)
            .map((t) => ({
              id: t.id,
              title: t.title,
              dueDate: t.dueDate,
              completedAt: t.completedAt,
              dealId: t.dealId,
              assignees: t.assignees ?? [],
            }))
        : [],
    [tasks, deal],
  );

  const dealDocuments = useMemo(
    () => (deal ? documents.filter((d) => d.dealId === deal.id) : []),
    [documents, deal],
  );

  if (!dealId || !deal) return null;

  // Pin a non-null reference for the closures below. TS doesn't narrow
  // captured variables inside nested `function` declarations, so without
  // this pin every `deal.x` access would re-trigger the null check.
  const d = deal;

  const stage: DealStage = (DEAL_STAGES as readonly string[]).includes(d.stage)
    ? d.stage
    : "NEW_LEAD";

  const subtitle = [
    d.property.city,
    [d.property.state, d.property.zip].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");

  const openTaskCount = dealTasks.filter((t) => !t.completedAt).length;

  // ── Address commit helper ────────────────────────────────────────────
  // Address is a 4-field bundle in SpreadStore. Each input commits the full
  // bundle so the SpreadStore's reducer + undo stack stay coherent.
  function commitAddress(patch: Partial<AddressBundle>) {
    const next: AddressBundle = {
      address: patch.address ?? d.property.address,
      city: patch.city !== undefined ? patch.city : d.property.city,
      state: patch.state !== undefined ? patch.state : d.property.state,
      zip: patch.zip !== undefined ? patch.zip : d.property.zip,
    };
    spread.commitAddress(d.id, next);
  }

  // ── Non-spread field commits go through the provider directly ────────
  // Returns void so TextLine's `onCommit` signature (void | boolean) is
  // happy when this is passed as a callback. Failures surface via the
  // provider's own toast.
  function setFields(fields: Parameters<typeof updateDeal>[1]["fields"]): void {
    void updateDeal(d.id, { fields });
  }

  function handleDelete() {
    if (!confirm("Delete this deal? Tasks and documents will also be deleted.")) return;
    startDelete(async () => {
      const ok = await deleteDeal(d.id);
      if (ok) {
        toast.success("Deal deleted");
        onClose();
      }
    });
  }

  return (
    <div className="flex flex-col">
      {/* ── Sticky header + tabs ────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-[var(--color-panel)] border-b border-[var(--color-panel-border)]">
        <div className="px-5 py-3 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <TextLine
              value={deal.property.address}
              onCommit={(v) => commitAddress({ address: v ?? "" })}
              placeholder="Street address"
              className="text-base font-semibold tracking-tight text-[var(--color-text)] w-full bg-transparent outline-none border-b border-transparent focus:border-[var(--color-accent)] py-0.5"
            />
            <div className="mt-0.5 text-[11px] text-[var(--color-text-faint)] truncate">
              {subtitle || "Location not set"} · Updated {relativeTime(deal.updatedAt)}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="-mr-1 -mt-0.5 h-7 w-7 inline-flex items-center justify-center rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-hover)] text-lg leading-none"
          >
            ×
          </button>
        </div>
        <div className="px-2 flex items-center gap-0 border-t border-[var(--color-panel-border)]">
          <TabButton active={tab === "overview"} onClick={() => setTab("overview")}>
            Overview
          </TabButton>
          <TabButton
            active={tab === "tasks"}
            onClick={() => setTab("tasks")}
            badge={openTaskCount > 0 ? openTaskCount : undefined}
          >
            Tasks
          </TabButton>
          <TabButton
            active={tab === "documents"}
            onClick={() => setTab("documents")}
            badge={dealDocuments.length > 0 ? dealDocuments.length : undefined}
          >
            Documents
          </TabButton>
          <TabButton active={tab === "emails"} onClick={() => setTab("emails")}>
            Emails
          </TabButton>
        </div>
      </div>

      {/* ── Tab body ─────────────────────────────────────────────────── */}
      {tab === "overview" ? (
        <>
          <Section label="Stage">
            <StageStepper dealId={deal.id} current={stage} />
          </Section>

          <Section label="Status">
            <div className="flex flex-wrap gap-2">
              <ToggleChip
                active={deal.flaggedForReview}
                onClick={() => spread.commitFlag(deal.id, !deal.flaggedForReview)}
                icon={<Flag size={12} fill={deal.flaggedForReview ? "currentColor" : "none"} strokeWidth={2} />}
                activeColor="var(--color-highlight)"
                activeFg="var(--color-highlight-fg)"
              >
                Flag
              </ToggleChip>
              <ToggleChip
                active={deal.weOwn}
                onClick={() => {
                  // Route through commitOwed so SpreadStore's owed cell + undo stack stay aligned.
                  spread.commitOwed(deal.id, deal.weOwn ? "-0-" : "we own");
                }}
                icon={<Home size={12} strokeWidth={2} />}
                activeColor="var(--color-accent)"
                activeFg="var(--color-accent-fg)"
              >
                We own it
              </ToggleChip>
            </div>
          </Section>

          <Section label="Numbers">
            <div className="grid grid-cols-2 gap-3">
              <MoneyField
                label="Asking"
                value={deal.askingPrice}
                onCommit={(n) => setFields({ askingPrice: n })}
              />
              <MoneyField
                label="Our offer"
                value={deal.ourOffer}
                onCommit={(n) => setFields({ ourOffer: n })}
              />
              <MoneyField
                label="Agreed"
                value={deal.agreedPrice}
                accent
                onCommit={(n) => spread.commitField(deal.id, "agreedPrice", n)}
              />
              <MoneyField
                label="List"
                value={deal.listPrice}
                accent
                onCommit={(n) => spread.commitField(deal.id, "listPrice", n)}
              />
            </div>
            <div className="mt-3">
              <Label>Owed</Label>
              {deal.weOwn ? (
                <div className="h-8 flex items-center px-2 text-xs text-[var(--color-text-muted)] italic">
                  Disabled — we own this property
                </div>
              ) : (
                <TextLine
                  value={deal.amountOwed === null || deal.amountOwed === 0 ? "" : formatMoney(deal.amountOwed)}
                  onCommit={(raw) => spread.commitOwed(deal.id, raw ?? "")}
                  placeholder="-0-"
                  title='Type a number, "we own", or leave blank for -0-'
                  className={inputCls("font-mono tabular-nums")}
                />
              )}
            </div>
          </Section>

          <Section label="Address">
            <div className="grid grid-cols-6 gap-3">
              <div className="col-span-3">
                <Label>City</Label>
                <TextLine
                  value={deal.property.city ?? ""}
                  onCommit={(v) => commitAddress({ city: v })}
                  className={inputCls()}
                />
              </div>
              <div className="col-span-1">
                <Label>State</Label>
                <TextLine
                  value={deal.property.state ?? ""}
                  onCommit={(v) => commitAddress({ state: v?.toUpperCase() ?? null })}
                  maxLength={2}
                  className={inputCls("uppercase")}
                />
              </div>
              <div className="col-span-2">
                <Label>ZIP</Label>
                <TextLine
                  value={deal.property.zip ?? ""}
                  onCommit={(v) => commitAddress({ zip: v })}
                  className={inputCls("font-mono tabular-nums")}
                />
              </div>
            </div>
          </Section>

          <Section label="Contacts">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Seller</Label>
                <select
                  value={deal.sellerId ?? ""}
                  onChange={(e) => setFields({ sellerId: e.target.value || null })}
                  className={inputCls("bg-[var(--color-panel)]")}
                >
                  <option value="">— None</option>
                  {contacts
                    .filter((c) => c.type === "SELLER" || c.type === "OTHER")
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.firstName} {c.lastName ?? ""}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <Label>Realtor</Label>
                <select
                  value={deal.realtorId ?? ""}
                  onChange={(e) => setFields({ realtorId: e.target.value || null })}
                  className={inputCls("bg-[var(--color-panel)]")}
                >
                  <option value="">— None</option>
                  {contacts
                    .filter((c) => c.type === "REALTOR" || c.type === "OTHER")
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.firstName} {c.lastName ?? ""}
                      </option>
                    ))}
                </select>
              </div>
            </div>
          </Section>

          <Section label="Dates">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Acceptance</Label>
                <TextLine
                  value={formatDateDisplay(deal.acceptanceDate)}
                  placeholder="—"
                  title="Jul 19, 7/19, 2026-07-19, or a number of days"
                  onCommit={(raw) => {
                    const iso = !raw || raw.trim() === "" ? null : parseDateInput(raw);
                    if (iso === null && raw && raw.trim() !== "") {
                      toast.error(`Couldn't parse "${raw}" as a date`);
                      return false;
                    }
                    spread.commitField(deal.id, "acceptanceDate", iso);
                    return true;
                  }}
                  className={inputCls()}
                />
              </div>
              <div>
                <Label>Expiration</Label>
                <TextLine
                  value={formatDateDisplay(deal.expirationDate)}
                  placeholder="—"
                  title="Date or N (= N days from acceptance)"
                  onCommit={(raw) => {
                    const iso =
                      !raw || raw.trim() === ""
                        ? null
                        : parseDateInput(raw, deal.acceptanceDate);
                    if (iso === null && raw && raw.trim() !== "") {
                      toast.error(`Couldn't parse "${raw}" as a date`);
                      return false;
                    }
                    spread.commitField(deal.id, "expirationDate", iso);
                    return true;
                  }}
                  className={inputCls()}
                />
              </div>
            </div>
            <div className="mt-3">
              <Label>Term of agreement</Label>
              <TextLine
                value={deal.termOfAgreement ?? ""}
                onCommit={(raw) =>
                  spread.commitField(deal.id, "termOfAgreement", parseTermInput(raw ?? ""))
                }
                placeholder='"60" or "60 days"'
                className={inputCls()}
              />
            </div>
          </Section>

          <Section label="Source">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Lead source</Label>
                <TextLine
                  value={deal.source ?? ""}
                  onCommit={(v) => setFields({ source: v })}
                  className={inputCls()}
                />
              </div>
              <div>
                <Label>Agreement type</Label>
                <select
                  value={deal.agreementType ?? ""}
                  onChange={(e) => setFields({ agreementType: e.target.value || null })}
                  className={inputCls("bg-[var(--color-panel)]")}
                >
                  <option value="">—</option>
                  {AGREEMENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t === "PURCHASE" ? "Purchase" : "Option"}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </Section>

          <Section label="Notes">
            <TextArea
              value={deal.notes ?? ""}
              onCommit={(v) => spread.commitField(deal.id, "notes", v)}
              rows={4}
            />
          </Section>
        </>
      ) : null}

      {tab === "tasks" ? (
        <Section>
          <TaskList tasks={dealTasks} dealId={deal.id} allowAdd emptyHint="No tasks yet. Add one below." />
        </Section>
      ) : null}

      {tab === "documents" ? (
        <Section>
          <div className="flex items-center justify-between mb-3">
            <div className="text-[11px] text-[var(--color-text-muted)]">
              {dealDocuments.length === 0
                ? "Generate from a template to attach the first document."
                : `${dealDocuments.length} document${dealDocuments.length === 1 ? "" : "s"} linked to this deal.`}
            </div>
            <Link
              href={`/deals/documents/new?dealId=${deal.id}`}
              className="inline-flex items-center gap-1 px-2 h-7 rounded-md text-xs font-medium border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-bg-hover)]"
            >
              <Plus size={12} strokeWidth={2} />
              Generate
            </Link>
          </div>
          {dealDocuments.length === 0 ? (
            <div className="py-6 text-center text-xs text-[var(--color-text-faint)]">
              No documents yet.
            </div>
          ) : (
            <ul className="space-y-1">
              {dealDocuments.map((doc) => (
                <DocumentRow key={doc.id} doc={doc} dealId={deal.id} />
              ))}
            </ul>
          )}
        </Section>
      ) : null}

      {tab === "emails" ? (
        <Section>
          <EmailsStub />
        </Section>
      ) : null}

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <div className="px-5 py-4 mt-2 flex items-center justify-between gap-3">
        <Link
          href={`/deals/detail?id=${deal.id}`}
          className="inline-flex items-center gap-1.5 text-xs text-[var(--color-accent)] hover:underline"
        >
          Open full detail
          <ExternalLink size={12} />
        </Link>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deletePending}
          className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-md text-xs text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 disabled:opacity-50"
        >
          <Trash2 size={12} />
          Delete deal
        </button>
      </div>
    </div>
  );
}

// ─── Tab nav button ─────────────────────────────────────────────────────

function TabButton({
  active,
  onClick,
  badge,
  children,
}: {
  active: boolean;
  onClick: () => void;
  badge?: number;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="tab"
      aria-selected={active}
      className={cn(
        "relative inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors",
        "border-b-2 -mb-px",
        active
          ? "text-[var(--color-text)] border-[var(--color-accent)]"
          : "text-[var(--color-text-muted)] border-transparent hover:text-[var(--color-text)]",
      )}
    >
      <span>{children}</span>
      {badge !== undefined ? (
        <span
          className={cn(
            "inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full text-[9px] font-semibold tabular-nums",
            active
              ? "bg-[var(--color-accent)] text-[var(--color-accent-fg)]"
              : "bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)]",
          )}
        >
          {badge}
        </span>
      ) : null}
    </button>
  );
}

// ─── Documents tab row ──────────────────────────────────────────────────

function DocumentRow({
  doc,
  dealId,
}: {
  doc: ReturnType<typeof useData>["documents"][number];
  dealId: string;
}) {
  const { generateDocument } = useData();
  // Liveblocks-mode docs have fileUrl="" because bytes aren't persisted —
  // clicking Download re-fills the template against the current deal state
  // and triggers a fresh file. Backend-mode docs keep their /uploads/ link.
  const hasFile = !!doc.fileUrl;
  return (
    <li className="px-2 py-2 rounded-md hover:bg-[var(--color-bg-hover)] flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5 min-w-0">
        <FileText size={14} className="text-[var(--color-text-faint)] shrink-0" />
        <div className="min-w-0">
          <div className="text-xs text-[var(--color-text)] truncate">{doc.templateName}</div>
          <div className="text-[10px] text-[var(--color-text-faint)]">
            {relativeTime(doc.createdAt)} · {doc.templateFormat}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Badge variant={doc.status === "DRAFT" ? "muted" : "accent"}>
          {doc.status}
        </Badge>
        {hasFile ? (
          <a
            href={doc.fileUrl}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] text-[var(--color-accent)] hover:underline"
          >
            Open
          </a>
        ) : (
          <button
            type="button"
            onClick={() => void generateDocument(dealId, doc.templateId)}
            className="text-[11px] text-[var(--color-accent)] hover:underline"
            title="Re-fill the template with the deal's current data and download a fresh copy"
          >
            Download
          </button>
        )}
      </div>
    </li>
  );
}

// ─── Emails tab stub ────────────────────────────────────────────────────

function EmailsStub() {
  return (
    <div className="py-6 text-center">
      <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] mb-3">
        <Mail size={18} strokeWidth={1.75} />
      </div>
      <div className="text-xs text-[var(--color-text)] font-medium mb-1">
        Gmail integration coming soon
      </div>
      <div className="text-[11px] text-[var(--color-text-muted)] max-w-[280px] mx-auto leading-relaxed">
        Compose, send, and view inbound email for this listing — all without
        leaving the panel.
      </div>
      <button
        type="button"
        disabled
        className="mt-4 inline-flex items-center gap-1.5 px-3 h-8 rounded-md text-xs font-medium border border-[var(--color-border)] text-[var(--color-text-faint)] cursor-not-allowed"
      >
        <Plus size={12} strokeWidth={2} />
        Compose draft
      </button>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────

function Section({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="px-5 py-3 border-b border-[var(--color-panel-border)]">
      {label ? (
        <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-semibold mb-2">
          {label}
        </div>
      ) : null}
      {children}
    </div>
  );
}

function Label({ children }: { children: ReactNode }) {
  return (
    <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-faint)] mb-1">
      {children}
    </div>
  );
}

function ToggleChip({
  active,
  onClick,
  icon,
  children,
  activeColor,
  activeFg,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  children: ReactNode;
  activeColor: string;
  activeFg: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium border transition-colors",
        active ? "border-transparent" : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-border-strong)]",
      )}
      style={
        active
          ? { background: activeColor, color: activeFg, borderColor: activeColor }
          : undefined
      }
    >
      {icon}
      {children}
    </button>
  );
}

function inputCls(extra?: string) {
  return cn(
    "block w-full h-8 px-2 text-xs rounded-md border border-[var(--color-border)] bg-transparent outline-none",
    "focus:border-[var(--color-accent)]",
    "placeholder:text-[var(--color-text-faint)]",
    extra,
  );
}

// Controlled text input with deferred commit: tracks a local `draft`, syncs
// from the store value when not focused, fires `onCommit(value | null)` on
// blur only when the trimmed value differs. Returning `false` from onCommit
// vetoes the local snap (used by date fields when parsing fails).
function TextLine({
  value,
  onCommit,
  className,
  placeholder,
  title,
  maxLength,
}: {
  value: string;
  onCommit: (next: string | null) => void | boolean;
  className?: string;
  placeholder?: string;
  title?: string;
  maxLength?: number;
}) {
  const [draft, setDraft] = useState(value);
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setDraft(value);
  }, [value]);

  return (
    <input
      type="text"
      value={draft}
      placeholder={placeholder}
      title={title}
      maxLength={maxLength}
      onFocus={(e) => {
        focused.current = true;
        e.currentTarget.select();
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        focused.current = false;
        const trimmed = draft.trim();
        const next: string | null = trimmed === "" ? null : trimmed;
        const prev: string | null = value.trim() === "" ? null : value.trim();
        if (next === prev) return;
        const result = onCommit(next);
        if (result === false) setDraft(value);
      }}
      className={className}
    />
  );
}

function MoneyField({
  label,
  value,
  onCommit,
  accent,
}: {
  label: string;
  value: number | null;
  onCommit: (n: number | null) => void;
  accent?: boolean;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <TextLine
        value={value === null ? "" : formatMoney(value)}
        placeholder="—"
        onCommit={(raw) => {
          if (raw === null) {
            onCommit(null);
            return;
          }
          const n = parseMoneyInput(raw);
          if (n === null) {
            toast.error(`Couldn't parse "${raw}" as a dollar amount`);
            return false;
          }
          onCommit(n);
        }}
        className={inputCls(cn("font-mono tabular-nums text-right", accent && "text-[var(--color-accent)]"))}
      />
    </div>
  );
}

function TextArea({
  value,
  onCommit,
  rows,
}: {
  value: string;
  onCommit: (next: string | null) => void;
  rows: number;
}) {
  const [draft, setDraft] = useState(value);
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setDraft(value);
  }, [value]);

  return (
    <textarea
      value={draft}
      rows={rows}
      onFocus={() => {
        focused.current = true;
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        focused.current = false;
        const next = draft.trim() === "" ? null : draft;
        const prev = value.trim() === "" ? null : value;
        if (next === prev) return;
        onCommit(next);
      }}
      className={cn(
        "block w-full px-2 py-1.5 text-xs rounded-md border border-[var(--color-border)] bg-transparent outline-none resize-none",
        "focus:border-[var(--color-accent)] placeholder:text-[var(--color-text-faint)]",
      )}
    />
  );
}
