"use client";

// Owner-only popover for granting/revoking access. Edits the allowedEmails
// LiveList in Liveblocks storage — changes propagate to every connected client
// instantly. Triggered from the "+" button in TeamDock.

import { useState } from "react";
import { toast } from "sonner";
import { X, Trash2 } from "lucide-react";
import { useData } from "@/contexts/DataContext";

export default function AllowlistManager({ onClose }: { onClose: () => void }) {
  const {
    allowedEmails,
    addAllowedEmail,
    removeAllowedEmail,
    teamMembers,
    removeTeamMember,
  } = useData();
  const [newEmail, setNewEmail] = useState("");

  function onAdd(e: React.FormEvent) {
    e.preventDefault();
    const email = newEmail.trim().toLowerCase();
    if (!email) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("That doesn't look like a valid email");
      return;
    }
    if (allowedEmails.map((e) => e.toLowerCase()).includes(email)) {
      toast.info("Already on the access list");
      return;
    }
    addAllowedEmail(email);
    setNewEmail("");
    toast.success(`${email} can now sign in`);
  }

  function revoke(email: string) {
    removeAllowedEmail(email);
    // Also remove their TeamMember row so they disappear from the dock.
    const member = teamMembers.find(
      (m) => m.email.toLowerCase() === email.toLowerCase(),
    );
    if (member) removeTeamMember(member.id);
    toast.success(`Revoked access for ${email}`);
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-4"
      onClick={onClose}
    >
      <div
        className="bg-[var(--color-panel)] border border-[var(--color-panel-border)] rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-[var(--color-text)]">
              Manage access
            </h2>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              People on this list can sign in with their Google account.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--color-text-faint)] hover:text-[var(--color-text)]"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={onAdd} className="flex gap-2">
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="teammate@example.com"
            className="flex-1 text-sm bg-[var(--color-bg-elevated)] border border-[var(--color-panel-border)] rounded-md px-3 py-2 text-[var(--color-text)] placeholder:text-[var(--color-text-faint)] focus:outline-none focus:border-[var(--color-accent)]"
            autoFocus
          />
          <button
            type="submit"
            className="text-sm font-medium px-3 py-2 rounded-md bg-[var(--color-accent)] text-[var(--color-accent-fg)] hover:opacity-90"
          >
            Grant
          </button>
        </form>

        <div className="space-y-1 max-h-72 overflow-y-auto">
          {allowedEmails.length === 0 ? (
            <p className="text-xs text-[var(--color-text-faint)] text-center py-4">
              No one yet. Add an email above to grant access.
            </p>
          ) : (
            allowedEmails.map((email) => (
              <div
                key={email}
                className="flex items-center justify-between gap-2 px-3 py-2 rounded-md hover:bg-[var(--color-bg-elevated)] group"
              >
                <span className="text-sm text-[var(--color-text)] truncate">
                  {email}
                </span>
                <button
                  type="button"
                  onClick={() => revoke(email)}
                  className="opacity-0 group-hover:opacity-100 text-[var(--color-text-faint)] hover:text-[var(--color-danger)] transition-opacity"
                  title="Revoke access"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>

        <p className="text-[11px] text-[var(--color-text-faint)]">
          The owner account is always allowed and isn&apos;t shown here.
        </p>
      </div>
    </div>
  );
}
