"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <button
      type="button"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "inline-flex items-center justify-center h-7 w-7 rounded-md",
        "text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
        "hover:bg-[var(--color-bg-elevated)] transition-colors",
        "border border-transparent hover:border-[var(--color-border)]",
        className,
      )}
    >
      {!mounted ? (
        <span className="h-3.5 w-3.5" aria-hidden />
      ) : isDark ? (
        <Sun size={14} strokeWidth={1.75} />
      ) : (
        <Moon size={14} strokeWidth={1.75} />
      )}
    </button>
  );
}
