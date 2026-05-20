import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMoney(value: number | string | null | undefined, opts?: { short?: boolean }) {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  if (opts?.short) {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

// ─── Money input parsing ──────────────────────────────────────────────
// Accepts $40,000 / 40000 / 40k / 40K / 1.5m / 2b and similar shorthand.
// Returns null for unparseable input so cells can revert silently.
export function parseMoneyInput(s: string): number | null {
  const trimmed = s.trim();
  if (trimmed === "") return null;
  let body = trimmed.toLowerCase();
  let multiplier = 1;
  if (body.endsWith("k")) {
    multiplier = 1_000;
    body = body.slice(0, -1);
  } else if (body.endsWith("m")) {
    multiplier = 1_000_000;
    body = body.slice(0, -1);
  } else if (body.endsWith("b")) {
    multiplier = 1_000_000_000;
    body = body.slice(0, -1);
  }
  const cleaned = body.replace(/[^\d.-]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * multiplier);
}

// ─── Date helpers ─────────────────────────────────────────────────────
// Dates are stored as ISO YYYY-MM-DD. Display is "Jul 19, 2026".
// Parsing accepts ISO, M/D/YYYY, M/D (current year), a bare integer
// (= N days from `anchor`, defaulting to today), and last-ditch Date.parse.

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Parse a YYYY-MM-DD as a local Date (avoids the UTC shift `new Date(iso)` does).
function isoToLocalDate(iso: string): Date | null {
  const m = iso.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function formatDateDisplay(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = isoToLocalDate(iso);
  if (!d) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function parseDateInput(s: string, anchor?: Date | string | null): string | null {
  const trimmed = s.trim();
  if (trimmed === "") return null;

  // Bare integer → N days from anchor (default: today). Negative also works.
  if (/^-?\d{1,4}$/.test(trimmed)) {
    const days = Number(trimmed);
    const base =
      typeof anchor === "string"
        ? isoToLocalDate(anchor) ?? new Date()
        : anchor instanceof Date
          ? new Date(anchor)
          : new Date();
    base.setHours(0, 0, 0, 0);
    base.setDate(base.getDate() + days);
    return toIsoDate(base);
  }

  // ISO YYYY-MM-DD or YYYY/MM/DD
  let m = trimmed.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (m) {
    const [, y, mo, d] = m;
    return toIsoDate(new Date(Number(y), Number(mo) - 1, Number(d)));
  }

  // M/D or M/D/YY or M/D/YYYY
  m = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?$/);
  if (m) {
    const [, mo, d, yRaw] = m;
    const now = new Date();
    let y = yRaw ? Number(yRaw) : now.getFullYear();
    if (y < 100) y += 2000;
    return toIsoDate(new Date(y, Number(mo) - 1, Number(d)));
  }

  // Last resort — let the JS parser try (handles "Jul 19, 2026", "19 Jul 2026", etc).
  const fallback = new Date(trimmed);
  if (!isNaN(fallback.getTime())) return toIsoDate(fallback);

  return null;
}

// ─── Term-of-agreement parsing ────────────────────────────────────────
// "60" → "60 days". "60d" / "60 d" → "60 days". Free text passes through.
export function parseTermInput(s: string): string | null {
  const trimmed = s.trim();
  if (trimmed === "") return null;
  if (/^\d+$/.test(trimmed)) {
    const n = Number(trimmed);
    return `${n} day${n === 1 ? "" : "s"}`;
  }
  const m = trimmed.match(/^(\d+)\s*d(?:ays?)?$/i);
  if (m) {
    const n = Number(m[1]);
    return `${n} day${n === 1 ? "" : "s"}`;
  }
  return trimmed;
}

export function relativeTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
