import { prisma } from "@/lib/db";
import { DEAL_STAGES, SPREAD_FIELDS, type DealStage, type SpreadField } from "@/lib/types";

const PROPERTY_STRING_FIELDS = new Set<SpreadField>(["address", "city", "state", "zip"]);
const MONEY_FIELDS = new Set<SpreadField>(["agreedPrice", "listPrice", "amountOwed"]);
const DATE_FIELDS = new Set<SpreadField>(["acceptanceDate", "expirationDate"]);

function nz(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}

function nzNumber(v: unknown): number | null {
  const s = nz(v);
  if (s === null) return null;
  const n = Number(s.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

async function getDefaultUser() {
  const user = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
  if (!user) throw new Error("No users seeded; run prisma/seed.ts");
  return user;
}

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

export async function createDeal(input: DealCreateInput) {
  const address = nz(input.address);
  if (!address) throw new Error("Address required");
  const user = await getDefaultUser();

  return prisma.deal.create({
    data: {
      stage: "NEW_LEAD",
      askingPrice: nzNumber(input.askingPrice) ?? undefined,
      ourOffer: nzNumber(input.ourOffer) ?? undefined,
      source: nz(input.source) ?? undefined,
      notes: nz(input.notes) ?? undefined,
      createdBy: { connect: { id: user.id } },
      property: {
        create: {
          address,
          city: nz(input.city) ?? undefined,
          state: nz(input.state) ?? undefined,
          zip: nz(input.zip) ?? undefined,
          bedrooms: nzNumber(input.bedrooms) ?? undefined,
          bathrooms: nzNumber(input.bathrooms) ?? undefined,
          sqft: nzNumber(input.sqft) ?? undefined,
          lotSize: nzNumber(input.lotSize) ?? undefined,
          yearBuilt: nzNumber(input.yearBuilt) ?? undefined,
        },
      },
    },
  });
}

export type DealUpdateInput = {
  fields?: {
    stage?: string | null;
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
    address?: string | null;
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

export async function updateDeal(id: string, input: DealUpdateInput) {
  const fields = input.fields ?? {};
  const stage = nz(fields.stage);
  if (stage && !DEAL_STAGES.includes(stage as DealStage)) {
    throw new Error(`Invalid stage: ${stage}`);
  }

  await prisma.deal.update({
    where: { id },
    data: {
      stage: stage ?? undefined,
      askingPrice: nzNumber(fields.askingPrice),
      ourOffer: nzNumber(fields.ourOffer),
      agreedPrice: nzNumber(fields.agreedPrice),
      agreementType: nz(fields.agreementType),
      source: nz(fields.source),
      notes: nz(fields.notes),
      sellerId: nz(fields.sellerId),
      realtorId: nz(fields.realtorId),
    },
  });

  const p = input.property;
  if (p?.id) {
    await prisma.property.update({
      where: { id: p.id },
      data: {
        address: nz(p.address) ?? undefined,
        city: nz(p.city),
        state: nz(p.state),
        zip: nz(p.zip),
        bedrooms: nzNumber(p.bedrooms),
        bathrooms: nzNumber(p.bathrooms),
        sqft: nzNumber(p.sqft),
        lotSize: nzNumber(p.lotSize),
        yearBuilt: nzNumber(p.yearBuilt),
        apn: nz(p.apn),
      },
    });
  }
}

export async function moveDealStage(id: string, stage: DealStage) {
  if (!DEAL_STAGES.includes(stage)) throw new Error("Invalid stage");
  return prisma.deal.update({ where: { id }, data: { stage } });
}

export async function deleteDeal(id: string) {
  try {
    await prisma.deal.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}

export async function updateSpreadField(
  id: string,
  field: SpreadField,
  rawValue: string | number | null,
) {
  if (!SPREAD_FIELDS.includes(field)) throw new Error(`Invalid spread field: ${field}`);

  if (PROPERTY_STRING_FIELDS.has(field)) {
    const next = rawValue === null || rawValue === "" ? null : String(rawValue).trim();
    if (field === "address" && (next === null || next.length === 0)) {
      throw new Error("Address cannot be empty");
    }
    return prisma.deal.update({
      where: { id },
      data: { property: { update: { [field]: next } } },
    });
  }
  if (MONEY_FIELDS.has(field)) {
    const n = rawValue === null || rawValue === "" ? null : Number(String(rawValue).replace(/[^\d.-]/g, ""));
    return prisma.deal.update({
      where: { id },
      data: { [field]: n === null || !Number.isFinite(n) ? null : n },
    });
  }
  if (DATE_FIELDS.has(field)) {
    const d = rawValue === null || rawValue === "" ? null : new Date(String(rawValue));
    return prisma.deal.update({
      where: { id },
      data: { [field]: d && !Number.isNaN(d.getTime()) ? d : null },
    });
  }
  if (field === "stage") {
    const s = String(rawValue ?? "");
    if (!DEAL_STAGES.includes(s as DealStage)) throw new Error(`Invalid stage: ${s}`);
    return prisma.deal.update({ where: { id }, data: { stage: s } });
  }
  // termOfAgreement, notes
  const s = rawValue === null ? null : String(rawValue);
  return prisma.deal.update({ where: { id }, data: { [field]: s } });
}

export async function toggleFlag(id: string) {
  const deal = await prisma.deal.findUnique({
    where: { id },
    select: { flaggedForReview: true },
  });
  if (!deal) throw new Error("Deal not found");
  return prisma.deal.update({
    where: { id },
    data: { flaggedForReview: !deal.flaggedForReview },
  });
}

// Explicit setter used by undo (which has the exact prior state, not a toggle).
export async function setFlag(id: string, flagged: boolean) {
  return prisma.deal.update({
    where: { id },
    data: { flaggedForReview: flagged },
  });
}

// Batch update of property address fields. Used by AddressPopover so the four fields
// commit as a single undoable op.
export type UpdateAddressInput = {
  address?: string;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
};

export async function updateAddress(id: string, fields: UpdateAddressInput) {
  const data: Record<string, string | null> = {};
  if (fields.address !== undefined) {
    const a = String(fields.address).trim();
    if (!a) throw new Error("Address cannot be empty");
    data.address = a;
  }
  if (fields.city !== undefined) data.city = nz(fields.city);
  if (fields.state !== undefined) data.state = nz(fields.state);
  if (fields.zip !== undefined) data.zip = nz(fields.zip);

  return prisma.deal.update({
    where: { id },
    data: { property: { update: data } },
  });
}

export async function setWeOwn(id: string, value: boolean) {
  return prisma.deal.update({
    where: { id },
    data: { weOwn: value, ...(value ? { amountOwed: null } : {}) },
  });
}

/**
 * Parses the free-form OWED cell value:
 *   "" | "0" | "-0-" | "-"   → amountOwed=null, weOwn=false  (renders "-0-")
 *   "we own" | contains "own" → weOwn=true, amountOwed=null  (renders "WE OWN")
 *   any number-like string   → amountOwed=N, weOwn=false     (renders "$N")
 */
export async function setOwed(id: string, raw: string) {
  const s = raw.trim().toLowerCase();
  if (s === "" || s === "0" || s === "-0-" || s === "-") {
    return prisma.deal.update({ where: { id }, data: { amountOwed: null, weOwn: false } });
  }
  if (s.includes("own")) {
    return prisma.deal.update({ where: { id }, data: { amountOwed: null, weOwn: true } });
  }
  const n = Number(s.replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(n)) throw new Error(`Couldn't parse "${raw}" as a dollar amount`);
  return prisma.deal.update({ where: { id }, data: { amountOwed: n, weOwn: false } });
}

export async function createSpreadRow(section: "ACTIVES" | "IN_ESCROW", address: string) {
  const trimmed = address.trim();
  if (!trimmed) throw new Error("Address required");
  if (section !== "ACTIVES" && section !== "IN_ESCROW") throw new Error("Invalid section");
  const user = await getDefaultUser();

  return prisma.deal.create({
    data: {
      stage: section === "IN_ESCROW" ? "IN_ESCROW" : "LISTED",
      createdBy: { connect: { id: user.id } },
      property: { create: { address: trimmed } },
    },
  });
}
