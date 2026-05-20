import type { FormatterId } from "../types";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const usdWithCents = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

export function formatValue(value: unknown, formatter: FormatterId): string {
  if (value === null || value === undefined || value === "") return "";

  switch (formatter) {
    case "currency": {
      const n = Number(value);
      if (!Number.isFinite(n)) return String(value);
      return Number.isInteger(n) ? usd.format(n) : usdWithCents.format(n);
    }
    case "currency-short": {
      const n = Number(value);
      if (!Number.isFinite(n)) return String(value);
      if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
      if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
      return usd.format(n);
    }
    case "date-long": {
      const d = toDate(value);
      return d ? d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : String(value);
    }
    case "date-short": {
      const d = toDate(value);
      return d ? d.toLocaleDateString("en-US") : String(value);
    }
    case "phone":
      return formatPhone(String(value));
    case "address-single":
      return String(value).replace(/\s*\n\s*/g, ", ");
    case "address-multiline":
      return String(value);
    case "name-first-last": {
      if (typeof value === "object" && value && "firstName" in value) {
        const v = value as { firstName?: string; lastName?: string };
        return [v.firstName, v.lastName].filter(Boolean).join(" ");
      }
      return String(value);
    }
    case "name-last-first": {
      if (typeof value === "object" && value && "firstName" in value) {
        const v = value as { firstName?: string; lastName?: string };
        return [v.lastName, v.firstName].filter(Boolean).join(", ");
      }
      return String(value);
    }
    case "raw":
    default:
      return String(value);
  }
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return raw;
}
