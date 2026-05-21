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
  type ActivityEntry,
  type ActivityKind,
  type ActivityEntityType,
} from "@/lib/types";
import { useAuth } from "./AuthContext";
import { getRandomColor } from "@/lib/colors";
import {
  dealDisplayLabel,
  contactDisplayLabel,
  taskDisplayLabel,
  templateDisplayLabel,
  stageDisplay,
} from "@/lib/activity-labels";
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

// Lazily initialize a LiveList that was missing from initial storage. Rooms
// created before a field was added to `createInitialStorage` (e.g. centurion-crm
// was created in Phase 2d with only deals/contacts/tasks/templates/documents)
// never get re-seeded — `initialStorage` only applies on first create. Without
// this, the first write to a never-seeded key throws TypeError because
// getOrInitList(storage, "activities") returns undefined.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getOrInitList(storage: any, key: string): any {
  const existing = storage.get(key);
  if (existing) return existing;
  const fresh = new LiveList([]);
  storage.set(key, fresh);
  return storage.get(key);
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
    root.deals ?? [],
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contactsRaw = useLbStorage((root: any) =>
    root.contacts ?? [],
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tasksRaw = useLbStorage((root: any) =>
    root.tasks ?? [],
  );
  const templatesRawNullable = useLbStorage(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (root: any) => root.templates ?? [],
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const documentsRaw = useLbStorage((root: any) =>
    root.documents ?? [],
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

  // Use deals as-is — TemplateDTO-style derivation isn't needed. Wrapped in
  // useMemo (matching the other lists above) so useCallback dep arrays that
  // depend on `deals` don't invalidate on every render when dealsRaw is null.
  const deals: DealDTO[] = useMemo(() => dealsRaw ?? [], [dealsRaw]);

  // ── TEAM / PRESENCE STATE ─────────────────────────────────────────
  // teamMembers = persistent roster (Liveblocks storage)
  // allowedEmails = invite list editable by owner
  // connectedEmails = live presence (who's connected right now)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const teamMembersRaw = useLbStorage((root: any) =>
    root.teamMembers ?? [],
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allowedEmailsRaw = useLbStorage((root: any) =>
    root.allowedEmails ?? [],
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const activitiesRaw = useLbStorage((root: any) =>
    root.activities ?? [],
  );
  const teamMembers: TeamMember[] = useMemo(
    () => (teamMembersRaw ?? []) as TeamMember[],
    [teamMembersRaw],
  );
  const allowedEmails: string[] = useMemo(
    () => (allowedEmailsRaw ?? []) as string[],
    [allowedEmailsRaw],
  );
  const activities: ActivityEntry[] = useMemo(
    () => (activitiesRaw ?? []) as ActivityEntry[],
    [activitiesRaw],
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

  // ── Activity log ──────────────────────────────────────────────────
  // pushActivity is invoked as a *separate* useLbMutation rather than inlined
  // into each mutation. Two reasons:
  //   1. It needs to walk teamMembers to look up the actor's color, which
  //      requires a fresh storage read at log time (not a closure snapshot).
  //   2. Calling it after the main mutation keeps each entity-mutation
  //      callback focused on its own work; the audit-log dependency stays
  //      one-way and contained.
  //
  // authUserRef stays in sync with useAuth() without invalidating the
  // useLbMutation closure on every auth state change (deps array is [], so
  // capturing authUser directly would freeze the first value).
  const authUserRef = useRef<typeof authUser>(authUser);
  useEffect(() => {
    authUserRef.current = authUser;
  }, [authUser]);
  const myColorRef = useRef<string>(myColor);
  useEffect(() => {
    myColorRef.current = myColor;
  }, [myColor]);

  type PushActivityInput = {
    kind: ActivityKind;
    summary: string;
    entityType?: ActivityEntityType;
    entityId?: string;
    entityLabel?: string;
  };

  const ACTIVITY_LIMIT = 500;

  const pushActivityMut = useLbMutation(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ({ storage }: any, input: PushActivityInput) => {
      const user = authUserRef.current;
      if (!user) return; // pre-auth mutations (shouldn't happen) — silently skip
      const emailLc = user.email.toLowerCase();

      // Look up the actor's color from teamMembers (already-frozen-on-signin
      // palette pick). Falls back to whatever color is currently broadcast
      // via presence so the rail isn't blank during the brief window between
      // first sign-in and the teamMember row landing.
      let actorColor = myColorRef.current;
      const members = getOrInitList(storage, "teamMembers");
      for (let i = 0; i < members.length; i++) {
        const m = members.get(i);
        if ((m.get("email") || "").toLowerCase() === emailLc) {
          actorColor = m.get("color") || actorColor;
          break;
        }
      }

      const entry: ActivityEntry = {
        id: uid(),
        ts: Date.now(),
        actorEmail: emailLc,
        actorName: user.name,
        actorColor,
        actorPicture: user.picture || undefined,
        kind: input.kind,
        summary: input.summary,
        entityType: input.entityType,
        entityId: input.entityId,
        entityLabel: input.entityLabel,
      };

      const list = getOrInitList(storage, "activities");
      list.push(entry);
      // Cap the rolling log so the room snapshot doesn't grow unbounded.
      // Drop from the front (oldest) until we're back under the limit.
      while (list.length > ACTIVITY_LIMIT) list.delete(0);
    },
    [],
  ) as (input: PushActivityInput) => void;

  const pushActivity = useCallback(
    (input: PushActivityInput) => {
      // Only log when we have a signed-in user to attribute. Calls made
      // before auth resolves are no-ops (shouldn't happen in practice since
      // AuthGate blocks the app until sign-in completes).
      if (!authUserRef.current) return;
      // Activity log is best-effort — never let a logging failure cascade
      // and abort the primary mutation. If the room's schema is mid-migration
      // (e.g. an older room without `activities` seeded), the lazy init in
      // getOrInitList should handle it, but we still catch defensively in case
      // Liveblocks rejects the write for any other reason.
      try {
        pushActivityMut(input);
      } catch (err) {
        console.error("[activity log] write failed", err);
      }
    },
    [pushActivityMut],
  );

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
      const list = getOrInitList(storage, "deals");
      list.push(liveObj(deal));
      console.log(
        "[addDeal] pushed",
        deal.id,
        "→ list.length now",
        list.length,
      );
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
      pushActivity({
        kind: "deal.added",
        summary: `added deal ${dealDisplayLabel(deal)}`,
        entityType: "deal",
        entityId: id,
        entityLabel: dealDisplayLabel(deal),
      });
      return id;
    },
    [addDealMut, pushActivity],
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
      const prev = deals.find((d) => d.id === id);
      moveDealStageMut(id, stage);
      if (prev && prev.stage !== stage) {
        const label = dealDisplayLabel(prev);
        pushActivity({
          kind: "deal.stageChanged",
          summary: `moved ${label} to ${stageDisplay(stage)}`,
          entityType: "deal",
          entityId: id,
          entityLabel: label,
        });
      }
      return true;
    },
    [deals, moveDealStageMut, pushActivity],
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
      // Snapshot the label BEFORE deletion — otherwise the rail row shows
      // "deleted untitled deal" because the storage row is already gone by
      // the time pushActivity runs.
      const prev = deals.find((d) => d.id === id);
      const label = dealDisplayLabel(prev);
      deleteDealMut(id);
      pushActivity({
        kind: "deal.deleted",
        summary: `deleted deal ${label}`,
        entityType: "deal",
        entityId: id,
        entityLabel: label,
      });
      return true;
    },
    [deals, deleteDealMut, pushActivity],
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
      const label = contactDisplayLabel(contact);
      pushActivity({
        kind: "contact.added",
        summary: `added contact ${label}`,
        entityType: "contact",
        entityId: id,
        entityLabel: label,
      });
      return id;
    },
    [addContactMut, pushActivity],
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
      const prev = contacts.find((c) => c.id === id);
      const label = contactDisplayLabel(prev);
      deleteContactMut(id);
      pushActivity({
        kind: "contact.deleted",
        summary: `deleted contact ${label}`,
        entityType: "contact",
        entityId: id,
        entityLabel: label,
      });
      return true;
    },
    [contacts, deleteContactMut, pushActivity],
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
      const label = taskDisplayLabel(task);
      pushActivity({
        kind: "task.added",
        summary: `added task “${label}”`,
        entityType: "task",
        entityId: id,
        entityLabel: label,
      });
      return id;
    },
    [addTaskMut, pushActivity],
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
      // Log only completion/uncompletion transitions — per "major events only"
      // we skip generic field edits like rename/notes/due-date changes.
      if (prev && input.completedAt !== undefined) {
        const wasComplete = !!prev.completedAt;
        const willBeComplete = input.completedAt !== null;
        if (!wasComplete && willBeComplete) {
          const label = taskDisplayLabel(prev);
          pushActivity({
            kind: "task.completed",
            summary: `completed task “${label}”`,
            entityType: "task",
            entityId: id,
            entityLabel: label,
          });
        } else if (wasComplete && !willBeComplete) {
          const label = taskDisplayLabel(prev);
          pushActivity({
            kind: "task.uncompleted",
            summary: `reopened task “${label}”`,
            entityType: "task",
            entityId: id,
            entityLabel: label,
          });
        }
      }
      return true;
    },
    [tasks, updateTaskMut, pushTaskUndo, pushActivity],
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
      const prev = tasks.find((t) => t.id === id);
      const label = taskDisplayLabel(prev);
      deleteTaskMut(id);
      pushActivity({
        kind: "task.deleted",
        summary: `deleted task “${label}”`,
        entityType: "task",
        entityId: id,
        entityLabel: label,
      });
      return true;
    },
    [tasks, deleteTaskMut, pushActivity],
  );

  // ── TEAM MEMBERS ──────────────────────────────────────────────────
  // ensureTeamMember dedupes by email. Updates name/picture if the user's
  // Google profile changed since last sign-in.

  const ensureTeamMemberMut = useLbMutation(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ({ storage }: any, input: EnsureTeamMemberInput & { color: string }) => {
      const list = getOrInitList(storage, "teamMembers");
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
      // Detect "first sign-in" by checking the current roster snapshot. The
      // mutation itself dedupes by email, but we want to log "joined the team"
      // only on the initial create — subsequent calls just refresh name/picture.
      const emailLc = input.email.toLowerCase();
      const isNew = !teamMembers.some(
        (m) => (m.email || "").toLowerCase() === emailLc,
      );
      ensureTeamMemberMut({ ...input, color: fallbackColorRef.current });
      if (isNew) {
        pushActivity({
          kind: "team.memberJoined",
          summary: `joined the team`,
          entityType: "team",
          entityId: emailLc,
          entityLabel: input.name,
        });
      }
    },
    [ensureTeamMemberMut, teamMembers, pushActivity],
  );

  const removeTeamMemberMut = useLbMutation(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ({ storage }: any, id: string) => {
      const list = getOrInitList(storage, "teamMembers");
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
    (id: string) => {
      const prev = teamMembers.find((m) => m.id === id);
      removeTeamMemberMut(id);
      if (prev) {
        pushActivity({
          kind: "team.memberRemoved",
          summary: `removed ${prev.name} from the team`,
          entityType: "team",
          entityId: prev.email,
          entityLabel: prev.name,
        });
      }
    },
    [teamMembers, removeTeamMemberMut, pushActivity],
  );

  // ── ALLOWED EMAILS (invite list) ──────────────────────────────────

  const addAllowedEmailMut = useLbMutation(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ({ storage }: any, email: string) => {
      const list = getOrInitList(storage, "allowedEmails");
      const emailLc = email.toLowerCase();
      for (let i = 0; i < list.length; i++) {
        if ((list.get(i) || "").toLowerCase() === emailLc) return;
      }
      list.push(emailLc);
    },
    [],
  ) as (email: string) => void;

  const addAllowedEmail = useCallback(
    (email: string) => {
      const emailLc = email.toLowerCase();
      // Skip the log if it's already on the list — the mutation is idempotent
      // and we don't want duplicate "granted access" rows when the owner
      // re-enters the same email.
      const already = allowedEmails.some(
        (e) => (e || "").toLowerCase() === emailLc,
      );
      addAllowedEmailMut(email);
      if (!already) {
        pushActivity({
          kind: "team.allowlistAdded",
          summary: `granted access to ${emailLc}`,
          entityType: "team",
          entityId: emailLc,
          entityLabel: emailLc,
        });
      }
    },
    [allowedEmails, addAllowedEmailMut, pushActivity],
  );

  const removeAllowedEmailMut = useLbMutation(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ({ storage }: any, email: string) => {
      const list = getOrInitList(storage, "allowedEmails");
      const emailLc = email.toLowerCase();
      for (let i = list.length - 1; i >= 0; i--) {
        if ((list.get(i) || "").toLowerCase() === emailLc) list.delete(i);
      }
    },
    [],
  ) as (email: string) => void;

  const removeAllowedEmail = useCallback(
    (email: string) => {
      const emailLc = email.toLowerCase();
      const wasAllowed = allowedEmails.some(
        (e) => (e || "").toLowerCase() === emailLc,
      );
      removeAllowedEmailMut(email);
      if (wasAllowed) {
        pushActivity({
          kind: "team.allowlistRemoved",
          summary: `revoked access for ${emailLc}`,
          entityType: "team",
          entityId: emailLc,
          entityLabel: emailLc,
        });
      }
    },
    [allowedEmails, removeAllowedEmailMut, pushActivity],
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
    (taskId: string, memberId: string) => {
      const prevTask = tasks.find((t) => t.id === taskId);
      const member = teamMembers.find((m) => m.id === memberId);
      // The underlying mutation is idempotent; skip the log if the assignee
      // is already on the task so re-dropping an avatar doesn't spam the rail.
      const already =
        prevTask?.assignees?.includes(memberId) ?? false;
      assignTaskMut(taskId, memberId);
      if (!already && prevTask && member) {
        const taskLabel = taskDisplayLabel(prevTask);
        pushActivity({
          kind: "task.assigned",
          summary: `assigned ${member.name} to “${taskLabel}”`,
          entityType: "task",
          entityId: taskId,
          entityLabel: taskLabel,
        });
      }
    },
    [tasks, teamMembers, assignTaskMut, pushActivity],
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
    (taskId: string, memberId: string) => {
      const prevTask = tasks.find((t) => t.id === taskId);
      const member = teamMembers.find((m) => m.id === memberId);
      const wasAssigned = prevTask?.assignees?.includes(memberId) ?? false;
      unassignTaskMut(taskId, memberId);
      if (wasAssigned && prevTask && member) {
        const taskLabel = taskDisplayLabel(prevTask);
        pushActivity({
          kind: "task.unassigned",
          summary: `unassigned ${member.name} from “${taskLabel}”`,
          entityType: "task",
          entityId: taskId,
          entityLabel: taskLabel,
        });
      }
    },
    [tasks, teamMembers, unassignTaskMut, pushActivity],
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
        const label = templateDisplayLabel(template);
        pushActivity({
          kind: "template.added",
          summary: `uploaded template “${label}”`,
          entityType: "template",
          entityId: id,
          entityLabel: label,
        });
        return id;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Upload failed");
        return null;
      }
    },
    [addTemplateMut, pushActivity],
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
      const prev = templates.find((t) => t.id === id);
      const label = templateDisplayLabel(prev);
      deleteTemplateMut(id);
      pushActivity({
        kind: "template.deleted",
        summary: `deleted template “${label}”`,
        entityType: "template",
        entityId: id,
        entityLabel: label,
      });
      return true;
    },
    [templates, deleteTemplateMut, pushActivity],
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
        const dealLabel = dealDisplayLabel(deal);
        const templateLabel = templateDisplayLabel(template);
        pushActivity({
          kind: "document.generated",
          summary: `generated ${templateLabel} for ${dealLabel}`,
          entityType: "document",
          entityId: id,
          // Store the deal id as the label-supplemental hop so row clicks can
          // route to the deal detail (no per-document page exists).
          entityLabel: dealId,
        });
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
    [deals, templates, contacts, addDocumentMut, pushActivity],
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
    activities,
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
