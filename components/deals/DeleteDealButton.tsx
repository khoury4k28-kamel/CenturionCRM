"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useData } from "@/contexts/DataContext";

export function DeleteDealButton({ dealId }: { dealId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { deleteDeal } = useData();

  function onClick() {
    if (!confirm("Delete this deal? Tasks and documents will also be deleted.")) return;
    startTransition(async () => {
      const ok = await deleteDeal(dealId);
      if (!ok) return;
      toast.success("Deal deleted");
      router.push("/dashboard");
    });
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10"
      type="button"
      onClick={onClick}
      disabled={pending}
    >
      <Trash2 size={14} />
      Delete
    </Button>
  );
}
