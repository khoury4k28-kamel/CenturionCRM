"use client";

// Liveblocks-backed implementation of DataContextType. Mounted in production
// (static export to GitHub Pages) when NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY is
// set. Mirrors the shape of BackendDataProvider so consuming components don't
// need to know which mode is active.
//
// Storage shape (per createInitialStorage in lib/liveblocks.config.ts):
//   deals, contacts, tasks, templates, documents : LiveList<LiveObject<DTO>>
//
// Conventions:
//  - Each top-level entity is a LiveObject so field updates don't race.
//  - Nested objects (Deal.property) stay plain — replaced wholesale on edit.
//  - Mutations coerce inputs the same way lib/server/* does, so the resulting
//    DTOs match what /api/sync/pull would have returned locally.
//  - generateDocument is a stub here; real client-side doc generation lands
//    in Phase 2e.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { LiveList, LiveObject } from "@liveblocks/client";
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
  type EnsureTeamMemberInput,
} from "./DataContext";
import {
  RoomProvider,
  useLbStorage,
  useLbMutation,
  useLbOthers,
  useLbUpdateMyPresence,
  createInitialStorage,
  LIVEBLOCKS_ROOM_ID,
} from "@/lib/liveblocks.config";
import {
  DEAL_STAGES,
  type DealStage,
  type SpreadField,
  type DocStatus,
  type Binding,
  type TemplateFormat,
  type TeamMember,
} from "@/lib/types";
import { useAuth } from "./AuthContext";
import { getRandomColor } from "@/lib/colors";
import type {
  DealDTO,
  ContactDTO,
  TaskDTO,
  TemplateDTO,
  DocumentDTO,
  PropertyDTO,
} from "@/lib/dto";
import {
  tokenizeDocxClient,
  fillDocxClient,
} from "@/lib/template-engine/client/docx";
import { fillPdfClient } from "@/lib/template-engine/client/pdf";
import {
  fileToUint8,
  urlToUint8,
  uint8ToDataUrl,
  downloadBytes,
  detectFormatFromName,
  mimeForFormat,
  MIME_DOCX,
  MIME_PDF,
} from "@/lib/template-engine/client/bytes";
import type { DealWithRelations } from "@/lib/template-engine/fields";

// ── Helpers ────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const liveObj = <T,>(data: T) => new LiveObject(data as any);

function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function nowIso(): string {
  return new Date().toISOString();
}

function nz(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}

function nzNumber(v: unknown): number | null {
  const s = nz(v);
  if (s === null) return null;
  const n = Number(s.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

// Walk a LiveList looking for the LiveObject whose 'id' field matches. Returns
// the index, or -1. Centurion's lists are O(few hundred) at most so linear is
// fine and avoids needing a side-index.
//
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findIndexById(list: any, id: string): number {
  for (let i = 0; i < list.length; i++) {
    const obj = list.get(i);
    if (obj?.get?.("id") === id) return i;
  }
  return -1;
}

// ── Undo stack (tasks only, matches BackendDataProvider) ───────────────

interface UndoEntry {
  type: "task";
  id: string;
  previousState: Partial<TaskDTO>;
  label: string;
}
const UNDO_LIMIT = 20;

// ── Inner provider — runs inside RoomProvider, so Liveblocks hooks work ─

function LiveblocksDataProviderInner({ children }: { children: ReactNode }) {
  // Reads. useStorage returns null while the room hydrates (no selector run);
  // once hydrated, the selector runs and our `?? []` guards a missing list.
  // We coerce the outer null to [] so consumers can spread/iterate safely
  // before isLoaded flips true — many list pages run a useMemo over the list
  // ahead of their loading check.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dealsRawRaw = useLbStorage((root: any) =>
    root.deals?.toImmutable?.() ?? [],
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contactsRaw = useLbStorage((root: any) =>
    root.contacts?.toImmutable?.() ?? [],
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tasksRaw = useLbStorage((root: any) =>
    root.tasks?.toImmutable?.() ?? [],
  );
  const templatesRawNullable = useLbStorage(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (root: any) => root.templates?.toImmutable?.() ?? [],
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const documentsRaw = useLbStorage((root: any) =>
    root.documents?.toImmutable?.() ?? [],
  );

  // isLoaded flips true once any selector has returned (storage hydrated).
  // We piggyback on dealsRawRaw — root.deals is seeded by createInitialStorage.
  const isLoaded = dealsRawRaw !== null && dealsRawRaw !== undefined;

  // Normalize null → [] so pages can iterate without first checking isLoaded.
  // useMemo wraps prevent the `?? []` from minting a fresh empty array each
  // render — which would otherwise invalidate downstream useMemo/useCallback
  // deps that reference these lists.
  const dealsRaw: DealDTO[] = useMemo(
    () => (dealsRawRaw ?? []) as DealDTO[],
    [dealsRawRaw],
  );
  const contacts: ContactDTO[] = useMemo(
    () => (contactsRaw ?? []) as ContactDTO[],
    [contactsRaw],
  );
  const tasks: TaskDTO[] = useMemo(
    () => (tasksRaw ?? []) as TaskDTO[],
    [tasksRaw],
  );
  const templatesRaw: Omit<TemplateDTO, "documentCount">[] = useMemo(
    () =>
      (templatesRawNullable ?? []) as Omit<TemplateDTO, "documentCount">[],
    [templatesRawNullable],
  );
  const documents: DocumentDTO[] = useMemo(
    () => (documentsRaw ?? []) as DocumentDTO[],
    [documentsRaw],
  );

  // Templates with derived documentCount. Recomputes whenever either list
  // changes — both come from useLbStorage and are referentially stable across
  // unrelated renders, so this is cheap.
  const templates: TemplateDTO[] = useMemo(
    () =>
      (templatesRaw ?? []).map((t) => ({
        ...t,
        documentCount: (documents ?? []).filter((d) => d.templateId === t.id)
          .length,
      })) as TemplateDTO[],
    [templatesRaw, documents],
  );

  // Use deals as-is — TemplateDTO-style derivation isn't needed.
  const deals = dealsRaw ?? [];

  // ── TEAM / PRESENCE STATE ─────────────────────────────────────────
  // teamMembers = persistent roster (Liveblocks storage)
  // allowedEmails = invite list editable by owner
  // connectedEmails = live presence (who's connected right now)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const teamMembersRaw = useLbStorage((root: any) =>
    root.teamMembers?.toImmutable?.() ?? [],
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allowedEmailsRaw = useLbStorage((root: any) =>
    root.allowedEmails?.toImmutable?.() ?? [],
  );
  const teamMembers: TeamMember[] = useMemo(
    () => (teamMembersRaw ?? []) as TeamMember[],
    [teamMembersRaw],
  );
  const allowedEmails: string[] = useMemo(
    () => (allowedEmailsRaw ?? []) as string[],
    [allowedEmailsRaw],
  );

  const others = useLbOthers();
  const { user: authUser } = useAuth();
  const updatePresence = useLbUpdateMyPresence();

  // My color: pulled from my TeamMember row (assigned on first sign-in) so
  // the dock and presence agree. Falls back to a palette pick before the row
  // hydrates.
  const fallbackColorRef = useRef<string>(getRandomColor());
  const myColor = useMemo(() => {
    if (!authUser) return fallbackColorRef.current;
    const me = teamMembers.find(
      (m) => m.email.toLowerCase() === authUser.email.toLowerCase(),
    );
    return me?.color ?? fallbackColorRef.current;
  }, [authUser, teamMembers]);

  // Broadcast my identity to other clients in the room.
  useEffect(() => {
    if (!authUser) return;
    updatePresence({
      name: authUser.name,
      color: myColor,
      email: authUser.email.toLowerCase(),
    });
  }, [authUser, myColor, updatePresence]);

  // Derive "who's online" — other clients' presence emails + self if signed in.
  const connectedEmails: string[] = useMemo(() => {
    const set = new Set<string>();
    for (const o of others as Array<{ presence?: { email?: string } }>) {
      const e = o.presence?.email?.toLowerCase();
      if (e) set.add(e);
    }
    if (authUser) set.add(authUser.email.toLowerCase());
    return Array.from(set);
  }, [others, authUser]);

  // Undo state — local React, not shared. ⌘Z is a single-user concept.
  const undoStackRef = useRef<UndoEntry[]>([]);
  const [canUndoState, setCanUndoState] = useState(false);
  const syncCanUndo = useCallback(() => {
    setCanUndoState(undoStackRef.current.length > 0);
  }, []);

  // ── Refresh ───────────────────────────────────────────────────────
  // No-op in Liveblocks mode — storage is always live. Kept to satisfy the
  // interface so callers that call refresh() after non-provider ops still work.
  const refresh = useCallback(async () => {
    // intentionally empty
  }, []);

  // ── DEALS ─────────────────────────────────────────────────────────

  const addDealMut = useLbMutation(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ({ storage }: any, deal: DealDTO) => {
      storage.get("deals").push(liveObj(deal));
    },
    [],
  ) as (deal: DealDTO) => void;

  const addDeal = useCallback(
    async (input: DealCreateInput): Promise<string | null> => {
      const address = nz(input.address);
      if (!address) {
        toast.error("Address required");
        return null;
      }
      const id = uid();
      const property: PropertyDTO = {
        id: uid(),
        address,
        city: nz(input.city),
        state: nz(input.state),
        zip: nz(input.zip),
        bedrooms: nzNumber(input.bedrooms),
        bathrooms: nzNumber(input.bathrooms),
        sqft: nzNumber(input.sqft),
        lotSize: nzNumber(input.lotSize),
        yearBuilt: nzNumber(input.yearBuilt),
        apn: null,
      };
      const now = nowIso();
      const deal: DealDTO = {
        id,
        stage: "NEW_LEAD",
        property,
        sellerId: null,
        realtorId: null,
        askingPrice: nzNumber(input.askingPrice),
        ourOffer: nzNumber(input.ourOffer),
        agreedPrice: null,
        listPrice: null,
        acceptanceDate: null,
        expirationDate: null,
        termOfAgreement: null,
        amountOwed: null,
        weOwn: false,
        flaggedForReview: false,
        agreementType: null,
        source: nz(input.source),
        notes: nz(input.notes),
        createdAt: now,
        updatedAt: now,
      };
      addDealMut(deal);
      return id;
    },
    [addDealMut],
  );

  const updateDealMut = useLbMutation(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ({ storage }: any, id: string, input: DealUpdateInput) => {
      const list = storage.get("deals");
      const i = findIndexById(list, id);
      if (i < 0) return;
      const deal = list.get(i);
      const fields = input.fields ?? {};
      const patch: Partial<DealDTO> = { updatedAt: nowIso() };
      if (fields.stage !== undefined && fields.stage !== null) {
        if (DEAL_STAGES.includes(fields.stage as DealStage)) {
          patch.stage = fields.stage as DealStage;
        }
      }
      if (fields.askingPrice !== undefined) patch.askingPrice = nzNumber(fields.askingPrice);
      if (fields.ourOffer !== undefined) patch.ourOffer = nzNumber(fields.ourOffer);
      if (fields.agreedPrice !== undefined) patch.agreedPrice = nzNumber(fields.agreedPrice);
      if (fields.agreementType !== undefined) patch.agreementType = nz(fields.agreementType);
      if (fields.source !== undefined) patch.source = nz(fields.source);
      if (fields.notes !== undefined) patch.notes = nz(fields.notes);
      if (fields.sellerId !== undefined) patch.sellerId = nz(fields.sellerId);
      if (fields.realtorId !== undefined) patch.realtorId = nz(fields.realtorId);
      deal.update(patch);

      const p = input.property;
      if (p?.id) {
        const cur = deal.get("property") as PropertyDTO;
        const next: PropertyDTO = { ...cur };
        if (p.address !== undefined) {
          const a = nz(p.address);
          if (a !== null) next.address = a;
        }
        if (p.city !== undefined) next.city = nz(p.city);
        if (p.state !== undefined) next.state = nz(p.state);
        if (p.zip !== undefined) next.zip = nz(p.zip);
        if (p.bedrooms !== undefined) next.bedrooms = nzNumber(p.bedrooms);
        if (p.bathrooms !== undefined) next.bathrooms = nzNumber(p.bathrooms);
        if (p.sqft !== undefined) next.sqft = nzNumber(p.sqft);
        if (p.lotSize !== undefined) next.lotSize = nzNumber(p.lotSize);
        if (p.yearBuilt !== undefined) next.yearBuilt = nzNumber(p.yearBuilt);
        if (p.apn !== undefined) next.apn = nz(p.apn);
        deal.set("property", next);
      }
    },
    [],
  ) as (id: string, input: DealUpdateInput) => void;

  const updateDeal = useCallback(
    async (id: string, input: DealUpdateInput): Promise<boolean> => {
      updateDealMut(id, input);
      return true;
    },
    [updateDealMut],
  );

  const moveDealStageMut = useLbMutation(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ({ storage }: any, id: string, stage: DealStage) => {
      const list = storage.get("deals");
      const i = findIndexById(list, id);
      if (i < 0) return;
      list.get(i).update({ stage, updatedAt: nowIso() });
    },
    [],
  ) as (id: string, stage: DealStage) => void;

  const moveDealStage = useCallback(
    async (id: string, stage: DealStage): Promise<boolean> => {
      if (!DEAL_STAGES.includes(stage)) {
        toast.error(`Invalid stage: ${stage}`);
        return false;
      }
      moveDealStageMut(id, stage);
      return true;
    },
    [moveDealStageMut],
  );

  const deleteDealMut = useLbMutation(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ({ storage }: any, id: string) => {
      const deals = storage.get("deals");
      const di = findIndexById(deals, id);
      if (di >= 0) deals.delete(di);

      // Manual cascade: tasks + documents reference this deal.
      const tList = storage.get("tasks");
      for (let i = tList.length - 1; i >= 0; i--) {
        if (tList.get(i).get("dealId") === id) tList.delete(i);
      }
      const dList = storage.get("documents");
      for (let i = dList.length - 1; i >= 0; i--) {
        if (dList.get(i).get("dealId") === id) dList.delete(i);
      }
    },
    [],
  ) as (id: string) => void;

  const deleteDeal = useCallback(
    async (id: string): Promise<boolean> => {
      deleteDealMut(id);
      return true;
    },
    [deleteDealMut],
  );

  // Spread-cell mutations. Mirrors lib/server/deals.ts → updateSpreadField.

  const updateSpreadFieldMut = useLbMutation(
    (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { storage }: any,
      id: string,
      field: SpreadField,
      value: string | number | null,
    ) => {
      const list = storage.get("deals");
      const i = findIndexById(list, id);
      if (i < 0) return;
      const deal = list.get(i);
      const now = nowIso();

      switch (field) {
        case "address":
        case "city":
        case "state":
        case "zip": {
          const cur = deal.get("property") as PropertyDTO;
          const next: PropertyDTO = { ...cur };
          if (field === "address") {
            const a = value === null || value === "" ? "" : String(value).trim();
            if (!a) return; // server throws — silently no-op here to keep client/server parity
            next.address = a;
          } else {
            next[field] = value === null || value === "" ? null : String(value);
          }
          deal.set("property", next);
          deal.set("updatedAt", now);
          break;
        }
        case "agreedPrice":
        case "listPrice":
        case "amountOwed": {
          const n =
            value === null || value === ""
              ? null
              : Number(String(value).replace(/[^\d.-]/g, ""));
          deal.update({
            [field]: n !== null && Number.isFinite(n) ? n : null,
            updatedAt: now,
          });
          break;
        }
        case "acceptanceDate":
        case "expirationDate": {
          deal.update({
            [field]: value === null || value === "" ? null : String(value),
            updatedAt: now,
          });
          break;
        }
        case "stage": {
          const s = String(value ?? "");
          if (DEAL_STAGES.includes(s as DealStage)) {
            deal.update({ stage: s as DealStage, updatedAt: now });
          }
          break;
        }
        case "termOfAgreement":
        case "notes": {
          deal.update({
            [field]: value === null ? null : String(value),
            updatedAt: now,
          });
          break;
        }
      }
    },
    [],
  ) as (id: string, field: SpreadField, value: string | number | null) => void;

  const updateSpreadField = useCallback(
    async (
      id: string,
      field: SpreadField,
      value: string | number | null,
    ): Promise<boolean> => {
      updateSpreadFieldMut(id, field, value);
      return true;
    },
    [updateSpreadFieldMut],
  );

  const setDealFlagMut = useLbMutation(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ({ storage }: any, id: string, flagged: boolean) => {
      const list = storage.get("deals");
      const i = findIndexById(list, id);
      if (i < 0) return;
      list.get(i).update({ flaggedForReview: flagged, updatedAt: nowIso() });
    },
    [],
  ) as (id: string, flagged: boolean) => void;

  const setDealFlag = useCallback(
    async (id: string, flagged: boolean): Promise<boolean> => {
      setDealFlagMut(id, flagged);
      return true;
    },
    [setDealFlagMut],
  );

  const setDealWeOwnMut = useLbMutation(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ({ storage }: any, id: string, weOwn: boolean) => {
      const list = storage.get("deals");
      const i = findIndexById(list, id);
      if (i < 0) return;
      list.get(i).update({
        weOwn,
        ...(weOwn ? { amountOwed: null } : {}),
        updatedAt: nowIso(),
      });
    },
    [],
  ) as (id: string, weOwn: boolean) => void;

  const setDealWeOwn = useCallback(
    async (id: string, weOwn: boolean): Promise<boolean> => {
      setDealWeOwnMut(id, weOwn);
      return true;
    },
    [setDealWeOwnMut],
  );

  const setDealOwedMut = useLbMutation(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ({ storage }: any, id: string, raw: string) => {
      const list = storage.get("deals");
      const i = findIndexById(list, id);
      if (i < 0) return;
      const s = raw.trim().toLowerCase();
      let amountOwed: number | null = null;
      let weOwn = false;
      if (s === "" || s === "0" || s === "-0-" || s === "-") {
        // null/false defaults already set
      } else if (s.includes("own")) {
        weOwn = true;
      } else {
        const n = Number(s.replace(/[^\d.-]/g, ""));
        if (Number.isFinite(n)) amountOwed = n;
      }
      list.get(i).update({ amountOwed, weOwn, updatedAt: nowIso() });
    },
    [],
  ) as (id: string, raw: string) => void;

  const setDealOwed = useCallback(
    async (id: string, raw: string): Promise<boolean> => {
      setDealOwedMut(id, raw);
      return true;
    },
    [setDealOwedMut],
  );

  const updateDealAddressMut = useLbMutation(
    (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { storage }: any,
      id: string,
      fields: {
        address?: string;
        city?: string | null;
        state?: string | null;
        zip?: string | null;
      },
    ) => {
      const list = storage.get("deals");
      const i = findIndexById(list, id);
      if (i < 0) return;
      const deal = list.get(i);
      const cur = deal.get("property") as PropertyDTO;
      const next: PropertyDTO = { ...cur };
      if (fields.address !== undefined) {
        const a = String(fields.address).trim();
        if (!a) return; // empty address rejected
        next.address = a;
      }
      if (fields.city !== undefined) next.city = nz(fields.city);
      if (fields.state !== undefined) next.state = nz(fields.state);
      if (fields.zip !== undefined) next.zip = nz(fields.zip);
      deal.set("property", next);
      deal.set("updatedAt", nowIso());
    },
    [],
  ) as (
    id: string,
    fields: {
      address?: string;
      city?: string | null;
      state?: string | null;
      zip?: string | null;
    },
  ) => void;

  const updateDealAddress = useCallback(
    async (
      id: string,
      fields: {
        address?: string;
        city?: string | null;
        state?: string | null;
        zip?: string | null;
      },
    ): Promise<boolean> => {
      updateDealAddressMut(id, fields);
      return true;
    },
    [updateDealAddressMut],
  );

  // ── CONTACTS ──────────────────────────────────────────────────────

  const addContactMut = useLbMutation(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ({ storage }: any, contact: ContactDTO) => {
      storage.get("contacts").push(liveObj(contact));
    },
    [],
  ) as (contact: ContactDTO) => void;

  const addContact = useCallback(
    async (input: ContactCreateInput): Promise<string | null> => {
      const id = uid();
      const now = nowIso();
      const contact: ContactDTO = {
        id,
        type: input.type,
        firstName: input.firstName,
        lastName: input.lastName ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        company: input.company ?? null,
        notes: input.notes ?? null,
        createdAt: now,
        updatedAt: now,
      };
      addContactMut(contact);
      return id;
    },
    [addContactMut],
  );

  const updateContactMut = useLbMutation(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ({ storage }: any, id: string, input: ContactUpdateInput) => {
      const list = storage.get("contacts");
      const i = findIndexById(list, id);
      if (i < 0) return;
      list.get(i).update({ ...input, updatedAt: nowIso() });
    },
    [],
  ) as (id: string, input: ContactUpdateInput) => void;

  const updateContact = useCallback(
    async (id: string, input: ContactUpdateInput): Promise<boolean> => {
      updateContactMut(id, input);
      return true;
    },
    [updateContactMut],
  );

  const deleteContactMut = useLbMutation(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ({ storage }: any, id: string) => {
      const list = storage.get("contacts");
      const i = findIndexById(list, id);
      if (i >= 0) list.delete(i);
    },
    [],
  ) as (id: string) => void;

  const deleteContact = useCallback(
    async (id: string): Promise<boolean> => {
      deleteContactMut(id);
      return true;
    },
    [deleteContactMut],
  );

  // ── TASKS ─────────────────────────────────────────────────────────

  const addTaskMut = useLbMutation(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ({ storage }: any, task: TaskDTO) => {
      storage.get("tasks").push(liveObj(task));
    },
    [],
  ) as (task: TaskDTO) => void;

  const addTask = useCallback(
    async (input: TaskCreateInput): Promise<string | null> => {
      const id = uid();
      const now = nowIso();
      const task: TaskDTO = {
        id,
        dealId: input.dealId ?? null,
        title: input.title,
        notes: input.notes ?? null,
        dueDate: input.dueDate ?? null,
        completedAt: null,
        assignees: [],
        createdAt: now,
        updatedAt: now,
      };
      addTaskMut(task);
      return id;
    },
    [addTaskMut],
  );

  const pushTaskUndo = useCallback(
    (entry: UndoEntry) => {
      undoStackRef.current = [...undoStackRef.current, entry].slice(-UNDO_LIMIT);
      syncCanUndo();
    },
    [syncCanUndo],
  );

  const updateTaskMut = useLbMutation(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ({ storage }: any, id: string, input: TaskUpdateInput) => {
      const list = storage.get("tasks");
      const i = findIndexById(list, id);
      if (i < 0) return;
      list.get(i).update({ ...input, updatedAt: nowIso() });
    },
    [],
  ) as (id: string, input: TaskUpdateInput) => void;

  const updateTask = useCallback(
    async (id: string, input: TaskUpdateInput): Promise<boolean> => {
      const prev = tasks.find((t) => t.id === id);
      if (prev) {
        const previousState: Partial<TaskDTO> = {};
        for (const k of Object.keys(input) as (keyof TaskUpdateInput)[]) {
          (previousState as Record<string, unknown>)[k] = (
            prev as unknown as Record<string, unknown>
          )[k];
        }
        pushTaskUndo({
          type: "task",
          id,
          previousState,
          label: `Updated "${prev.title}"`,
        });
      }
      updateTaskMut(id, input);
      return true;
    },
    [tasks, updateTaskMut, pushTaskUndo],
  );

  const deleteTaskMut = useLbMutation(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ({ storage }: any, id: string) => {
      const list = storage.get("tasks");
      const i = findIndexById(list, id);
      if (i >= 0) list.delete(i);
    },
    [],
  ) as (id: string) => void;

  const deleteTask = useCallback(
    async (id: string): Promise<boolean> => {
      deleteTaskMut(id);
      return true;
    },
    [deleteTaskMut],
  );

  // ── TEAM MEMBERS ──────────────────────────────────────────────────
  // ensureTeamMember dedupes by email. Updates name/picture if the user's
  // Google profile changed since last sign-in.

  const ensureTeamMemberMut = useLbMutation(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ({ storage }: any, input: EnsureTeamMemberInput & { color: string }) => {
      const list = storage.get("teamMembers");
      const emailLc = input.email.toLowerCase();
      for (let i = 0; i < list.length; i++) {
        const m = list.get(i);
        if ((m.get("email") || "").toLowerCase() === emailLc) {
          m.update({
            name: input.name,
            picture: input.picture,
          });
          return;
        }
      }
      const member: TeamMember = {
        id: uid(),
        email: emailLc,
        name: input.name,
        picture: input.picture,
        color: input.color,
        addedAt: Date.now(),
      };
      list.push(liveObj(member));
    },
    [],
  ) as (input: EnsureTeamMemberInput & { color: string }) => void;

  const ensureTeamMember = useCallback(
    (input: EnsureTeamMemberInput) => {
      ensureTeamMemberMut({ ...input, color: fallbackColorRef.current });
    },
    [ensureTeamMemberMut],
  );

  const removeTeamMemberMut = useLbMutation(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ({ storage }: any, id: string) => {
      const list = storage.get("teamMembers");
      const i = findIndexById(list, id);
      if (i >= 0) list.delete(i);

      // Also unassign them from any tasks they were on.
      const tList = storage.get("tasks");
      for (let i = 0; i < tList.length; i++) {
        const t = tList.get(i);
        const cur = (t.get("assignees") || []) as string[];
        if (cur.includes(id)) {
          t.set(
            "assignees",
            cur.filter((x) => x !== id),
          );
        }
      }
    },
    [],
  ) as (id: string) => void;

  const removeTeamMember = useCallback(
    (id: string) => removeTeamMemberMut(id),
    [removeTeamMemberMut],
  );

  // ── ALLOWED EMAILS (invite list) ──────────────────────────────────

  const addAllowedEmailMut = useLbMutation(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ({ storage }: any, email: string) => {
      const list = storage.get("allowedEmails");
      const emailLc = email.toLowerCase();
      for (let i = 0; i < list.length; i++) {
        if ((list.get(i) || "").toLowerCase() === emailLc) return;
      }
      list.push(emailLc);
    },
    [],
  ) as (email: string) => void;

  const addAllowedEmail = useCallback(
    (email: string) => addAllowedEmailMut(email),
    [addAllowedEmailMut],
  );

  const removeAllowedEmailMut = useLbMutation(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ({ storage }: any, email: string) => {
      const list = storage.get("allowedEmails");
      const emailLc = email.toLowerCase();
      for (let i = list.length - 1; i >= 0; i--) {
        if ((list.get(i) || "").toLowerCase() === emailLc) list.delete(i);
      }
    },
    [],
  ) as (email: string) => void;

  const removeAllowedEmail = useCallback(
    (email: string) => removeAllowedEmailMut(email),
    [removeAllowedEmailMut],
  );

  // ── TASK ASSIGNMENT ───────────────────────────────────────────────

  const assignTaskMut = useLbMutation(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ({ storage }: any, taskId: string, memberId: string) => {
      const list = storage.get("tasks");
      const i = findIndexById(list, taskId);
      if (i < 0) return;
      const t = list.get(i);
      const cur = (t.get("assignees") || []) as string[];
      if (cur.includes(memberId)) return;
      t.set("assignees", [...cur, memberId]);
      t.set("updatedAt", nowIso());
    },
    [],
  ) as (taskId: string, memberId: string) => void;

  const assignTask = useCallback(
    (taskId: string, memberId: string) => assignTaskMut(taskId, memberId),
    [assignTaskMut],
  );

  const unassignTaskMut = useLbMutation(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ({ storage }: any, taskId: string, memberId: string) => {
      const list = storage.get("tasks");
      const i = findIndexById(list, taskId);
      if (i < 0) return;
      const t = list.get(i);
      const cur = (t.get("assignees") || []) as string[];
      if (!cur.includes(memberId)) return;
      t.set(
        "assignees",
        cur.filter((x) => x !== memberId),
      );
      t.set("updatedAt", nowIso());
    },
    [],
  ) as (taskId: string, memberId: string) => void;

  const unassignTask = useCallback(
    (taskId: string, memberId: string) => unassignTaskMut(taskId, memberId),
    [unassignTaskMut],
  );

  // ── TEMPLATES ─────────────────────────────────────────────────────
  // Phase 2e: files live as data-URLs on TemplateDTO so they sync via
  // Liveblocks and the binding editors' existing `fetch(fileUrl)` works.

  const addTemplateMut = useLbMutation(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ({ storage }: any, template: TemplateDTO) => {
      // documentCount is derived in the templates useMemo; store the rest.
      const { documentCount: _drop, ...stored } = template;
      void _drop;
      storage.get("templates").push(liveObj(stored));
    },
    [],
  ) as (template: TemplateDTO) => void;

  const addTemplate = useCallback(
    async (input: TemplateCreateInput): Promise<string | null> => {
      const name = input.name?.trim();
      if (!name) {
        toast.error("Name required");
        return null;
      }
      const format = detectFormatFromName(input.file.name);
      if (!format) {
        toast.error("Only .docx and .pdf are supported");
        return null;
      }
      try {
        const bytes = await fileToUint8(input.file);
        const dataUrl = uint8ToDataUrl(bytes, mimeForFormat(format));
        const id = uid();
        const now = nowIso();
        const template: TemplateDTO = {
          id,
          name,
          description: input.description?.trim() || null,
          format,
          originalFileUrl: dataUrl,
          tokenizedFileUrl: null, // populated lazily on first bindings save
          bindings: [],
          documentCount: 0,
          createdAt: now,
          updatedAt: now,
        };
        addTemplateMut(template);
        return id;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Upload failed");
        return null;
      }
    },
    [addTemplateMut],
  );

  const updateTemplateMut = useLbMutation(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ({ storage }: any, id: string, input: TemplateUpdateInput) => {
      const list = storage.get("templates");
      const i = findIndexById(list, id);
      if (i < 0) return;
      list.get(i).update({ ...input, updatedAt: nowIso() });
    },
    [],
  ) as (id: string, input: TemplateUpdateInput) => void;

  const updateTemplate = useCallback(
    async (id: string, input: TemplateUpdateInput): Promise<boolean> => {
      // If the caller is saving new bindings on a DOCX template, re-tokenize
      // the original file and persist the tokenized bytes alongside. Mirrors
      // lib/server/templates.ts → saveTemplateBindings.
      if (input.bindings !== undefined) {
        const tpl = templates.find((t) => t.id === id);
        if (tpl && tpl.format === "DOCX") {
          try {
            const originalBytes = await urlToUint8(tpl.originalFileUrl);
            const tokenized = tokenizeDocxClient(
              originalBytes,
              input.bindings as Binding[],
            );
            const tokenizedUrl = uint8ToDataUrl(tokenized, MIME_DOCX);
            updateTemplateMut(id, {
              ...input,
              tokenizedFileUrl: tokenizedUrl,
            });
            return true;
          } catch (err) {
            toast.error(
              err instanceof Error
                ? `Tokenize failed: ${err.message}`
                : "Tokenize failed",
            );
            return false;
          }
        }
      }
      updateTemplateMut(id, input);
      return true;
    },
    [templates, updateTemplateMut],
  );

  const deleteTemplateMut = useLbMutation(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ({ storage }: any, id: string) => {
      const list = storage.get("templates");
      const i = findIndexById(list, id);
      if (i >= 0) list.delete(i);
    },
    [],
  ) as (id: string) => void;

  const deleteTemplate = useCallback(
    async (id: string): Promise<boolean> => {
      deleteTemplateMut(id);
      return true;
    },
    [deleteTemplateMut],
  );

  // ── DOCUMENTS ─────────────────────────────────────────────────────

  const addDocumentMut = useLbMutation(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ({ storage }: any, doc: DocumentDTO) => {
      storage.get("documents").push(liveObj(doc));
    },
    [],
  ) as (doc: DocumentDTO) => void;

  const generateDocument = useCallback(
    async (dealId: string, templateId: string): Promise<boolean> => {
      const deal = deals.find((d) => d.id === dealId);
      const template = templates.find((t) => t.id === templateId);
      if (!deal) {
        toast.error("Deal not found");
        return false;
      }
      if (!template) {
        toast.error("Template not found");
        return false;
      }
      if (template.format === "DOCX" && !template.tokenizedFileUrl) {
        toast.error(
          "This DOCX template hasn't been tokenized yet — open the bindings editor and click Save first.",
        );
        return false;
      }

      // Build the resolver-shaped deal. Contacts are stored separately in
      // Liveblocks (sellerId/realtorId references), so look them up locally
      // and inline their first/last name into the shape fields.ts expects.
      const seller = deal.sellerId
        ? contacts.find((c) => c.id === deal.sellerId)
        : null;
      const realtor = deal.realtorId
        ? contacts.find((c) => c.id === deal.realtorId)
        : null;
      const dealForResolver: DealWithRelations = {
        askingPrice: deal.askingPrice,
        ourOffer: deal.ourOffer,
        agreedPrice: deal.agreedPrice,
        agreementType: deal.agreementType,
        source: deal.source,
        notes: deal.notes,
        stage: deal.stage,
        property: deal.property as unknown as Record<string, unknown>,
        seller: seller
          ? {
              firstName: seller.firstName,
              lastName: seller.lastName ?? "",
              email: seller.email ?? null,
              phone: seller.phone ?? null,
            }
          : null,
        realtor: realtor
          ? {
              firstName: realtor.firstName,
              lastName: realtor.lastName ?? "",
              email: realtor.email ?? null,
              phone: realtor.phone ?? null,
            }
          : null,
      };

      try {
        let outBytes: Uint8Array;
        let mime: string;
        let ext: string;
        if (template.format === "DOCX") {
          const tokenizedBytes = await urlToUint8(template.tokenizedFileUrl!);
          outBytes = fillDocxClient(
            tokenizedBytes,
            template.bindings,
            dealForResolver,
          );
          mime = MIME_DOCX;
          ext = "docx";
        } else {
          const pdfBytes = await urlToUint8(template.originalFileUrl);
          outBytes = await fillPdfClient(
            pdfBytes,
            template.bindings,
            dealForResolver,
          );
          mime = MIME_PDF;
          ext = "pdf";
        }

        const slug = (deal.property.address ?? "deal")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "")
          .slice(0, 60);
        const filename = `${template.name.replace(/\s+/g, "-")}_${slug}.${ext}`;
        downloadBytes(outBytes, filename, mime);

        // Record the generation so the docs list shows what was created. We
        // don't persist the bytes — regeneration is the source of truth.
        const id = uid();
        const now = nowIso();
        const doc: DocumentDTO = {
          id,
          dealId,
          templateId,
          templateName: template.name,
          templateFormat: template.format as TemplateFormat,
          fileUrl: "", // signal to UI: re-generate to download again
          status: "DRAFT",
          docusignEnvelopeId: null,
          createdAt: now,
          updatedAt: now,
        };
        addDocumentMut(doc);
        return true;
      } catch (err) {
        toast.error(
          err instanceof Error
            ? `Generate failed: ${err.message}`
            : "Generate failed",
        );
        return false;
      }
    },
    [deals, templates, contacts, addDocumentMut],
  );

  const setDocumentStatusMut = useLbMutation(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ({ storage }: any, id: string, status: DocStatus) => {
      const list = storage.get("documents");
      const i = findIndexById(list, id);
      if (i < 0) return;
      list.get(i).update({ status, updatedAt: nowIso() });
    },
    [],
  ) as (id: string, status: DocStatus) => void;

  const setDocumentStatus = useCallback(
    async (id: string, status: DocStatus): Promise<boolean> => {
      setDocumentStatusMut(id, status);
      return true;
    },
    [setDocumentStatusMut],
  );

  // ── UNDO ──────────────────────────────────────────────────────────

  const undo = useCallback(() => {
    const stack = undoStackRef.current;
    if (stack.length === 0) return;
    const entry = stack[stack.length - 1];
    undoStackRef.current = stack.slice(0, -1);
    syncCanUndo();

    updateTaskMut(entry.id, entry.previousState as TaskUpdateInput);
    toast.success(`Undone: ${entry.label}`);
  }, [syncCanUndo, updateTaskMut]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          (e.target as HTMLElement)?.isContentEditable
        )
          return;
        if (undoStackRef.current.length === 0) return;
        e.preventDefault();
        undo();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [undo]);

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
    teamMembers,
    connectedEmails,
    allowedEmails,
    ensureTeamMember,
    removeTeamMember,
    addAllowedEmail,
    removeAllowedEmail,
    assignTask,
    unassignTask,
    undo,
    canUndo: canUndoState,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

// ── Room wrapper ───────────────────────────────────────────────────────
// Owns the RoomProvider so the inner component's Liveblocks hooks have a
// room context. Initial storage seeds the LiveLists if the room is brand new;
// subsequent connections reuse whatever the room already has.

export function LiveblocksDataProvider({ children }: { children: ReactNode }) {
  if (!RoomProvider) {
    // Should never happen — the dispatcher only mounts this when
    // isLiveblocksEnabled. Defensive fallback: render children naked.
    return <>{children}</>;
  }
  const RP = RoomProvider;
  return (
    <RP
      id={LIVEBLOCKS_ROOM_ID}
      initialPresence={{ name: "", color: "", email: "" }}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      initialStorage={createInitialStorage() as any}
    >
      <LiveblocksDataProviderInner>{children}</LiveblocksDataProviderInner>
    </RP>
  );
}

// Re-exported so other files can import from this module if they prefer.
export { LiveList, LiveObject };
