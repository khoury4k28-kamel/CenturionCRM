import Link from "next/link";
import { ArrowLeft, Upload } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { TemplateUploadForm } from "@/components/templates/TemplateUploadForm";

export default function NewTemplatePage() {
  return (
    <>
      <PageHeader
        title="Upload template"
        description="DOCX or PDF. After uploading you'll be taken to the binding editor."
        actions={
          <Link href="/templates">
            <Button variant="secondary">
              <ArrowLeft size={14} /> Back
            </Button>
          </Link>
        }
      />
      <div className="max-w-xl mx-auto px-8 py-8">
        <TemplateUploadForm>
          <Card>
            <CardContent className="space-y-5">
              <div>
                <Label>
                  Template name <span className="text-[var(--color-accent)]">*</span>
                </Label>
                <Input name="name" required placeholder="Purchase Agreement v3" />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea name="description" rows={2} placeholder="Used for standard residential purchases." />
              </div>
              <div>
                <Label>
                  File <span className="text-[var(--color-accent)]">*</span>
                </Label>
                <Input name="file" type="file" accept=".docx,.pdf" required />
                <p className="text-xs text-[var(--color-text-faint)] mt-1.5">
                  We&apos;ll keep the original file and produce a tokenized copy when you save bindings.
                </p>
              </div>
            </CardContent>
          </Card>
          <div className="flex justify-end gap-2 mt-4">
            <Link href="/templates">
              <Button variant="ghost" type="button">
                Cancel
              </Button>
            </Link>
            <Button type="submit">
              <Upload size={14} /> Upload
            </Button>
          </div>
        </TemplateUploadForm>
      </div>
    </>
  );
}
