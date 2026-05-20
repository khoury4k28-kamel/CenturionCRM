"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldPicker } from "./FieldPicker";
import { BindingsList } from "./BindingsList";
import type { Binding } from "@/lib/types";
import { useData } from "@/contexts/DataContext";

export function DocxBindingEditor({
  templateId,
  fileUrl,
  initialBindings,
}: {
  templateId: string;
  fileUrl: string;
  initialBindings: Binding[];
}) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [bindings, setBindings] = useState<Binding[]>(initialBindings);
  const [selection, setSelection] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [renderError, setRenderError] = useState<string | null>(null);
  const { updateTemplate } = useData();

  // Render the DOCX into the preview pane on mount.
  useEffect(() => {
    let cancelled = false;
    async function render() {
      if (!previewRef.current) return;
      try {
        const [{ renderAsync }] = await Promise.all([import("docx-preview")]);
        const res = await fetch(fileUrl);
        if (!res.ok) throw new Error(`Failed to load template (${res.status})`);
        const blob = await res.blob();
        if (cancelled || !previewRef.current) return;
        previewRef.current.replaceChildren();
        await renderAsync(blob, previewRef.current, undefined, {
          inWrapper: false,
          breakPages: false,
          ignoreWidth: false,
          ignoreHeight: true,
          renderHeaders: false,
          renderFooters: false,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setRenderError(msg);
      }
    }
    render();
    return () => {
      cancelled = true;
    };
  }, [fileUrl]);

  // Track text selection inside the preview.
  useEffect(() => {
    function onSelectionChange() {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !previewRef.current) {
        return;
      }
      const range = sel.getRangeAt(0);
      if (!previewRef.current.contains(range.commonAncestorContainer)) return;
      const text = sel.toString().trim();
      if (text) setSelection(text);
    }
    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, []);

  function addBinding(b: Binding) {
    setBindings((prev) => [...prev, b]);
    setSelection(null);
    window.getSelection()?.removeAllRanges();
    toast.success("Binding added (remember to save)");
  }

  function removeBinding(index: number) {
    setBindings((prev) => prev.filter((_, i) => i !== index));
  }

  function save() {
    startTransition(async () => {
      const ok = await updateTemplate(templateId, { bindings });
      if (ok) toast.success("Template saved");
    });
  }

  return (
    <div className="grid grid-cols-[1fr_360px] gap-4 px-8 py-6 h-[calc(100vh-9rem)]">
      <div className="border border-[var(--color-border)] rounded-md overflow-auto bg-white text-black">
        {renderError ? (
          <div className="p-6 text-[var(--color-danger)] text-sm">Could not render: {renderError}</div>
        ) : (
          <div ref={previewRef} className="p-8 prose max-w-none docx-preview-host" />
        )}
      </div>

      <div className="flex flex-col gap-4 overflow-y-auto">
        <div className="flex items-center justify-between sticky top-0 bg-[var(--color-bg)] py-1 z-10">
          <div className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
            Bindings · {bindings.length}
          </div>
          <Button size="sm" onClick={save} disabled={pending}>
            <Save size={12} /> Save
          </Button>
        </div>

        {selection ? (
          <FieldPicker
            selectedText={selection}
            onAdd={addBinding}
            onCancel={() => {
              setSelection(null);
              window.getSelection()?.removeAllRanges();
            }}
          />
        ) : (
          <div className="text-xs text-[var(--color-text-faint)] border border-dashed border-[var(--color-border)] rounded-md p-3">
            Highlight a value in the document on the left (asking price, address, seller name) to bind it
            to a CRM field. Bound text will be replaced when you generate a document for a deal.
          </div>
        )}

        <BindingsList bindings={bindings} onRemove={removeBinding} />
      </div>
    </div>
  );
}
