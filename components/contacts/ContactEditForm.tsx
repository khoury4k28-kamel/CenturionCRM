"use client";

import { type ReactNode, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useData } from "@/contexts/DataContext";
import type { ContactType } from "@/lib/types";
import { CONTACT_TYPES } from "@/lib/types";

type Props = {
  /** If provided, form patches the existing contact. Otherwise creates a new one. */
  contactId?: string;
  /** Where to navigate on success. Defaults to the contact detail page after create, no-op for update. */
  redirectTo?: string;
  children: ReactNode;
};

function readType(raw: FormDataEntryValue | null): ContactType {
  const s = String(raw ?? "");
  return (CONTACT_TYPES as readonly string[]).includes(s) ? (s as ContactType) : "OTHER";
}

export function ContactEditForm({ contactId, redirectTo, children }: Props) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { addContact, updateContact } = useData();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body = {
      type: readType(fd.get("type")),
      firstName: String(fd.get("firstName") ?? "").trim(),
      lastName: String(fd.get("lastName") ?? "").trim() || null,
      email: String(fd.get("email") ?? "").trim() || null,
      phone: String(fd.get("phone") ?? "").trim() || null,
      company: String(fd.get("company") ?? "").trim() || null,
      notes: String(fd.get("notes") ?? "").trim() || null,
    };

    startTransition(async () => {
      if (contactId) {
        const ok = await updateContact(contactId, body);
        if (!ok) return;
        toast.success("Contact saved");
        if (redirectTo) router.push(redirectTo);
      } else {
        const newId = await addContact(body);
        if (!newId) return;
        toast.success("Contact created");
        router.push(redirectTo ?? `/contacts/detail?id=${newId}`);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} data-pending={pending ? "" : undefined}>
      {children}
    </form>
  );
}
