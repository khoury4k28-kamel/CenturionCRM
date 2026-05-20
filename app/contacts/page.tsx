"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CONTACT_TYPE_LABELS, type ContactType } from "@/lib/types";
import { useData } from "@/contexts/DataContext";
import type { ContactDTO } from "@/lib/dto";

export default function ContactsPage() {
  const { contacts, isLoaded } = useData();

  const byType = useMemo<Record<string, ContactDTO[]>>(() => {
    const sorted = [...contacts].sort(
      (a, b) => a.type.localeCompare(b.type) || a.firstName.localeCompare(b.firstName),
    );
    return sorted.reduce<Record<string, ContactDTO[]>>((acc, c) => {
      (acc[c.type] ||= []).push(c);
      return acc;
    }, {});
  }, [contacts]);

  if (!isLoaded) {
    return (
      <>
        <PageHeader title="Contacts" description="Loading…" />
        <div className="px-8 py-12 text-sm text-[var(--color-text-faint)]">Loading contacts…</div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Contacts"
        description={`${contacts.length} contact${contacts.length === 1 ? "" : "s"}`}
        actions={
          <Link href="/contacts/new">
            <Button>
              <Plus size={14} strokeWidth={2.5} />
              New contact
            </Button>
          </Link>
        }
      />
      <div className="px-8 py-6">
        {contacts.length === 0 ? (
          <div className="text-sm text-[var(--color-text-muted)] text-center py-16">
            No contacts yet.{" "}
            <Link href="/contacts/new" className="text-[var(--color-accent)]">
              Add one
            </Link>
            .
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(byType).map(([type, items]) => (
              <div key={type}>
                <div className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
                  {CONTACT_TYPE_LABELS[type as ContactType] ?? type} · {items.length}
                </div>
                <Card>
                  <ul>
                    {items.map((c) => (
                      <li
                        key={c.id}
                        className="px-5 py-3 border-t border-[var(--color-panel-border)] first:border-t-0"
                      >
                        <Link
                          href={`/contacts/detail?id=${c.id}`}
                          className="flex items-center justify-between"
                        >
                          <div>
                            <div className="text-sm">
                              {c.firstName} {c.lastName ?? ""}
                            </div>
                            <div className="text-xs text-[var(--color-text-faint)]">
                              {[c.email, c.phone, c.company].filter(Boolean).join(" · ") ||
                                "No contact info"}
                            </div>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Card>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
