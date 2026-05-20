"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams, notFound } from "next/navigation";
import { ArrowLeft, FileText, FileType } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GenerateDocumentButton } from "@/components/documents/GenerateDocumentButton";
import { useData } from "@/contexts/DataContext";

export default function NewDocumentPage() {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader title="Generate document" description="Loading…" />
          <div className="px-8 py-12 text-sm text-[var(--color-text-faint)]">Loading…</div>
        </>
      }
    >
      <NewDocumentInner />
    </Suspense>
  );
}

function NewDocumentInner() {
  const params = useSearchParams();
  const dealId = params.get("dealId");
  const { deals, templates, isLoaded } = useData();

  if (!isLoaded) {
    return (
      <>
        <PageHeader title="Generate document" description="Loading…" />
        <div className="px-8 py-12 text-sm text-[var(--color-text-faint)]">Loading…</div>
      </>
    );
  }

  if (!dealId) {
    return (
      <>
        <PageHeader title="Generate document" description="No deal selected." />
        <div className="px-8 py-12 text-sm text-[var(--color-text-muted)]">
          <Link href="/dashboard" className="text-[var(--color-accent)] hover:underline">
            Back to pipeline
          </Link>
        </div>
      </>
    );
  }

  const deal = deals.find((d) => d.id === dealId);
  if (!deal) notFound();

  return (
    <>
      <PageHeader
        title="Generate document"
        description={`For ${deal.property.address}`}
        actions={
          <Link href={`/deals/detail?id=${deal.id}`}>
            <Button variant="secondary">
              <ArrowLeft size={14} /> Back
            </Button>
          </Link>
        }
      />
      <div className="max-w-2xl mx-auto px-8 py-8">
        {templates.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm text-[var(--color-text-muted)]">
              No templates available.{" "}
              <Link href="/templates/new" className="text-[var(--color-accent)] hover:underline">
                Upload one
              </Link>
              .
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
              Pick a template
            </div>
            {templates.map((t) => {
              const bindings = t.bindings.length;
              const needsTokenization = t.format === "DOCX" && !t.tokenizedFileUrl;
              return (
                <Card
                  key={t.id}
                  className="p-4 hover:border-[var(--color-border-strong)] transition-colors"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      {t.format === "DOCX" ? (
                        <FileText size={18} className="text-[var(--color-info)]" strokeWidth={1.5} />
                      ) : (
                        <FileType size={18} className="text-[var(--color-danger)]" strokeWidth={1.5} />
                      )}
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{t.name}</div>
                        <div className="text-xs text-[var(--color-text-faint)] mt-0.5">
                          {bindings} bindings · {t.format}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {needsTokenization ? (
                        <Badge variant="muted">Open editor & save first</Badge>
                      ) : null}
                      <GenerateDocumentButton
                        dealId={deal.id}
                        templateId={t.id}
                        disabled={needsTokenization}
                      />
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
