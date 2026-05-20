"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldPicker } from "./FieldPicker";
import { BindingsList } from "./BindingsList";
import type { Binding } from "@/lib/types";
import { useData } from "@/contexts/DataContext";

// Match the basePath pattern in app/layout.tsx — static export ships under
// /CenturionCRM on GitHub Pages; local dev runs at the root.
const BASE_PATH = process.env.STATIC_EXPORT === "1" ? "/CenturionCRM" : "";

type DragState = {
  active: boolean;
  page: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
};

export function PdfBindingEditor({
  templateId,
  fileUrl,
  initialBindings,
}: {
  templateId: string;
  fileUrl: string;
  initialBindings: Binding[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [bindings, setBindings] = useState<Binding[]>(initialBindings);
  const [pendingBox, setPendingBox] = useState<{
    page: number;
    pdfBox: NonNullable<Binding["pdfBox"]>;
    selectedText: string;
  } | null>(null);
  const [pageScales, setPageScales] = useState<{ scale: number; height: number }[]>([]);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [pending, startTransition] = useTransition();
  const { updateTemplate } = useData();

  // Render each page of the PDF as a canvas inside containerRef.
  useEffect(() => {
    let cancelled = false;
    async function render() {
      if (!containerRef.current) return;
      try {
        // Use legacy build for broad bundler compat. Worker is copied into
        // /public by scripts/copy-pdf-worker.mjs (npm predev/prebuild).
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc = `${BASE_PATH}/pdf.worker.min.mjs`;
        const res = await fetch(fileUrl);
        const buf = await res.arrayBuffer();
        const doc = await pdfjs.getDocument({ data: buf }).promise;
        if (cancelled) return;

        containerRef.current.replaceChildren();
        const scales: { scale: number; height: number }[] = [];

        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          if (cancelled) return;
          const viewport = page.getViewport({ scale: 1.5 });

          const wrapper = document.createElement("div");
          wrapper.dataset.page = String(i - 1);
          wrapper.style.position = "relative";
          wrapper.style.marginBottom = "16px";
          wrapper.style.width = `${viewport.width}px`;
          wrapper.style.height = `${viewport.height}px`;
          wrapper.style.boxShadow = "0 2px 10px rgba(0,0,0,0.4)";

          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.display = "block";
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("2D canvas not available");
          await page.render({ canvasContext: ctx, viewport, canvas }).promise;

          wrapper.appendChild(canvas);
          containerRef.current.appendChild(wrapper);
          scales.push({ scale: 1.5, height: viewport.height });
        }

        setPageScales(scales);
      } catch (err) {
        setRenderError(err instanceof Error ? err.message : String(err));
      }
    }
    render();
    return () => {
      cancelled = true;
    };
  }, [fileUrl]);

  // Drag-to-select a bbox over the rendered page.
  function onMouseDown(e: React.MouseEvent) {
    const target = e.target as HTMLElement;
    const wrapper = target.closest<HTMLElement>("[data-page]");
    if (!wrapper) return;
    const page = Number(wrapper.dataset.page);
    const rect = wrapper.getBoundingClientRect();
    setDrag({
      active: true,
      page,
      startX: e.clientX - rect.left,
      startY: e.clientY - rect.top,
      endX: e.clientX - rect.left,
      endY: e.clientY - rect.top,
    });
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!drag?.active) return;
    const wrapper = containerRef.current?.querySelector<HTMLElement>(`[data-page="${drag.page}"]`);
    if (!wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    setDrag({ ...drag, endX: e.clientX - rect.left, endY: e.clientY - rect.top });
  }
  function onMouseUp() {
    if (!drag?.active) return;
    const minX = Math.min(drag.startX, drag.endX);
    const maxX = Math.max(drag.startX, drag.endX);
    const minY = Math.min(drag.startY, drag.endY);
    const maxY = Math.max(drag.startY, drag.endY);
    const width = maxX - minX;
    const height = maxY - minY;
    if (width < 4 || height < 4) {
      setDrag(null);
      return;
    }
    const scale = pageScales[drag.page]?.scale ?? 1.5;
    const pageHeight = pageScales[drag.page]?.height ?? 1000;
    // PDF coordinate system has origin at bottom-left, but canvas at top-left.
    // Convert canvas coords → PDF coords.
    const pdfBox = {
      page: drag.page,
      x: minX / scale,
      y: (pageHeight - maxY) / scale,
      width: width / scale,
      height: height / scale,
    };
    setPendingBox({
      page: drag.page,
      pdfBox,
      selectedText: `[Page ${drag.page + 1} bbox ${Math.round(pdfBox.width)}×${Math.round(pdfBox.height)}]`,
    });
    setDrag(null);
  }

  function addBinding(b: Binding) {
    setBindings((prev) => [...prev, b]);
    setPendingBox(null);
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

  // Render the drag rectangle overlay.
  const dragOverlay =
    drag && drag.active ? (
      <DragOverlay drag={drag} container={containerRef.current} />
    ) : null;

  return (
    <div className="grid grid-cols-[1fr_360px] gap-4 px-8 py-6 h-[calc(100vh-9rem)]">
      <div className="border border-[var(--color-border)] rounded-md overflow-auto bg-[var(--color-bg-elevated)] relative">
        {renderError ? (
          <div className="p-6 text-[var(--color-danger)] text-sm">Could not render: {renderError}</div>
        ) : (
          <div
            ref={containerRef}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={() => setDrag(null)}
            className="p-6 flex flex-col items-center select-none cursor-crosshair"
          />
        )}
        {dragOverlay}
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

        {pendingBox ? (
          <FieldPicker
            selectedText={pendingBox.selectedText}
            pdfBox={pendingBox.pdfBox}
            onAdd={addBinding}
            onCancel={() => setPendingBox(null)}
          />
        ) : (
          <div className="text-xs text-[var(--color-text-faint)] border border-dashed border-[var(--color-border)] rounded-md p-3">
            Click and drag over a value on the PDF to bind it. We'll cover the original area with a white
            box and stamp the CRM value in its place when you generate a document.
          </div>
        )}

        <BindingsList bindings={bindings} onRemove={removeBinding} />
      </div>
    </div>
  );
}

function DragOverlay({ drag, container }: { drag: DragState; container: HTMLDivElement | null }) {
  if (!container) return null;
  const wrapper = container.querySelector<HTMLElement>(`[data-page="${drag.page}"]`);
  if (!wrapper) return null;
  const minX = Math.min(drag.startX, drag.endX);
  const maxX = Math.max(drag.startX, drag.endX);
  const minY = Math.min(drag.startY, drag.endY);
  const maxY = Math.max(drag.startY, drag.endY);
  const wrapperRect = wrapper.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  const left = wrapperRect.left - containerRect.left + minX + container.scrollLeft;
  const top = wrapperRect.top - containerRect.top + minY + container.scrollTop;
  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
        width: maxX - minX,
        height: maxY - minY,
        border: "2px solid var(--color-accent-solid)",
        background: "color-mix(in srgb, var(--color-accent-solid) 18%, transparent)",
        pointerEvents: "none",
        zIndex: 50,
      }}
    />
  );
}
