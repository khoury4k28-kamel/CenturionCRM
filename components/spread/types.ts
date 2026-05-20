// Shared types & column model for the Spread table.
// Used by SpreadStore, SpreadTable, SpreadCell, AddressPopover.

export type SpreadDeal = {
  id: string;
  stage: string;
  agreedPrice: number | null;
  listPrice: number | null;
  acceptanceDate: string | null;
  expirationDate: string | null;
  termOfAgreement: string | null;
  amountOwed: number | null;
  weOwn: boolean;
  flaggedForReview: boolean;
  notes: string | null;
  property: {
    address: string;
    city: string | null;
    state: string | null;
    zip: string | null;
  };
};

// All columns the user can select with click/arrow keys.
// `expProfit` is read-only but selectable so the user can see/copy the derived value.
export const COLUMN_IDS = [
  "flag",
  "address",
  "agreedPrice",
  "listPrice",
  "expProfit",
  "acceptanceDate",
  "expirationDate",
  "termOfAgreement",
  "owed",
  "notes",
] as const;
export type ColumnId = (typeof COLUMN_IDS)[number];

// Subset of columns that can enter edit mode (Enter / double-click).
// `flag` toggles on click, `expProfit` is derived.
export const EDITABLE_COLUMN_IDS = [
  "address",
  "agreedPrice",
  "listPrice",
  "acceptanceDate",
  "expirationDate",
  "termOfAgreement",
  "owed",
  "notes",
] as const;
export type EditableColumnId = (typeof EDITABLE_COLUMN_IDS)[number];

export const COLUMN_LABELS: Record<ColumnId, string> = {
  flag: "",
  address: "Property Address",
  agreedPrice: "Purchase Price",
  listPrice: "List Price",
  expProfit: "Exp. Profit",
  acceptanceDate: "Acceptance",
  expirationDate: "Expiration",
  termOfAgreement: "Term of Agmt.",
  owed: "Owed",
  notes: "Comments",
};

// Column widths in pixels. `null` = auto (fills remaining width).
// Total fixed = 32+280+120+120+120+100+100+120+120 = 1112px before notes.
export const COLUMN_WIDTHS: Record<ColumnId, number | null> = {
  flag: 32,
  address: 280,
  agreedPrice: 120,
  listPrice: 120,
  expProfit: 120,
  acceptanceDate: 110,
  expirationDate: 110,
  termOfAgreement: 130,
  owed: 110,
  notes: null,
};

export const COLUMN_ALIGN: Record<ColumnId, "left" | "right" | "center"> = {
  flag: "center",
  address: "left",
  agreedPrice: "right",
  listPrice: "right",
  expProfit: "right",
  acceptanceDate: "left",
  expirationDate: "left",
  termOfAgreement: "left",
  owed: "right",
  notes: "left",
};

export function isEditable(col: ColumnId): col is EditableColumnId {
  return (EDITABLE_COLUMN_IDS as readonly string[]).includes(col);
}
