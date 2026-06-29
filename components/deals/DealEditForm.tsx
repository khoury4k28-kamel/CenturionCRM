"use client";

import { type ReactNode, useTransition } from "react";
import { toast } from "sonner";
import { useData, type DealUpdateInput } from "@/contexts/DataContext";
import { DEAL_STAGES, type DealStage } from "@/lib/types";

const DEAL_FIELDS = [
  "stage",
  "askingPrice",
  "ourOffer",
  "agreedPrice",
  "listPrice",
  "acceptanceDate",
  "expirationDate",
  "termOfAgreement",
  "amountOwed",
  "weOwn",
  "agreementType",
  "source",
  "notes",
  "sellerId",
  "realtorId",
] as const;

const PROPERTY_FIELDS = [
  "address",
  "city",
  "state",
  "zip",
  "bedrooms",
  "bathrooms",
  "sqft",
  "lotSize",
  "yearBuilt",
  "apn",
] as const;

export function DealEditForm({
  dealId,
  propertyId,
  children,
  className,
}: {
  dealId: string;
  propertyId: string;
  children: ReactNode;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  const { updateDeal } = useData();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const get = (k: string) => {
      const v = fd.get(k);
      return v === null ? null : String(v);
    };

    const fields: NonNullable<DealUpdateInput["fields"]> = {};
    for (const k of DEAL_FIELDS) {
      const v = get(k);
      if (k === "stage" && v !== null) {
        if (!(DEAL_STAGES as readonly string[]).includes(v)) continue;
        fields.stage = v as DealStage;
      } else {
        (fields as Record<string, unknown>)[k] = v;
      }
    }

    const property: NonNullable<DealUpdateInput["property"]> = { id: propertyId };
    for (const k of PROPERTY_FIELDS) {
      (property as Record<string, unknown>)[k] = get(k);
    }

    startTransition(async () => {
      const ok = await updateDeal(dealId, { fields, property });
      if (ok) toast.success("Deal saved");
    });
  }

  return (
    <form onSubmit={onSubmit} className={className} data-pending={pending ? "" : undefined}>
      {children}
    </form>
  );
}
