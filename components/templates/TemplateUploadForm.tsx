"use client";

import { type ReactNode, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useData } from "@/contexts/DataContext";

export function TemplateUploadForm({ children }: { children: ReactNode }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { addTemplate } = useData();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") ?? "").trim();
    const description = String(fd.get("description") ?? "").trim();
    const file = fd.get("file");
    if (!(file instanceof File) || !file.size) {
      toast.error("File required");
      return;
    }
    if (!name) {
      toast.error("Name required");
      return;
    }
    startTransition(async () => {
      const id = await addTemplate({ name, description, file });
      if (!id) return;
      router.push(`/templates/detail?id=${id}`);
    });
  }

  return (
    <form onSubmit={onSubmit} data-pending={pending ? "" : undefined}>
      {children}
    </form>
  );
}
