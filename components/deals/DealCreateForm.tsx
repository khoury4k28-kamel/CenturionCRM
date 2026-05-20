"use client";

import { type ReactNode, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useData, type DealCreateInput } from "@/contexts/DataContext";

export function DealCreateForm({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { addDeal } = useData();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body: DealCreateInput = {
      address: String(fd.get("address") ?? "").trim(),
      city: String(fd.get("city") ?? "").trim() || null,
      state: String(fd.get("state") ?? "").trim() || null,
      zip: String(fd.get("zip") ?? "").trim() || null,
      bedrooms: String(fd.get("bedrooms") ?? "") || null,
      bathrooms: String(fd.get("bathrooms") ?? "") || null,
      sqft: String(fd.get("sqft") ?? "") || null,
      lotSize: String(fd.get("lotSize") ?? "") || null,
      yearBuilt: String(fd.get("yearBuilt") ?? "") || null,
      askingPrice: String(fd.get("askingPrice") ?? "") || null,
      ourOffer: String(fd.get("ourOffer") ?? "") || null,
      source: String(fd.get("source") ?? "").trim() || null,
      notes: String(fd.get("notes") ?? "").trim() || null,
    };

    startTransition(async () => {
      const id = await addDeal(body);
      if (!id) return;
      toast.success("Deal created");
      router.push(`/deals/detail?id=${id}`);
    });
  }

  return (
    <form onSubmit={onSubmit} className={className} data-pending={pending ? "" : undefined}>
      {children}
    </form>
  );
}
