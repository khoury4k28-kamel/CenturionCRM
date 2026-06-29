"use client";

// Composer for manually logging an activity (call / note / email / meeting).
// Used deal-scoped in the deal panel and globally (with a deal picker) on the
// Activity & Tasks page. Writes through useData().logActivity, which appends to
// the same stream the ActivityFeed renders.

import { useState, useTransition } from "react";
import { Phone, StickyNote, Mail, Users, Send } from "lucide-react";
import { toast } from "sonner";
import { useData } from "@/contexts/DataContext";
import type { ManualActivityKind } from "@/lib/types";
import { cn } from "@/lib/utils";

const KINDS: {
  kind: ManualActivityKind;
  label: string;
  icon: typeof Phone;
  placeholder: string;
}[] = [
  { kind: "call.logged", label: "Call", icon: Phone, placeholder: "What did you discuss on the call?" },
  { kind: "note.logged", label: "Note", icon: StickyNote, placeholder: "Add a note…" },
  { kind: "email.logged", label: "Email", icon: Mail, placeholder: "Summarize the email…" },
  { kind: "meeting.logged", label: "Meeting", icon: Users, placeholder: "What came out of the meeting?" },
];

export function LogActivityForm({
  dealId,
  showDealPicker = false,
  onLogged,
  className,
}: {
  /** Fixed deal to attach the activity to (deal panel). */
  dealId?: string | null;
  /** Render a deal selector so a global log can be attached to a deal. */
  showDealPicker?: boolean;
  onLogged?: () => void;
  className?: string;
}) {
  const { logActivity, deals } = useData();
  const [kind, setKind] = useState<ManualActivityKind>("call.logged");
  const [body, setBody] = useState("");
  const [pickedDealId, setPickedDealId] = useState<string>(dealId ?? "");
  const [pending, startTransition] = useTransition();

  const active = KINDS.find((k) => k.kind === kind) ?? KINDS[0];

  function submit() {
    const text = body.trim();
    if (!text) return;
    const attachTo = dealId ?? (pickedDealId || null);
    startTransition(async () => {
      const ok = await logActivity({ kind, body: text, dealId: attachTo });
      if (ok) {
        setBody("");
        toast.success("Activity logged");
        onLogged?.();
      }
    });
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-2.5 space-y-2",
        className,
      )}
    >
      {/* Kind selector */}
      <div className="flex items-center gap-1">
        {KINDS.map((k) => {
          const Icon = k.icon;
          const isActive = k.kind === kind;
          return (
            <button
              key={k.kind}
              type="button"
              onClick={() => setKind(k.kind)}
              className={cn(
                "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium border transition-colors",
                isActive
                  ? "bg-[var(--color-accent)] text-[var(--color-accent-fg)] border-[var(--color-accent)]"
                  : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-border-strong)]",
              )}
            >
              <Icon size={12} strokeWidth={2} />
              {k.label}
            </button>
          );
        })}
      </div>

      {showDealPicker && !dealId ? (
        <select
          value={pickedDealId}
          onChange={(e) => setPickedDealId(e.target.value)}
          className="block w-full h-8 px-2 text-xs rounded-md border border-[var(--color-border)] bg-[var(--color-panel)] outline-none focus:border-[var(--color-accent)]"
        >
          <option value="">No deal (general)</option>
          {deals.map((d) => (
            <option key={d.id} value={d.id}>
              {d.property.address || d.property.city || "Untitled deal"}
            </option>
          ))}
        </select>
      ) : null}

      <textarea
        value={body}
        rows={2}
        placeholder={active.placeholder}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
        className="block w-full px-2 py-1.5 text-xs rounded-md border border-[var(--color-border)] bg-transparent outline-none resize-none focus:border-[var(--color-accent)] placeholder:text-[var(--color-text-faint)]"
      />

      <div className="flex items-center justify-between">
        <span className="text-[10px] text-[var(--color-text-faint)]">⌘↵ to log</span>
        <button
          type="button"
          onClick={submit}
          disabled={pending || body.trim() === ""}
          className="inline-flex items-center gap-1.5 h-7 px-3 rounded-md text-xs font-medium bg-[var(--color-accent)] text-[var(--color-accent-fg)] disabled:opacity-50 hover:opacity-90 transition-opacity"
        >
          <Send size={12} strokeWidth={2} />
          Log {active.label.toLowerCase()}
        </button>
      </div>
    </div>
  );
}
