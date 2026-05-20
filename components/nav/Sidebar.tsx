"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Table,
  Users,
  FileText,
  CheckSquare,
  Inbox,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/nav/ThemeToggle";

const items = [
  { href: "/deals", label: "Spread", icon: Table },
  { href: "/dashboard", label: "Pipeline", icon: LayoutDashboard },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/templates", label: "Templates", icon: FileText },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/inbox", label: "Inbox", icon: Inbox },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 h-screen sticky top-0 border-r border-[var(--color-border)] flex flex-col bg-[var(--color-panel)]">
      <div className="px-5 py-5 border-b border-[var(--color-border)]">
        <Link href="/deals" className="flex items-baseline gap-1.5 group">
          <span className="text-lg font-semibold tracking-tight">Centurion</span>
          <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-accent)] font-medium">
            CRM
          </span>
        </Link>
      </div>

      <nav className="flex-1 py-4">
        {items.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-5 py-2 text-sm transition-colors",
                isActive
                  ? "text-[var(--color-text)] bg-[var(--color-bg-elevated)] border-l-2 border-[var(--color-accent)]"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-elevated)] border-l-2 border-transparent",
              )}
            >
              <Icon size={16} strokeWidth={1.75} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-5 py-4 border-t border-[var(--color-border)] flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-faint)] mb-1">
            Signed in as
          </div>
          <div className="text-xs text-[var(--color-text)] truncate">Greg</div>
        </div>
        <ThemeToggle />
      </div>
    </aside>
  );
}
