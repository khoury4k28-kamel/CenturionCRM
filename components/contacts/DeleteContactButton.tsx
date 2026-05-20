"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useData } from "@/contexts/DataContext";

export function DeleteContactButton({ contactId }: { contactId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { deleteContact } = useData();

  function onClick() {
    if (!confirm("Delete this contact?")) return;
    startTransition(async () => {
      const ok = await deleteContact(contactId);
      if (!ok) return;
      toast.success("Contact deleted");
      router.push("/contacts");
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
      Delete contact
    </Button>
  );
}
