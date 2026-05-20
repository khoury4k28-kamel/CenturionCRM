"use client";

import Link from "next/link";
import { Plus, FileText, FileType } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { relativeTime } from "@/lib/utils";
import { useData } from "@/contexts/DataContext";

export default function TemplatesPage() {
  const { templates, isLoaded } = useData();

  if (!isLoaded) {
    return (
      <>
        <PageHeader title="Templates" description="Loading…" />
        <div className="px-8 py-12 text-sm text-[var(--color-text-faint)]">
          Loading templates…
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Templates"
        description="Upload .docx or .pdf templates, then click on values to bind them to CRM fields."
        actions={
          <Link href="/templates/new">
            <Button>
              <Plus size={14} strokeWidth={2.5} />
              Upload template
            </Button>
          </Link>
        }
      />
      <div className="px-8 py-6">
        {templates.length === 0 ? (
          <div className="text-center py-16">
            <FileText size={40} className="mx-auto text-[var(--color-text-faint)]" strokeWidth={1} />
            <p className="text-sm text-[var(--color-text-muted)] mt-3 max-w-md mx-auto">
              No templates yet. Upload a purchase or option agreement, then highlight values like
              the asking price and bind them to your deals so each generated document is pre-filled.
            </p>
            <Link href="/templates/new" className="inline-block mt-4">
              <Button>
                <Plus size={14} /> Upload your first template
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {templates.map((t) => (
              <Link key={t.id} href={`/templates/detail?id=${t.id}`}>
                <Card className="hover:border-[var(--color-border-strong)] transition-colors p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {t.format === "DOCX" ? (
                        <FileText size={20} className="text-[var(--color-info)]" strokeWidth={1.5} />
                      ) : (
                        <FileType size={20} className="text-[var(--color-danger)]" strokeWidth={1.5} />
                      )}
                      <div>
                        <div className="text-sm font-medium">{t.name}</div>
                        {t.description ? (
                          <div className="text-xs text-[var(--color-text-faint)] mt-0.5">
                            {t.description}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <Badge variant="muted">{t.format}</Badge>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-xs text-[var(--color-text-faint)]">
                    <span>{t.bindings.length} field bindings</span>
                    <span>
                      {t.documentCount} document{t.documentCount === 1 ? "" : "s"} ·{" "}
                      {relativeTime(t.updatedAt)}
                    </span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
