"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useData } from "@/contexts/DataContext";

export function DeleteTemplateButton({ templateId }: { templateId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { deleteTemplate } = useData();

  function onClick() {
    if (!confirm("Delete this template?")) return;
    startTransition(async () => {
      const ok = await deleteTemplate(templateId);
      if (!ok) return;
      toast.success("Template deleted");
      router.push("/templates");
    });
  }

  return (
    <Button
      type="button"
      variant="ghost"
      className="text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10"
      onClick={onClick}
      disabled={pending}
    >
      <Trash2 size={14} /> Delete
    </Button>
  );
}
