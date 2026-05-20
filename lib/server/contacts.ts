import { prisma } from "@/lib/db";
import { CONTACT_TYPES, type ContactType } from "@/lib/types";

export type ContactInput = {
  type?: string;
  firstName: string;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  notes?: string | null;
};

function normalizeType(t: string | undefined | null): ContactType {
  if (t && CONTACT_TYPES.includes(t as ContactType)) return t as ContactType;
  return "OTHER";
}

export async function createContact(input: ContactInput) {
  const firstName = input.firstName?.trim();
  if (!firstName) throw new Error("First name required");
  return prisma.contact.create({
    data: {
      firstName,
      lastName: input.lastName ?? undefined,
      type: normalizeType(input.type),
      email: input.email ?? undefined,
      phone: input.phone ?? undefined,
      company: input.company ?? undefined,
      notes: input.notes ?? undefined,
    },
  });
}

export async function updateContact(id: string, updates: Partial<ContactInput>) {
  return prisma.contact.update({
    where: { id },
    data: {
      firstName: updates.firstName?.trim() || undefined,
      lastName: updates.lastName,
      type: updates.type ? normalizeType(updates.type) : undefined,
      email: updates.email,
      phone: updates.phone,
      company: updates.company,
      notes: updates.notes,
    },
  });
}

export async function deleteContact(id: string) {
  try {
    await prisma.contact.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}
