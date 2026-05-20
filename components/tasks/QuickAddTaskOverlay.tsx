"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogBody, DialogHeader } from "@/components/ui/dialog";
import { TaskQuickAddForm } from "./TaskQuickAddForm";

// Cmd/Ctrl+Shift+T global quick-add. Cmd+T (sans Shift) is reserved by the
// browser for "new tab"; Cmd+Shift+T normally reopens the last closed tab,
// but we preventDefault to claim it for in-app capture. If you find yourself
// needing the browser's reopen-tab, the menu shortcut still works.
const SHORTCUT_KEY = "t";

export function QuickAddTaskOverlay() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Cmd/Ctrl + Shift + T
      if (!(e.metaKey || e.ctrlKey) || !e.shiftKey) return;
      if (e.key.toLowerCase() !== SHORTCUT_KEY) return;

      // Don't fire while typing in inputs/textareas/contenteditable. Mirrors
      // the guard used by SpreadStore's Cmd-Z handler.
      const target = e.target as HTMLElement | null;
      const isTyping =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (isTyping) return;

      e.preventDefault();
      setOpen(true);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen} panelClassName="max-w-xl">
      <DialogHeader
        title="Quick-add task"
        description="Press ⌘⇧T from anywhere to open this. Esc to dismiss."
      />
      <DialogBody>
        <TaskQuickAddForm autoFocus onAdded={() => setOpen(false)} />
      </DialogBody>
    </Dialog>
  );
}
