// Single shared context for all app data + mutations. The BackendDataProvider
// implements this in local-dev mode (state + /api fetch); a future Liveblocks
// provider (Phase 2d) will implement the same shape with the same callbacks
// so pages and components don't need to know which mode they're in.
//
// Mirrors Mālama PM's DataContext pattern. Centurion-specific entities:
// deals, contacts, tasks, templates, documents. No auth, no team members,
// no personalization — those are out of scope for v1.

"use client";

import { createContext, useContext } from "react";
import type {
  DealDTO,
  ContactDTO,
  TaskDTO,
  TemplateDTO,
  DocumentDTO,
} from "@/lib/dto";
// DocumentDTO referenced only via DataContextType.documents at this layer; keep
// the import so the type is exported transitively.
export type { DocumentDTO };
import type { DealStage, SpreadField, ContactType, DocStatus } from "@/lib/types";

// ── Mutation input shapes ────────────────────────────────────────────────

export type DealCreateInput = {
  address: string;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  bedrooms?: number | string | null;
  bathrooms?: number | string | null;
  sqft?: number | string | null;
  lotSize?: number | string | null;
  yearBuilt?: number | string | null;
  askingPrice?: number | string | null;
  ourOffer?: number | string | null;
  source?: string | null;
  notes?: string | null;
};

export type DealUpdateInput = {
  fields?: {
    stage?: DealStage;
    askingPrice?: number | string | null;
    ourOffer?: number | string | null;
    agreedPrice?: number | string | null;
    agreementType?: string | null;
    source?: string | null;
    notes?: string | null;
    sellerId?: string | null;
    realtorId?: string | null;
  };
  property?: {
    id: string;
    address?: string;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
    bedrooms?: number | string | null;
    bathrooms?: number | string | null;
    sqft?: number | string | null;
    lotSize?: number | string | null;
    yearBuilt?: number | string | null;
    apn?: string | null;
  };
};

export type ContactCreateInput = {
  type: ContactType;
  firstName: string;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  notes?: string | null;
};

export type ContactUpdateInput = Partial<ContactCreateInput>;

export type TaskCreateInput = {
  title: string;
  dealId?: string | null;
  dueDate?: string | null; // ISO date
  notes?: string | null;
};

export type TaskUpdateInput = Partial<{
  title: string;
  dealId: string | null;
  dueDate: string | null;
  completedAt: string | null;
  notes: string | null;
}>;

export type TemplateUpdateInput = Partial<{
  name: string;
  description: string | null;
  bindings: unknown[]; // Binding[] — kept loose here to avoid circular type imports
  tokenizedFileUrl: string | null;
}>;

// Phase 2e: template upload goes through the provider so Liveblocks mode can
// embed the bytes as a data URL (no /api/templates in static export). The
// BackendDataProvider implementation wraps the existing multipart endpoint.
export type TemplateCreateInput = {
  name: string;
  description?: string | null;
  file: File;
};

// ── Context shape ────────────────────────────────────────────────────────

export interface DataContextType {
  // Loading state — true once /api/sync/pull has resolved (success or failure).
  isLoaded: boolean;

  // Re-pull from /api/sync/pull. Useful after a mutation that the provider
  // doesn't manage directly (e.g., the SpreadStore's field-level commits, or
  // file uploads).
  refresh: () => Promise<void>;

  // ── Deals ────────────────────────────────────────────────
  // The Spread view's SpreadStore owns field-level updates locally, so the
  // provider only exposes create/delete and a generic update fallback. Reads
  // come from deals[].
  deals: DealDTO[];
  addDeal: (input: DealCreateInput) => Promise<string | null>;
  updateDeal: (id: string, input: DealUpdateInput) => Promise<boolean>;
  moveDealStage: (id: string, stage: DealStage) => Promise<boolean>;
  deleteDeal: (id: string) => Promise<boolean>;
  // Spread-cell updates — these are the entry points used by SpreadStore so
  // the provider's deals[] stays in sync with what the spreadsheet shows.
  updateSpreadField: (
    id: string,
    field: SpreadField,
    value: string | number | null,
  ) => Promise<boolean>;
  setDealFlag: (id: string, flagged: boolean) => Promise<boolean>;
  setDealWeOwn: (id: string, weOwn: boolean) => Promise<boolean>;
  setDealOwed: (id: string, raw: string) => Promise<boolean>;
  updateDealAddress: (
    id: string,
    fields: { address?: string; city?: string | null; state?: string | null; zip?: string | null },
  ) => Promise<boolean>;

  // ── Contacts ─────────────────────────────────────────────
  contacts: ContactDTO[];
  addContact: (input: ContactCreateInput) => Promise<string | null>;
  updateContact: (id: string, input: ContactUpdateInput) => Promise<boolean>;
  deleteContact: (id: string) => Promise<boolean>;

  // ── Tasks ────────────────────────────────────────────────
  tasks: TaskDTO[];
  addTask: (input: TaskCreateInput) => Promise<string | null>;
  updateTask: (id: string, input: TaskUpdateInput) => Promise<boolean>;
  deleteTask: (id: string) => Promise<boolean>;

  // ── Templates ────────────────────────────────────────────
  templates: TemplateDTO[];
  // Phase 2e: upload now goes through the provider. In backend mode it posts
  // multipart to /api/templates; in Liveblocks mode it embeds the file bytes
  // as a data URL on TemplateDTO so the binding editors can `fetch(fileUrl)`
  // unchanged. Returns the new template id, or null on failure.
  addTemplate: (input: TemplateCreateInput) => Promise<string | null>;
  updateTemplate: (id: string, input: TemplateUpdateInput) => Promise<boolean>;
  deleteTemplate: (id: string) => Promise<boolean>;

  // ── Documents ────────────────────────────────────────────
  documents: DocumentDTO[];
  generateDocument: (dealId: string, templateId: string) => Promise<boolean>;
  setDocumentStatus: (id: string, status: DocStatus) => Promise<boolean>;

  // ── Undo ─────────────────────────────────────────────────
  // Tasks-only for now (Mālama parity covers tasks + investors; Centurion's
  // closest analog is just tasks).
  undo: () => void;
  canUndo: boolean;
}

const DataContext = createContext<DataContextType | null>(null);

export function useData(): DataContextType {
  const ctx = useContext(DataContext);
  if (!ctx) {
    throw new Error("useData() called outside a DataContext.Provider");
  }
  return ctx;
}

export default DataContext;
