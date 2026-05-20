"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams, notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DocxBindingEditor } from "@/components/templates/DocxBindingEditor";
import { PdfBindingEditor } from "@/components/templates/PdfBindingEditor";
import { DeleteTemplateButton } from "@/components/templates/DeleteTemplateButton";
import { useData } from "@/contexts/DataContext";

export default function TemplateEditorPage() {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader title="Template" description="Loading…" />
          <div className="px-8 py-12 text-sm text-[var(--color-text-faint)]">Loading…</div>
        </>
      }
    >
      <TemplateEditorInner />
    </Suspense>
  );
}

function TemplateEditorInner() {
  const params = useSearchParams();
  const id = params.get("id");
  const { templates, isLoaded } = useData();

  if (!isLoaded) {
    return (
      <>
        <PageHeader title="Template" description="Loading…" />
        <div className="px-8 py-12 text-sm text-[var(--color-text-faint)]">Loading…</div>
      </>
    );
  }

  if (!id) {
    return (
      <>
        <PageHeader title="Template" description="No template selected." />
        <div className="px-8 py-12 text-sm text-[var(--color-text-muted)]">
          <Link href="/templates" className="text-[var(--color-accent)] hover:underline">
            Back to templates
          </Link>
        </div>
      </>
    );
  }

  const template = templates.find((t) => t.id === id);
  if (!template) notFound();

  return (
    <>
      <PageHeader
        title={template.name}
        description={
          template.description ??
          "Highlight values in the document to bind them to CRM fields."
        }
        actions={
          <>
            <Badge variant="muted">{template.format}</Badge>
            <Link href="/templates">
              <Button variant="secondary">
                <ArrowLeft size={14} /> Back
              </Button>
            </Link>
            <DeleteTemplateButton templateId={template.id} />
          </>
        }
      />

      {template.format === "DOCX" ? (
        <DocxBindingEditor
          templateId={template.id}
          fileUrl={template.originalFileUrl}
          initialBindings={template.bindings}
        />
      ) : (
        <PdfBindingEditor
          templateId={template.id}
          fileUrl={template.originalFileUrl}
          initialBindings={template.bindings}
        />
      )}
    </>
  );
}
