"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useData } from "@/contexts/DataContext";

export function GenerateDocumentButton({
  dealId,
  templateId,
  disabled,
}: {
  dealId: string;
  templateId: string;
  disabled?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { generateDocument } = useData();

  function onClick() {
    startTransition(async () => {
      const ok = await generateDocument(dealId, templateId);
      if (!ok) return;
      toast.success("Document generated");
      router.push(`/deals/detail?id=${dealId}`);
    });
  }

  return (
    <Button type="button" size="sm" disabled={disabled || pending} onClick={onClick}>
      Generate
    </Button>
  );
}
