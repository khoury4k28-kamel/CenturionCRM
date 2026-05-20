// Auth helpers split out of the React context so they're testable.
//
// JWT validation here is intentionally lightweight: claim checks only, no JWKS
// verification. Safe because Google Identity Services delivers the token
// directly to our browser callback — there's no untrusted intermediary to
// guard against. The domain restriction (allowlist) is the real access control.

export type GoogleJwtPayload = {
  iss?: string;
  aud?: string;
  exp?: number;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
};

export function decodeJwtPayload(token: string): GoogleJwtPayload {
  const base64Url = token.split(".")[1];
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const json = decodeURIComponent(
    atob(base64)
      .split("")
      .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
      .join(""),
  );
  return JSON.parse(json) as GoogleJwtPayload;
}

export type JwtValidationOk = {
  ok: true;
  email: string;
  name: string;
  picture: string;
};

export type JwtValidationErr = { ok: false; error: string };

export function validateGoogleJwt(
  token: string,
  expectedAudience: string,
): JwtValidationOk | JwtValidationErr {
  let payload: GoogleJwtPayload;
  try {
    payload = decodeJwtPayload(token);
  } catch {
    return { ok: false, error: "Authentication failed. Please try again." };
  }

  if (
    payload.iss !== "https://accounts.google.com" &&
    payload.iss !== "accounts.google.com"
  ) {
    return { ok: false, error: "Invalid token issuer." };
  }
  if (expectedAudience && payload.aud !== expectedAudience) {
    return { ok: false, error: "Invalid token audience." };
  }
  if (typeof payload.exp === "number" && payload.exp * 1000 < Date.now()) {
    return { ok: false, error: "Token has expired. Please sign in again." };
  }
  if (!payload.email_verified) {
    return {
      ok: false,
      error: "Email not verified. Please verify your Google account.",
    };
  }
  const email = (payload.email ?? "").toLowerCase();
  if (!email) {
    return { ok: false, error: "Token missing email." };
  }
  return {
    ok: true,
    email,
    name: payload.name || email.split("@")[0],
    picture: payload.picture ?? "",
  };
}

// NEXT_PUBLIC_OWNER_EMAILS is a comma-separated list. Owners bypass the
// in-app allowlist and can edit it. Always at least one owner so someone
// can grant access on a fresh deployment.
export function parseOwnerEmails(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
}
