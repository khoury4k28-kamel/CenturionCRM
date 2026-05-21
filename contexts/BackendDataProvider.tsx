"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import DataContext, {
  type DataContextType,
  type DealCreateInput,
  type DealUpdateInput,
  type ContactCreateInput,
  type ContactUpdateInput,
  type TaskCreateInput,
  type TaskUpdateInput,
  type TemplateCreateInput,
  type TemplateUpdateInput,
} from "./DataContext";
import { apiCall } from "@/lib/api-client";
import type {
  FullState,
  DealDTO,
  ContactDTO,
  TaskDTO,
  TemplateDTO,
  DocumentDTO,
} from "@/lib/dto";
import type { DealStage, SpreadField, DocStatus } from "@/lib/types";

// ── Undo stack ──────────────────────────────────────────────────────────
// Per Mālama parity, undo is limited to a single entity type (tasks for
// Centurion — the SpreadStore handles deal-level undo separately).

interface UndoEntry {
  type: "task";
  id: string;
  previousState: Partial<TaskDTO>;
  label: string;
}
const UNDO_LIMIT = 20;

// ── Provider ────────────────────────────────────────────────────────────

export function BackendDataProvider({ children }: { children: ReactNode }) {
  const [deals, setDeals] = useState<DealDTO[]>([]);
  const [contacts, setContacts] = useState<ContactDTO[]>([]);
  const [tasks, setTasks] = useState<TaskDTO[]>([]);
  const [templates, setTemplates] = useState<TemplateDTO[]>([]);
  const [documents, setDocuments] = useState<DocumentDTO[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Undo stack lives in a ref so callbacks can read the latest stack without
  // closing over stale state. `canUndoState` mirrors the stack length so render
  // can derive `canUndo` without reading the ref during render.
  const undoStackRef = useRef<UndoEntry[]>([]);
  const [canUndoState, setCanUndoState] = useState(false);
  const syncCanUndo = useCallback(() => {
    setCanUndoState(undoStackRef.current.length > 0);
  }, []);

  // ── Initial load ───────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    const result = await apiCall<FullState>("/sync/pull");
    if (result.ok && result.data) {
      setDeals(result.data.deals);
      setContacts(result.data.contacts);
      setTasks(result.data.tasks);
      setTemplates(result.data.templates);
      setDocuments(result.data.documents);
    } else {
      console.error("Failed to load backend state:", result.error);
      toast.error(`Failed to load data: ${result.error ?? "unknown"}`);
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    // Initial fetch — runs once on mount. The eslint set-state-in-effect rule
    // is targeted at synchronization patterns where setState is the wrong tool;
    // for a one-shot initial load there isn't a cleaner alternative.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAll();
  }, [loadAll]);

  const refresh = useCallback(async () => {
    await loadAll();
  }, [loadAll]);

  // ── Generic API helper with toast on failure ───────────────────────
  const apiWithToast = useCallback(
    async (
      path: string,
      opts: RequestInit,
      errorLabel: string,
      rollback?: () => void,
    ): Promise<boolean> => {
      const result = await apiCall(path, opts);
      if (!result.ok) {
        toast.error(`${errorLabel}: ${result.error ?? "unknown error"}`);
        rollback?.();
        return false;
      }
      return true;
    },
    [],
  );

  // ── DEALS ──────────────────────────────────────────────────────────
  // The SpreadStore owns field-level optimistic updates for the spreadsheet.
  // The provider's role for deals is: hold the canonical list, handle
  // create/delete, and provide spread-cell endpoints that keep deals[] in
  // sync after the SpreadStore commits.

  const addDeal = useCallback(
    async (input: DealCreateInput): Promise<string | null> => {
      const result = await apiCall<DealDTO>("/deals", {
        method: "POST",
        body: JSON.stringify(input),
      });
      if (!result.ok || !result.data) {
        toast.error(`Failed to create deal: ${result.error ?? "unknown"}`);
        return null;
      }
      // Refresh to pick up the full DTO shape (server has computed fields).
      await loadAll();
      return result.data.id;
    },
    [loadAll],
  );

  const updateDeal = useCallback(
    async (id: string, input: DealUpdateInput): Promise<boolean> => {
      // Capture prior for rollback. We don't optimistically apply the update
      // because DealUpdateInput is partial-of-partials and reconstructing the
      // DTO shape is fiddly — caller pages do their own form-state updates.
      const ok = await apiWithToast(
        `/deals/${id}`,
        { method: "PATCH", body: JSON.stringify({ kind: "update", ...input }) },
        "Failed to update deal",
      );
      if (ok) await loadAll();
      return ok;
    },
    [apiWithToast, loadAll],
  );

  const moveDealStage = useCallback(
    async (id: string, stage: DealStage): Promise<boolean> => {
      const prev = deals.find((d) => d.id === id);
      setDeals((cur) => cur.map((d) => (d.id === id ? { ...d, stage } : d)));
      return apiWithToast(
        `/deals/${id}`,
        { method: "PATCH", body: JSON.stringify({ kind: "stage", stage }) },
        "Failed to change stage",
        () => {
          if (prev) setDeals((cur) => cur.map((d) => (d.id === id ? prev : d)));
        },
      );
    },
    [deals, apiWithToast],
  );

  const deleteDeal = useCallback(
    async (id: string): Promise<boolean> => {
      const prev = deals;
      setDeals((cur) => cur.filter((d) => d.id !== id));
      // Cascading-deletes on the server take care of related tasks/documents;
      // refresh to pull them out of local state too.
      const ok = await apiWithToast(
        `/deals/${id}`,
        { method: "DELETE" },
        "Failed to delete deal",
        () => setDeals(prev),
      );
      if (ok) await loadAll();
      return ok;
    },
    [deals, apiWithToast, loadAll],
  );

  // Spread-cell endpoints: SpreadStore stays the source of truth for the
  // spreadsheet's optimistic view, but call these so deals[] in the provider
  // also reflects the change (otherwise navigating to /dashboard shows stale data).

  const updateSpreadField = useCallback(
    async (id: string, field: SpreadField, value: string | number | null): Promise<boolean> => {
      const prev = deals.find((d) => d.id === id);
      // Mirror the server's coercion rules so deals[] matches what the
      // spreadsheet just optimistically applied. The exhaustive switch
      // matches lib/server/deals.ts → updateSpreadField.
      setDeals((cur) =>
        cur.map((d) => {
          if (d.id !== id) return d;
          const next = { ...d };
          switch (field) {
            case "address":
            case "city":
            case "state":
            case "zip":
              next.property = { ...d.property, [field]: value === "" ? null : (value as string) };
              break;
            case "agreedPrice":
            case "listPrice":
            case "amountOwed": {
              const n = value === null || value === "" ? null : Number(value);
              next[field] = n !== null && Number.isFinite(n) ? n : null;
              break;
            }
            case "acceptanceDate":
            case "expirationDate":
              next[field] = value === null || value === "" ? null : String(value);
              break;
            case "stage":
              next.stage = value as DealStage;
              break;
            case "termOfAgreement":
            case "notes":
              next[field] = value === null ? null : String(value);
              break;
          }
          return next;
        }),
      );
      return apiWithToast(
        `/deals/${id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ kind: "spread-cell", field, value }),
        },
        `Failed to save ${field}`,
        () => {
          if (prev) setDeals((cur) => cur.map((d) => (d.id === id ? prev : d)));
        },
      );
    },
    [deals, apiWithToast],
  );

  const setDealFlag = useCallback(
    async (id: string, flagged: boolean): Promise<boolean> => {
      const prev = deals.find((d) => d.id === id);
      setDeals((cur) => cur.map((d) => (d.id === id ? { ...d, flaggedForReview: flagged } : d)));
      return apiWithToast(
        `/deals/${id}`,
        { method: "PATCH", body: JSON.stringify({ kind: "setFlag", flagged }) },
        "Failed to toggle flag",
        () => {
          if (prev) setDeals((cur) => cur.map((d) => (d.id === id ? prev : d)));
        },
      );
    },
    [deals, apiWithToast],
  );

  const setDealWeOwn = useCallback(
    async (id: string, weOwn: boolean): Promise<boolean> => {
      const prev = deals.find((d) => d.id === id);
      setDeals((cur) =>
        cur.map((d) =>
          d.id === id ? { ...d, weOwn, amountOwed: weOwn ? null : d.amountOwed } : d,
        ),
      );
      return apiWithToast(
        `/deals/${id}`,
        { method: "PATCH", body: JSON.stringify({ kind: "weOwn", value: weOwn }) },
        "Failed to update 'we own'",
        () => {
          if (prev) setDeals((cur) => cur.map((d) => (d.id === id ? prev : d)));
        },
      );
    },
    [deals, apiWithToast],
  );

  const setDealOwed = useCallback(
    async (id: string, raw: string): Promise<boolean> => {
      const prev = deals.find((d) => d.id === id);
      // Mirror the server's parser locally so optimistic state matches.
      const s = raw.trim().toLowerCase();
      let amountOwed: number | null = null;
      let weOwn = false;
      if (s === "" || s === "0" || s === "-0-" || s === "-") {
        // nothing — both null/false
      } else if (s.includes("own")) {
        weOwn = true;
      } else {
        const n = Number(s.replace(/[^\d.-]/g, ""));
        if (Number.isFinite(n)) amountOwed = n;
      }
      setDeals((cur) =>
        cur.map((d) => (d.id === id ? { ...d, amountOwed, weOwn } : d)),
      );
      return apiWithToast(
        `/deals/${id}`,
        { method: "PATCH", body: JSON.stringify({ kind: "owed", raw }) },
        "Failed to save owed",
        () => {
          if (prev) setDeals((cur) => cur.map((d) => (d.id === id ? prev : d)));
        },
      );
    },
    [deals, apiWithToast],
  );

  const updateDealAddress = useCallback(
    async (
      id: string,
      fields: { address?: string; city?: string | null; state?: string | null; zip?: string | null },
    ): Promise<boolean> => {
      const prev = deals.find((d) => d.id === id);
      setDeals((cur) =>
        cur.map((d) =>
          d.id === id
            ? {
                ...d,
                property: {
                  ...d.property,
                  ...(fields.address !== undefined ? { address: fields.address } : {}),
                  ...(fields.city !== undefined ? { city: fields.city } : {}),
                  ...(fields.state !== undefined ? { state: fields.state } : {}),
                  ...(fields.zip !== undefined ? { zip: fields.zip } : {}),
                },
              }
            : d,
        ),
      );
      return apiWithToast(
        `/deals/${id}`,
        { method: "PATCH", body: JSON.stringify({ kind: "address", ...fields }) },
        "Failed to save address",
        () => {
          if (prev) setDeals((cur) => cur.map((d) => (d.id === id ? prev : d)));
        },
      );
    },
    [deals, apiWithToast],
  );

  // ── CONTACTS ───────────────────────────────────────────────────────

  const addContact = useCallback(
    async (input: ContactCreateInput): Promise<string | null> => {
      // Server returns a raw Prisma row whose Decimal/Date fields don't match
      // the DTO shape. Re-pull the full state instead of trying to merge — cost
      // is one extra request, savings is shape-consistency across the store.
      const result = await apiCall<{ id: string }>("/contacts", {
        method: "POST",
        body: JSON.stringify(input),
      });
      if (!result.ok || !result.data) {
        toast.error(`Failed to create contact: ${result.error ?? "unknown"}`);
        return null;
      }
      await loadAll();
      return result.data.id;
    },
    [loadAll],
  );

  const updateContact = useCallback(
    async (id: string, input: ContactUpdateInput): Promise<boolean> => {
      const prev = contacts.find((c) => c.id === id);
      setContacts((cur) =>
        cur.map((c) =>
          c.id === id ? { ...c, ...input, updatedAt: new Date().toISOString() } : c,
        ),
      );
      return apiWithToast(
        `/contacts/${id}`,
        { method: "PATCH", body: JSON.stringify(input) },
        "Failed to update contact",
        () => {
          if (prev) setContacts((cur) => cur.map((c) => (c.id === id ? prev : c)));
        },
      );
    },
    [contacts, apiWithToast],
  );

  const deleteContact = useCallback(
    async (id: string): Promise<boolean> => {
      const prev = contacts;
      setContacts((cur) => cur.filter((c) => c.id !== id));
      return apiWithToast(
        `/contacts/${id}`,
        { method: "DELETE" },
        "Failed to delete contact",
        () => setContacts(prev),
      );
    },
    [contacts, apiWithToast],
  );

  // ── TASKS ──────────────────────────────────────────────────────────

  const addTask = useCallback(
    async (input: TaskCreateInput): Promise<string | null> => {
      const result = await apiCall<{ id: string }>("/tasks", {
        method: "POST",
        body: JSON.stringify(input),
      });
      if (!result.ok || !result.data) {
        toast.error(`Failed to create task: ${result.error ?? "unknown"}`);
        return null;
      }
      await loadAll();
      return result.data.id;
    },
    [loadAll],
  );

  const pushTaskUndo = useCallback((entry: UndoEntry) => {
    undoStackRef.current = [...undoStackRef.current, entry].slice(-UNDO_LIMIT);
    syncCanUndo();
  }, [syncCanUndo]);

  const updateTask = useCallback(
    async (id: string, input: TaskUpdateInput): Promise<boolean> => {
      const prev = tasks.find((t) => t.id === id);
      if (prev) {
        const previousState: Partial<TaskDTO> = {};
        for (const k of Object.keys(input) as (keyof TaskUpdateInput)[]) {
          // capture the prior value for each key we're about to overwrite
          (previousState as Record<string, unknown>)[k] = (prev as unknown as Record<string, unknown>)[k];
        }
        pushTaskUndo({ type: "task", id, previousState, label: `Updated "${prev.title}"` });
      }
      setTasks((cur) =>
        cur.map((t) =>
          t.id === id ? { ...t, ...input, updatedAt: new Date().toISOString() } : t,
        ),
      );
      return apiWithToast(
        `/tasks/${id}`,
        { method: "PATCH", body: JSON.stringify(input) },
        "Failed to update task",
        () => {
          if (prev) setTasks((cur) => cur.map((t) => (t.id === id ? prev : t)));
        },
      );
    },
    [tasks, apiWithToast, pushTaskUndo],
  );

  const deleteTask = useCallback(
    async (id: string): Promise<boolean> => {
      const prev = tasks;
      setTasks((cur) => cur.filter((t) => t.id !== id));
      return apiWithToast(
        `/tasks/${id}`,
        { method: "DELETE" },
        "Failed to delete task",
        () => setTasks(prev),
      );
    },
    [tasks, apiWithToast],
  );

  // ── TEMPLATES ──────────────────────────────────────────────────────

  const addTemplate = useCallback(
    async (input: TemplateCreateInput): Promise<string | null> => {
      // Multipart upload bypasses the JSON apiCall helper. Goes to the
      // existing /api/templates route — uploadTemplate() server fn writes the
      // file to public/uploads/ and returns the Prisma row.
      const fd = new FormData();
      fd.set("name", input.name);
      if (input.description) fd.set("description", input.description);
      fd.set("file", input.file);
      try {
        const res = await fetch("/api/templates", { method: "POST", body: fd });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          toast.error(body.error ?? `Upload failed (${res.status})`);
          return null;
        }
        const created = (await res.json()) as { id: string };
        await loadAll();
        return created.id;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Upload failed");
        return null;
      }
    },
    [loadAll],
  );

  const updateTemplate = useCallback(
    async (id: string, input: TemplateUpdateInput): Promise<boolean> => {
      const prev = templates.find((t) => t.id === id);
      setTemplates((cur) =>
        cur.map((t) =>
          t.id === id ? { ...t, ...(input as Partial<TemplateDTO>), updatedAt: new Date().toISOString() } : t,
        ),
      );
      return apiWithToast(
        `/templates/${id}`,
        { method: "PATCH", body: JSON.stringify(input) },
        "Failed to update template",
        () => {
          if (prev) setTemplates((cur) => cur.map((t) => (t.id === id ? prev : t)));
        },
      );
    },
    [templates, apiWithToast],
  );

  const deleteTemplate = useCallback(
    async (id: string): Promise<boolean> => {
      const prev = templates;
      setTemplates((cur) => cur.filter((t) => t.id !== id));
      return apiWithToast(
        `/templates/${id}`,
        { method: "DELETE" },
        "Failed to delete template",
        () => setTemplates(prev),
      );
    },
    [templates, apiWithToast],
  );

  // ── DOCUMENTS ──────────────────────────────────────────────────────

  const generateDocument = useCallback(
    async (dealId: string, templateId: string): Promise<boolean> => {
      const result = await apiCall<{ id: string }>("/documents/generate", {
        method: "POST",
        body: JSON.stringify({ dealId, templateId }),
      });
      if (!result.ok || !result.data) {
        toast.error(`Failed to generate document: ${result.error ?? "unknown"}`);
        return false;
      }
      await loadAll();
      return true;
    },
    [loadAll],
  );

  const setDocumentStatus = useCallback(
    async (id: string, status: DocStatus): Promise<boolean> => {
      const prev = documents.find((d) => d.id === id);
      setDocuments((cur) =>
        cur.map((d) =>
          d.id === id ? { ...d, status, updatedAt: new Date().toISOString() } : d,
        ),
      );
      return apiWithToast(
        `/documents/${id}`,
        { method: "PATCH", body: JSON.stringify({ status }) },
        "Failed to update document status",
        () => {
          if (prev) setDocuments((cur) => cur.map((d) => (d.id === id ? prev : d)));
        },
      );
    },
    [documents, apiWithToast],
  );

  // ── UNDO ───────────────────────────────────────────────────────────

  const undo = useCallback(() => {
    const stack = undoStackRef.current;
    if (stack.length === 0) return;
    const entry = stack[stack.length - 1];
    undoStackRef.current = stack.slice(0, -1);
    syncCanUndo();

    // Apply optimistically, then call API. No nested undo entry is pushed —
    // an undo of an undo would just push state back where it started, so we
    // intentionally make undo a one-way pop.
    setTasks((cur) =>
      cur.map((t) =>
        t.id === entry.id
          ? { ...t, ...entry.previousState, updatedAt: new Date().toISOString() }
          : t,
      ),
    );
    void apiCall(`/tasks/${entry.id}`, {
      method: "PATCH",
      body: JSON.stringify(entry.previousState),
    }).then((r) => {
      if (!r.ok) toast.error(`Undo failed: ${r.error ?? "unknown"}`);
    });
    toast.success(`Undone: ${entry.label}`);
  }, [syncCanUndo]);

  // Global ⌘Z / Ctrl+Z handler. Skips when focus is in an input/textarea/
  // contenteditable so the browser's native undo still works there.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;
        if (undoStackRef.current.length === 0) return;
        e.preventDefault();
        undo();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [undo]);

  const canUndo = canUndoState;

  const value: DataContextType = {
    isLoaded,
    refresh,
    deals,
    addDeal,
    updateDeal,
    moveDealStage,
    deleteDeal,
    updateSpreadField,
    setDealFlag,
    setDealWeOwn,
    setDealOwed,
    updateDealAddress,
    contacts,
    addContact,
    updateContact,
    deleteContact,
    tasks,
    addTask,
    updateTask,
    deleteTask,
    templates,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    documents,
    generateDocument,
    setDocumentStatus,
    // Team/access fields — local Prisma mode is effectively single-user, so
    // these are inert. AuthGate isn't mounted in local mode either (see
    // DataProvider.tsx) so the dock/manager UI never appears.
    teamMembers: [],
    connectedEmails: [],
    allowedEmails: [],
    ensureTeamMember: () => {},
    removeTeamMember: () => {},
    addAllowedEmail: () => {},
    removeAllowedEmail: () => {},
    assignTask: () => {},
    unassignTask: () => {},
    // Activity log is hosted-mode only — the rail itself is gated on
    // isLiveblocksEnabled so it never mounts in local dev.
    activities: [],
    undo,
    canUndo,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
