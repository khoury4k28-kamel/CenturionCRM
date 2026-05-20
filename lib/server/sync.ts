// Server-only: pull full app state in one round-trip for the
// BackendDataProvider's initial load. Mirrors Mālama PM's lib/server/sync.ts
// shape, but adapted for Centurion's Prisma schema.

import { prisma } from "@/lib/db";
import type {
  FullState,
  DealDTO,
  ContactDTO,
  TaskDTO,
  TemplateDTO,
  DocumentDTO,
  PropertyDTO,
} from "@/lib/dto";
import type {
  ContactType,
  DealStage,
  TemplateFormat,
  DocStatus,
  Binding,
} from "@/lib/types";
import { DEAL_STAGES } from "@/lib/types";

function toIso(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString();
}

function toIsoDate(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

function toNum(d: { toString: () => string } | null | undefined): number | null {
  if (d == null) return null;
  const n = Number(d.toString());
  return Number.isFinite(n) ? n : null;
}

function safeBindings(s: string | null | undefined): Binding[] {
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? (v as Binding[]) : [];
  } catch {
    return [];
  }
}

export async function pullFullState(): Promise<FullState> {
  // One query per top-level collection. Could be parallelized via Promise.all,
  // but Prisma over a single SQLite connection serializes anyway — Promise.all
  // doesn't help much for SQLite-backed Prisma in practice.
  const [deals, contacts, tasks, templates, documents] = await Promise.all([
    prisma.deal.findMany({
      orderBy: { createdAt: "asc" },
      include: { property: true },
    }),
    prisma.contact.findMany({
      orderBy: [{ type: "asc" }, { firstName: "asc" }],
    }),
    prisma.task.findMany({
      orderBy: [{ completedAt: "asc" }, { dueDate: "asc" }],
    }),
    prisma.template.findMany({
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { documents: true } } },
    }),
    prisma.document.findMany({
      orderBy: { createdAt: "desc" },
      include: { template: { select: { name: true, format: true } } },
    }),
  ]);

  const dealDtos: DealDTO[] = deals.map((d) => {
    const stage: DealStage = (DEAL_STAGES as readonly string[]).includes(d.stage)
      ? (d.stage as DealStage)
      : "NEW_LEAD";
    const property: PropertyDTO = {
      id: d.property.id,
      address: d.property.address,
      city: d.property.city,
      state: d.property.state,
      zip: d.property.zip,
      bedrooms: d.property.bedrooms,
      bathrooms: d.property.bathrooms,
      sqft: d.property.sqft,
      lotSize: d.property.lotSize,
      yearBuilt: d.property.yearBuilt,
      apn: d.property.apn,
    };
    return {
      id: d.id,
      stage,
      property,
      sellerId: d.sellerId,
      realtorId: d.realtorId,
      askingPrice: toNum(d.askingPrice),
      ourOffer: toNum(d.ourOffer),
      agreedPrice: toNum(d.agreedPrice),
      listPrice: toNum(d.listPrice),
      acceptanceDate: toIsoDate(d.acceptanceDate),
      expirationDate: toIsoDate(d.expirationDate),
      termOfAgreement: d.termOfAgreement,
      amountOwed: toNum(d.amountOwed),
      weOwn: d.weOwn,
      flaggedForReview: d.flaggedForReview,
      agreementType: d.agreementType,
      source: d.source,
      notes: d.notes,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    };
  });

  const contactDtos: ContactDTO[] = contacts.map((c) => ({
    id: c.id,
    type: c.type as ContactType,
    firstName: c.firstName,
    lastName: c.lastName,
    email: c.email,
    phone: c.phone,
    company: c.company,
    notes: c.notes,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }));

  const taskDtos: TaskDTO[] = tasks.map((t) => ({
    id: t.id,
    dealId: t.dealId,
    title: t.title,
    notes: t.notes,
    dueDate: toIsoDate(t.dueDate),
    completedAt: toIso(t.completedAt),
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }));

  const templateDtos: TemplateDTO[] = templates.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    format: t.format as TemplateFormat,
    originalFileUrl: t.originalFileUrl,
    tokenizedFileUrl: t.tokenizedFileUrl,
    bindings: safeBindings(t.bindings),
    documentCount: t._count.documents,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }));

  const documentDtos: DocumentDTO[] = documents.map((d) => ({
    id: d.id,
    dealId: d.dealId,
    templateId: d.templateId,
    templateName: d.template.name,
    templateFormat: d.template.format as TemplateFormat,
    fileUrl: d.fileUrl,
    status: d.status as DocStatus,
    docusignEnvelopeId: d.docusignEnvelopeId,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  }));

  return {
    deals: dealDtos,
    contacts: contactDtos,
    tasks: taskDtos,
    templates: templateDtos,
    documents: documentDtos,
  };
}
