"use client";

import { useState } from "react";
import { Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FIELD_PATHS, type Binding, type FormatterId } from "@/lib/types";
import { pathToToken } from "@/lib/template-engine/fields";

const FORMATTERS: { id: FormatterId; label: string }[] = [
  { id: "raw", label: "Plain text" },
  { id: "currency", label: "Currency ($2,000,000)" },
  { id: "currency-short", label: "Currency short ($2M)" },
  { id: "date-long", label: "Date (May 19, 2026)" },
  { id: "date-short", label: "Date (05/19/2026)" },
  { id: "phone", label: "Phone ((310) 555-1234)" },
  { id: "name-first-last", label: "Name (First Last)" },
  { id: "name-last-first", label: "Name (Last, First)" },
  { id: "address-single", label: "Address (single line)" },
  { id: "address-multiline", label: "Address (multi-line)" },
];

type Props = {
  selectedText: string;
  pdfBox?: Binding["pdfBox"];
  onAdd: (binding: Binding) => void;
  onCancel: () => void;
};

export function FieldPicker({ selectedText, pdfBox, onAdd, onCancel }: Props) {
  const [fieldPath, setFieldPath] = useState<string>(FIELD_PATHS[0].path);
  const [format, setFormat] = useState<FormatterId>(FIELD_PATHS[0].format);

  function handlePathChange(p: string) {
    setFieldPath(p);
    const spec = FIELD_PATHS.find((f) => f.path === p);
    if (spec) setFormat(spec.format);
  }

  function submit() {
    const spec = FIELD_PATHS.find((f) => f.path === fieldPath);
    onAdd({
      token: pathToToken(fieldPath),
      fieldPath,
      format,
      originalText: selectedText,
      pdfBox,
      label: spec?.label,
    });
  }

  return (
    <div className="space-y-3 border border-[var(--color-accent)]/50 rounded-md p-3 bg-[var(--color-bg-elevated)]">
      <div className="text-xs text-[var(--color-text-faint)]">Selected</div>
      <div className="font-mono text-sm px-2 py-1.5 rounded bg-[var(--color-bg)] border border-[var(--color-border)] break-all">
        {selectedText || "—"}
      </div>

      <div>
        <Label>Bind to field</Label>
        <Select value={fieldPath} onChange={(e) => handlePathChange(e.target.value)}>
          {FIELD_PATHS.map((f) => (
            <option key={f.path} value={f.path}>
              {f.label}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label>Format</Label>
        <Select value={format} onChange={(e) => setFormat(e.target.value as FormatterId)}>
          {FORMATTERS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex gap-2 pt-1">
        <Button type="button" size="sm" onClick={submit} disabled={!selectedText}>
          Add binding
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
