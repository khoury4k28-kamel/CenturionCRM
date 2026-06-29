"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams, notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { TemplatePickerList } from "@/components/documents/TemplatePickerList";
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
  const { deals, isLoaded } = useData();

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
          <Link href="/deals" className="text-[var(--color-accent)] hover:underline">
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
      <div className="max-w-2xl mx-auto px-8 py-8 space-y-3">
        <div className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
          Pick a template
        </div>
        <TemplatePickerList dealId={deal.id} />
      </div>
    </>
  );
}
