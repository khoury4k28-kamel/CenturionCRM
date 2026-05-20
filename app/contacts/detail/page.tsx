"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { useSearchParams, notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ContactFormFields } from "@/components/contacts/ContactForm";
import { ContactEditForm } from "@/components/contacts/ContactEditForm";
import { DeleteContactButton } from "@/components/contacts/DeleteContactButton";
import { useData } from "@/contexts/DataContext";

export default function ContactDetailPage() {
  return (
    <Suspense fallback={<DetailLoading />}>
      <ContactDetailInner />
    </Suspense>
  );
}

function DetailLoading() {
  return (
    <>
      <PageHeader title="Contact" description="Loading…" />
      <div className="px-8 py-12 text-sm text-[var(--color-text-faint)]">Loading…</div>
    </>
  );
}

function ContactDetailInner() {
  const params = useSearchParams();
  const id = params.get("id");
  const { contacts, deals, isLoaded } = useData();

  const contact = useMemo(
    () => (id ? contacts.find((c) => c.id === id) : null),
    [contacts, id],
  );

  // Deals where this contact is seller or realtor.
  const relatedDeals = useMemo(() => {
    if (!contact) return [];
    return deals.filter((d) => d.sellerId === contact.id || d.realtorId === contact.id);
  }, [deals, contact]);

  if (!isLoaded) {
    return (
      <>
        <PageHeader title="Contact" description="Loading…" />
        <div className="px-8 py-12 text-sm text-[var(--color-text-faint)]">Loading…</div>
      </>
    );
  }

  if (!id) {
    return (
      <>
        <PageHeader title="Contact" description="No contact selected." />
        <div className="px-8 py-12 text-sm text-[var(--color-text-muted)]">
          <Link href="/contacts" className="text-[var(--color-accent)] hover:underline">
            Back to contacts
          </Link>
        </div>
      </>
    );
  }

  if (!contact) notFound();

  return (
    <>
      <PageHeader
        title={`${contact.firstName} ${contact.lastName ?? ""}`.trim()}
        actions={
          <Link href="/contacts">
            <Button variant="secondary">
              <ArrowLeft size={14} /> Back
            </Button>
          </Link>
        }
      />
      <div className="max-w-3xl mx-auto px-8 py-8 space-y-4">
        <ContactEditForm contactId={contact.id}>
          <Card>
            <CardContent>
              <ContactFormFields
                defaults={{
                  type: contact.type,
                  firstName: contact.firstName,
                  lastName: contact.lastName ?? undefined,
                  email: contact.email ?? undefined,
                  phone: contact.phone ?? undefined,
                  company: contact.company ?? undefined,
                  notes: contact.notes ?? undefined,
                }}
              />
            </CardContent>
          </Card>
          <div className="flex justify-end gap-2 mt-4">
            <Button type="submit">Save</Button>
          </div>
        </ContactEditForm>

        {relatedDeals.length > 0 ? (
          <Card>
            <CardContent>
              <div className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-3">
                Related deals
              </div>
              <ul className="space-y-1.5">
                {relatedDeals.map((d) => (
                  <li key={d.id}>
                    <Link
                      href={`/deals/detail?id=${d.id}`}
                      className="text-sm text-[var(--color-text)] hover:text-[var(--color-accent)]"
                    >
                      {d.property.address}
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}

        <DeleteContactButton contactId={contact.id} />
      </div>
    </>
  );
}
