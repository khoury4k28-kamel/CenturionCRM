// String unions that mirror the SQLite-friendly columns in prisma/schema.prisma.

// A team member is a person who has signed into the app via Google. The roster
// lives in Liveblocks storage (see lib/liveblocks.config.ts); the BackendDataProvider
// stubs it as an empty list since local Prisma mode is single-user.
export type TeamMember = {
  id: string;
  email: string;       // canonical lowercase Google email — also the dedup key
  name: string;        // Google display name
  picture: string;     // Google profile photo URL (may be empty)
  color: string;       // hex from the fixed palette in lib/colors.ts
  addedAt: number;     // epoch ms
};

// Activity log — append-only stream of meaningful mutations. Each entry is
// self-contained (actor + entity info frozen at log time) so the rail still
// renders correctly after the underlying user or entity is removed.
export type ActivityKind =
  // Manual, user-logged activities (the CRM "what happened on the call" stream).
  | "note.logged"
  | "call.logged"
  | "email.logged"
  | "meeting.logged"
  // Auto-logged system events.
  | "task.added"
  | "task.completed"
  | "task.uncompleted"
  | "task.deleted"
  | "task.assigned"
  | "task.unassigned"
  | "deal.added"
  | "deal.stageChanged"
  | "deal.deleted"
  | "contact.added"
  | "contact.deleted"
  | "template.added"
  | "template.deleted"
  | "document.generated"
  | "team.memberJoined"
  | "team.memberRemoved"
  | "team.allowlistAdded"
  | "team.allowlistRemoved";

// Manual activity kinds a user can log directly (subset of ActivityKind).
export const MANUAL_ACTIVITY_KINDS = [
  "note.logged",
  "call.logged",
  "email.logged",
  "meeting.logged",
] as const;
export type ManualActivityKind = (typeof MANUAL_ACTIVITY_KINDS)[number];

export type ActivityEntityType =
  | "deal"
  | "contact"
  | "task"
  | "template"
  | "document"
  | "team";

export type ActivityEntry = {
  id: string;
  ts: number;                       // epoch ms — Date.now() at log time
  actorEmail: string;               // lowercase, frozen
  actorName: string;                // frozen — survives member removal
  actorColor: string;               // hex, frozen
  actorPicture?: string;            // Google photo URL, frozen
  kind: ActivityKind;
  summary: string;                  // pre-rendered prose for the rail
  body?: string;                    // free-text content for manual logs (note/call/email/meeting)
  dealId?: string;                  // the deal this event belongs to — powers per-deal timelines
  entityType?: ActivityEntityType;
  entityId?: string;
  entityLabel?: string;             // frozen at log time
};

export const DEAL_STAGES = [
  "NEW_LEAD",
  "RESEARCHING",
  "CONTACTED",
  "NEGOTIATING",
  "UNDER_AGREEMENT",
  "IN_ESCROW",
  "LISTED",
  "CLOSED",
  "DEAD",
] as const;
export type DealStage = (typeof DEAL_STAGES)[number];

export const DEAL_STAGE_LABELS: Record<DealStage, string> = {
  NEW_LEAD: "New Lead",
  RESEARCHING: "Researching",
  CONTACTED: "Contacted",
  NEGOTIATING: "Negotiating",
  UNDER_AGREEMENT: "Under Agreement",
  IN_ESCROW: "In Escrow",
  LISTED: "Listed",
  CLOSED: "Closed",
  DEAD: "Dead",
};

// Editable columns in the spread (deals kanban) view.
export const SPREAD_FIELDS = [
  "address",
  "city",
  "state",
  "zip",
  "agreedPrice",
  "listPrice",
  "acceptanceDate",
  "expirationDate",
  "termOfAgreement",
  "amountOwed",
  "notes",
  "stage",
] as const;
export type SpreadField = (typeof SPREAD_FIELDS)[number];

export const AGREEMENT_TYPES = ["PURCHASE", "OPTION"] as const;
export type AgreementType = (typeof AGREEMENT_TYPES)[number];

export const CONTACT_TYPES = [
  "SELLER",
  "REALTOR",
  "ESCROW_OFFICER",
  "PHOTOGRAPHER",
  "TRANSACTION_COORDINATOR",
  "OTHER",
] as const;
export type ContactType = (typeof CONTACT_TYPES)[number];

export const CONTACT_TYPE_LABELS: Record<ContactType, string> = {
  SELLER: "Seller",
  REALTOR: "Realtor",
  ESCROW_OFFICER: "Escrow Officer",
  PHOTOGRAPHER: "Photographer",
  TRANSACTION_COORDINATOR: "Transaction Coordinator",
  OTHER: "Other",
};

export const TEMPLATE_FORMATS = ["DOCX", "PDF"] as const;
export type TemplateFormat = (typeof TEMPLATE_FORMATS)[number];

export const DOC_STATUSES = [
  "DRAFT",
  "SENT",
  "VIEWED",
  "SIGNED",
  "COMPLETED",
  "VOIDED",
] as const;
export type DocStatus = (typeof DOC_STATUSES)[number];

export const EMAIL_DIRECTIONS = ["INBOUND", "OUTBOUND"] as const;
export type EmailDirection = (typeof EMAIL_DIRECTIONS)[number];

// Template binding — one entry per CRM field substitution in a template.
export type FormatterId =
  | "raw"
  | "currency"
  | "currency-short"
  | "date-long"
  | "date-short"
  | "phone"
  | "address-single"
  | "address-multiline"
  | "name-first-last"
  | "name-last-first";

export type Binding = {
  /** The token name inserted in the DOCX template, e.g. "property_asking_price". Auto-derived from fieldPath. */
  token: string;
  /** Dotted CRM path, e.g. "deal.property.askingPrice" or "deal.seller.firstName". */
  fieldPath: string;
  /** How to format the value at generation time. */
  format: FormatterId;
  /** The literal text the user highlighted in the source template (used for find/replace at tokenization time). */
  originalText: string;
  /** For PDFs only: bounding box (in PDF user-space coords). */
  pdfBox?: { page: number; x: number; y: number; width: number; height: number };
  /** Optional human-readable label for the bindings list. */
  label?: string;
};

// The set of CRM field paths a binding can resolve to. Used by the field picker UI.
export const FIELD_PATHS = [
  // Deal
  { path: "deal.askingPrice", label: "Asking price", format: "currency" as FormatterId },
  { path: "deal.ourOffer", label: "Our offer", format: "currency" as FormatterId },
  { path: "deal.agreedPrice", label: "Agreed price", format: "currency" as FormatterId },
  { path: "deal.agreementType", label: "Agreement type", format: "raw" as FormatterId },
  { path: "deal.source", label: "Lead source", format: "raw" as FormatterId },
  { path: "deal.notes", label: "Deal notes", format: "raw" as FormatterId },
  // Property
  { path: "deal.property.address", label: "Property address", format: "raw" as FormatterId },
  { path: "deal.property.city", label: "City", format: "raw" as FormatterId },
  { path: "deal.property.state", label: "State", format: "raw" as FormatterId },
  { path: "deal.property.zip", label: "ZIP", format: "raw" as FormatterId },
  { path: "deal.property.bedrooms", label: "Bedrooms", format: "raw" as FormatterId },
  { path: "deal.property.bathrooms", label: "Bathrooms", format: "raw" as FormatterId },
  { path: "deal.property.sqft", label: "Square footage", format: "raw" as FormatterId },
  { path: "deal.property.lotSize", label: "Lot size", format: "raw" as FormatterId },
  { path: "deal.property.yearBuilt", label: "Year built", format: "raw" as FormatterId },
  { path: "deal.property.apn", label: "APN", format: "raw" as FormatterId },
  // Seller
  { path: "deal.seller.firstName", label: "Seller first name", format: "raw" as FormatterId },
  { path: "deal.seller.lastName", label: "Seller last name", format: "raw" as FormatterId },
  { path: "deal.seller.fullName", label: "Seller full name", format: "name-first-last" as FormatterId },
  { path: "deal.seller.email", label: "Seller email", format: "raw" as FormatterId },
  { path: "deal.seller.phone", label: "Seller phone", format: "phone" as FormatterId },
  // Realtor
  { path: "deal.realtor.firstName", label: "Realtor first name", format: "raw" as FormatterId },
  { path: "deal.realtor.lastName", label: "Realtor last name", format: "raw" as FormatterId },
  { path: "deal.realtor.fullName", label: "Realtor full name", format: "name-first-last" as FormatterId },
  { path: "deal.realtor.email", label: "Realtor email", format: "raw" as FormatterId },
  { path: "deal.realtor.phone", label: "Realtor phone", format: "phone" as FormatterId },
  // Meta
  { path: "today", label: "Today's date", format: "date-long" as FormatterId },
] as const;

export type FieldPathSpec = (typeof FIELD_PATHS)[number];
