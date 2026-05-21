// Flat, JSON-serializable shapes returned by /api/sync/pull and consumed by
// BackendDataProvider. Prisma's Decimal → number; DateTime → ISO string.
//
// Embedded relations: Deal embeds Property (1:1). Tasks and Documents link
// back to Deal via dealId. Contact references stay as IDs (sellerId/realtorId)
// — the UI resolves via the contacts[] in the same snapshot.
//
// Keep these DTOs additive: client code that targets future Liveblocks storage
// will use the same shapes, so adding fields is safe but renaming is not.

import type { ContactType, DealStage, TemplateFormat, DocStatus, Binding } from "./types";

// Activity log types live in lib/types.ts but consumers usually import all
// shapes from here — re-export for convenience.
export type {
  ActivityEntry,
  ActivityKind,
  ActivityEntityType,
} from "./types";

export type PropertyDTO = {
  id: string;
  address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  sqft: number | null;
  lotSize: number | null;
  yearBuilt: number | null;
  apn: string | null;
};

export type DealDTO = {
  id: string;
  stage: DealStage;
  property: PropertyDTO;
  sellerId: string | null;
  realtorId: string | null;
  askingPrice: number | null;
  ourOffer: number | null;
  agreedPrice: number | null;
  listPrice: number | null;
  acceptanceDate: string | null; // ISO date (YYYY-MM-DD)
  expirationDate: string | null;
  termOfAgreement: string | null;
  amountOwed: number | null;
  weOwn: boolean;
  flaggedForReview: boolean;
  agreementType: string | null; // "PURCHASE" | "OPTION" | null
  source: string | null;
  notes: string | null;
  createdAt: string; // ISO timestamp
  updatedAt: string;
};

export type ContactDTO = {
  id: string;
  type: ContactType;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TaskDTO = {
  id: string;
  dealId: string | null;
  title: string;
  notes: string | null;
  dueDate: string | null; // ISO date
  completedAt: string | null; // ISO timestamp
  // Multi-assignee — array of TeamMember.id values. Only populated in
  // Liveblocks mode; BackendDataProvider returns []. Optional in TS so old
  // records loaded from Prisma don't fail the type check.
  assignees?: string[];
  createdAt: string;
  updatedAt: string;
};

export type TemplateDTO = {
  id: string;
  name: string;
  description: string | null;
  format: TemplateFormat;
  originalFileUrl: string;
  tokenizedFileUrl: string | null;
  bindings: Binding[]; // parsed from the JSON column
  documentCount: number;
  createdAt: string;
  updatedAt: string;
};

export type DocumentDTO = {
  id: string;
  dealId: string;
  templateId: string;
  templateName: string; // denormalized so the doc-list UI doesn't need to join
  templateFormat: TemplateFormat;
  fileUrl: string;
  status: DocStatus;
  docusignEnvelopeId: string | null;
  createdAt: string;
  updatedAt: string;
};

// Full snapshot returned by /api/sync/pull.
export type FullState = {
  deals: DealDTO[];
  contacts: ContactDTO[];
  tasks: TaskDTO[];
  templates: TemplateDTO[];
  documents: DocumentDTO[];
};
