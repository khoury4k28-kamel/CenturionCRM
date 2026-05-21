"use client";

import { type ReactNode, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useData } from "@/contexts/DataContext";
import { dealCreatePayloadFromFormData } from "@/lib/forms/dealCreatePayload";

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
    const body = dealCreatePayloadFromFormData(new FormData(e.currentTarget));

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
