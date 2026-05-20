"use client";

// Google Sign-In for Centurion CRM. Ported from Mālama PM's AuthContext, with
// two key differences:
//   1. Access control is *not* done here. This context only handles "who is
//      logged in via Google." The allowlist check (owner OR Liveblocks
//      allowedEmails) is enforced by <AuthGate>, which has access to both the
//      auth user and the Liveblocks-backed allowlist.
//   2. JWT validation stays claim-only (no JWKS) since GSI delivers the token
//      directly to our callback — same threat model as Mālama.
//
// Session lives in localStorage under "centurion-auth-session" with a 24h TTL.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { validateGoogleJwt } from "@/lib/auth-utils";

export type AuthUser = {
  email: string;
  name: string;
  picture: string;
};

type AuthSession = {
  user: AuthUser;
  expiresAt: number;
};

type AuthContextType = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  signOut: () => void;
  // Surfaced so <AuthGate> can show "Access denied" without owning state.
  setAccessError: (msg: string | null) => void;
};

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
const SESSION_KEY = "centurion-auth-session";
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

// Same as useAuth but returns null when no AuthProvider is mounted (local dev
// mode skips auth entirely — see DataProvider.tsx). Use this for components
// that want to render in both modes.
export function useOptionalAuth(): AuthContextType | null {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Restore session on mount. Expired sessions are silently cleared.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const session = JSON.parse(raw) as AuthSession;
        if (session.expiresAt > Date.now()) {
          setUser(session.user);
        } else {
          localStorage.removeItem(SESSION_KEY);
        }
      }
    } catch {
      localStorage.removeItem(SESSION_KEY);
    }
    setIsLoading(false);
  }, []);

  const handleCredentialResponse = useCallback(
    (response: { credential: string }) => {
      const result = validateGoogleJwt(response.credential, CLIENT_ID);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const authUser: AuthUser = {
        email: result.email,
        name: result.name,
        picture: result.picture,
      };
      const session: AuthSession = {
        user: authUser,
        expiresAt: Date.now() + SESSION_DURATION_MS,
      };
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      setUser(authUser);
      setError(null);
    },
    [],
  );

  // Load Google Identity Services SDK once we know there's no signed-in user
  // and a client ID is configured. The SDK calls handleCredentialResponse via
  // the button rendered in <AuthGate>.
  useEffect(() => {
    if (!CLIENT_ID || user) return;
    if (document.getElementById("google-gsi-script")) {
      reinitGsi();
      return;
    }
    const script = document.createElement("script");
    script.id = "google-gsi-script";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = reinitGsi;
    document.head.appendChild(script);

    function reinitGsi() {
      const google = (window as unknown as { google?: GoogleApi }).google;
      google?.accounts?.id?.initialize({
        client_id: CLIENT_ID,
        callback: handleCredentialResponse,
        auto_select: false,
      });
    }
  }, [user, handleCredentialResponse]);

  const signOut = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
    setError(null);
    const google = (window as unknown as { google?: GoogleApi }).google;
    google?.accounts?.id?.disableAutoSelect?.();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        error,
        signOut,
        setAccessError: setError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Minimal typing of the window.google surface we use, so we don't pull the
// full @types/google.accounts package for a handful of calls.
type GoogleApi = {
  accounts: {
    id: {
      initialize: (config: Record<string, unknown>) => void;
      renderButton: (el: HTMLElement, config: Record<string, unknown>) => void;
      disableAutoSelect: () => void;
    };
  };
};
