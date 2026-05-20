import Link from "next/link";
import { Inbox } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";

export default function InboxPage() {
  return (
    <>
      <PageHeader title="Inbox" description="Forwarded leads land here once Gmail intake is wired up." />
      <div className="max-w-xl mx-auto px-8 py-16 text-center">
        <Inbox size={40} className="mx-auto text-[var(--color-text-faint)]" strokeWidth={1} />
        <p className="text-sm text-[var(--color-text-muted)] mt-3">
          The Gmail forwarding integration ships in Phase B. Once configured, leads forwarded to{" "}
          <span className="font-mono text-[var(--color-text)]">leads.centurion@gmail.com</span> will be
          parsed by Claude and appear here as draft deals you can review and promote.
        </p>
        <p className="text-xs text-[var(--color-text-faint)] mt-6">
          For now,{" "}
          <Link href="/deals/new" className="text-[var(--color-accent)] hover:underline">
            create a deal manually
          </Link>
          .
        </p>
      </div>
    </>
  );
}
