"use client";

// Sign-in gate that wraps the app in Liveblocks mode. Three responsibilities:
//   1. While loading auth state, show a spinner.
//   2. If not signed in, render the GIS Sign-In button.
//   3. If signed in, run the allowlist check (owner OR in Liveblocks
//      allowedEmails); show "ask Kam" if denied, otherwise render the app.
//
// It also makes a one-shot side effect on first successful gate-pass: add the
// signed-in user to the persistent teamMembers roster so their avatar shows up
// in the bottom-left TeamDock.

import { useEffect, useRef, type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { parseOwnerEmails } from "@/lib/auth-utils";

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
const OWNER_EMAILS = parseOwnerEmails(
  process.env.NEXT_PUBLIC_OWNER_EMAILS,
);

function isOwner(email: string | undefined): boolean {
  if (!email) return false;
  return OWNER_EMAILS.includes(email.toLowerCase());
}

export default function AuthGate({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isLoading, error, signOut } = useAuth();
  const { allowedEmails, isLoaded, ensureTeamMember } = useData();
  const buttonRef = useRef<HTMLDivElement>(null);
  const ensuredEmailRef = useRef<string | null>(null);

  // Render the Google button once GSI is loaded. Polls briefly because the
  // script may still be in flight when the gate first mounts.
  useEffect(() => {
    if (isAuthenticated || isLoading || !CLIENT_ID) return;

    function tryRender(): boolean {
      const google = (window as unknown as { google?: GoogleApi }).google;
      if (google?.accounts?.id && buttonRef.current) {
        buttonRef.current.replaceChildren();
        google.accounts.id.renderButton(buttonRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "signin_with",
          shape: "pill",
          width: 280,
        });
        return true;
      }
      return false;
    }

    if (!tryRender()) {
      const interval = setInterval(() => {
        if (tryRender()) clearInterval(interval);
      }, 200);
      const timeout = setTimeout(() => clearInterval(interval), 10000);
      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
  }, [isAuthenticated, isLoading]);

  // Compute access decision once signed in.
  const userEmail = user?.email.toLowerCase();
  const owner = isOwner(userEmail);
  const inAllowlist = userEmail
    ? allowedEmails.map((e) => e.toLowerCase()).includes(userEmail)
    : false;
  const hasAccess = !!user && (owner || inAllowlist);

  // After access is granted, add the user to the persistent roster (idempotent
  // on email). Only runs once per signed-in email to avoid hammering Liveblocks.
  useEffect(() => {
    if (!hasAccess || !user || !isLoaded) return;
    if (ensuredEmailRef.current === user.email) return;
    ensuredEmailRef.current = user.email;
    ensureTeamMember({
      email: user.email,
      name: user.name,
      picture: user.picture,
    });
  }, [hasAccess, user, isLoaded, ensureTeamMember]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[var(--color-bg)]">
        <div className="w-6 h-6 border-2 border-[var(--color-accent)]/30 border-t-[var(--color-accent)] rounded-full animate-spin" />
      </div>
    );
  }

  if (!CLIENT_ID) {
    return (
      <div className="h-screen flex items-center justify-center bg-[var(--color-bg)] px-6">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-xl font-semibold text-[var(--color-text)]">
            Sign-in not configured
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
            Set{" "}
            <code className="text-[var(--color-accent)] bg-[var(--color-bg-elevated)] px-1.5 py-0.5 rounded text-xs">
              NEXT_PUBLIC_GOOGLE_CLIENT_ID
            </code>{" "}
            in your{" "}
            <code className="text-[var(--color-accent)] bg-[var(--color-bg-elevated)] px-1.5 py-0.5 rounded text-xs">
              .env.local
            </code>{" "}
            to enable Google Sign-In.
          </p>
        </div>
      </div>
    );
  }

  // Signed in + allowed → render app.
  if (hasAccess) return <>{children}</>;

  // Signed in but Liveblocks hasn't hydrated yet — wait for allowlist
  // to load before deciding access. Owners skip this branch since their
  // check is env-based and doesn't depend on storage.
  if (user && !isLoaded) {
    return (
      <div className="h-screen flex items-center justify-center bg-[var(--color-bg)]">
        <div className="w-6 h-6 border-2 border-[var(--color-accent)]/30 border-t-[var(--color-accent)] rounded-full animate-spin" />
      </div>
    );
  }

  // Signed in but not allowed → access denied screen.
  if (user && !hasAccess && isLoaded) {
    return (
      <div className="h-screen flex items-center justify-center bg-[var(--color-bg)] px-6">
        <div className="w-full max-w-sm text-center space-y-5">
          <h1 className="text-xl font-semibold text-[var(--color-text)]">
            Access not granted
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
            <span className="text-[var(--color-text)]">{user.email}</span> isn&apos;t on
            the access list yet. Ask Kam to add your email, then try again.
          </p>
          <button
            type="button"
            onClick={signOut}
            className="text-xs text-[var(--color-text-faint)] hover:text-[var(--color-text)] underline"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  // Default: sign-in screen.
  return (
    <div className="h-screen flex items-center justify-center bg-[var(--color-bg)] px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex items-baseline justify-center gap-1.5 mb-3">
            <span className="text-2xl font-semibold tracking-tight text-[var(--color-text)]">
              Centurion
            </span>
            <span className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-accent)] font-medium">
              CRM
            </span>
          </div>
          <p className="text-sm text-[var(--color-text-muted)]">
            Sign in with Google to continue.
          </p>
        </div>

        <div className="flex justify-center mb-5">
          <div ref={buttonRef} />
        </div>

        {error && (
          <div className="border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 rounded-lg px-4 py-2.5 text-center">
            <p className="text-sm text-[var(--color-danger)]">{error}</p>
          </div>
        )}

        <p className="text-center text-[11px] text-[var(--color-text-faint)] mt-10">
          Access is invite-only. Ask Kam for an invite.
        </p>
      </div>
    </div>
  );
}

type GoogleApi = {
  accounts: {
    id: {
      renderButton: (el: HTMLElement, config: Record<string, unknown>) => void;
    };
  };
};
