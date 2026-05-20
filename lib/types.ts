// String unions that mirror the SQLite-friendly columns in prisma/schema.prisma.

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
  { path: "deal.realtor.fullName", label: "Realtor name", format: "name-first-last" as FormatterId },
  { path: "deal.realtor.email", label: "Realtor email", format: "raw" as FormatterId },
  { path: "deal.realtor.phone", label: "Realtor phone", format: "phone" as FormatterId },
  // Meta
  { path: "today", label: "Today's date", format: "date-long" as FormatterId },
] as const;

export type FieldPathSpec = (typeof FIELD_PATHS)[number];
