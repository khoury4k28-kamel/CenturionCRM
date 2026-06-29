"use client";

// Inline list of templates with a per-row Generate button. Generation runs
// through useData().generateDocument (client-side in Liveblocks mode, server
// route in local mode) and does NOT navigate away — so it works embedded in
// the deal panel as well as on the standalone /deals/documents/new page.

import { useTransition } from "react";
import Link from "next/link";
import { FileText, FileType } from "lucide-react";
import { toast } from "sonner";
import { useData } from "@/contexts/DataContext";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function TemplatePickerList({
  dealId,
  compact = false,
  onGenerated,
}: {
  dealId: string;
  /** Denser styling for the narrow deal panel. */
  compact?: boolean;
  onGenerated?: () => void;
}) {
  const { templates } = useData();

  if (templates.length === 0) {
    return (
      <div className={cn("text-center", compact ? "py-6" : "py-16")}>
        <p className="text-sm text-[var(--color-text-muted)]">
          No templates yet.{" "}
          <Link href="/templates/new" className="text-[var(--color-accent)] hover:underline">
            Upload one
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className={cn(compact ? "space-y-1.5" : "space-y-3")}>
      {templates.map((t) => {
        const needsTokenization = t.format === "DOCX" && !t.tokenizedFileUrl;
        return (
          <TemplateRow
            key={t.id}
            dealId={dealId}
            templateId={t.id}
            name={t.name}
            format={t.format}
            bindingCount={t.bindings.length}
            needsTokenization={needsTokenization}
            compact={compact}
            onGenerated={onGenerated}
          />
        );
      })}
    </div>
  );
}

function TemplateRow({
  dealId,
  templateId,
  name,
  format,
  bindingCount,
  needsTokenization,
  compact,
  onGenerated,
}: {
  dealId: string;
  templateId: string;
  name: string;
  format: "DOCX" | "PDF";
  bindingCount: number;
  needsTokenization: boolean;
  compact: boolean;
  onGenerated?: () => void;
}) {
  const { generateDocument } = useData();
  const [pending, startTransition] = useTransition();

  function generate() {
    startTransition(async () => {
      const ok = await generateDocument(dealId, templateId);
      if (ok) {
        toast.success("Document generated");
        onGenerated?.();
      }
    });
  }

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] hover:border-[var(--color-border-strong)] transition-colors",
        compact ? "px-2.5 py-2" : "p-4",
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {format === "DOCX" ? (
          <FileText size={compact ? 14 : 18} className="text-[var(--color-info)] shrink-0" strokeWidth={1.5} />
        ) : (
          <FileType size={compact ? 14 : 18} className="text-[var(--color-danger)] shrink-0" strokeWidth={1.5} />
        )}
        <div className="min-w-0">
          <div className={cn("font-medium truncate", compact ? "text-xs" : "text-sm")}>{name}</div>
          <div className={cn("text-[var(--color-text-faint)]", compact ? "text-[10px]" : "text-xs mt-0.5")}>
            {bindingCount} binding{bindingCount === 1 ? "" : "s"} · {format}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {needsTokenization ? (
          <Badge variant="muted">{compact ? "Save first" : "Open editor & save first"}</Badge>
        ) : null}
        <button
          type="button"
          onClick={generate}
          disabled={needsTokenization || pending}
          className={cn(
            "inline-flex items-center justify-center rounded-md font-medium border transition-colors disabled:opacity-50",
            "border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-accent-fg)] hover:opacity-90",
            compact ? "h-7 px-2.5 text-xs" : "h-8 px-3 text-sm",
          )}
        >
          {pending ? "Generating…" : "Generate"}
        </button>
      </div>
    </div>
  );
}
