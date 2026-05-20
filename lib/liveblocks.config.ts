import { createClient, LiveList, LiveObject } from "@liveblocks/client";
import { createRoomContext } from "@liveblocks/react";

const LIVEBLOCKS_KEY = process.env.NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY;

// Presence — broadcast to all connected clients in the room. Email lets the
// TeamDock's presence dot match a connected client to its TeamMember row
// (which carries the avatar/name persistently in storage).
type Presence = {
  name: string;
  color: string;
  email: string;
};

// Loose storage typing avoids LSON index-signature conflicts with TS interfaces.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Storage = Record<string, any>;

type UserMeta = {
  id: string;
  info: { name: string; color: string };
};

type RoomEvent = Record<string, never>;

export const isLiveblocksEnabled = !!LIVEBLOCKS_KEY;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _ctx: any = null;

if (LIVEBLOCKS_KEY) {
  const client = createClient({ publicApiKey: LIVEBLOCKS_KEY });
  _ctx = createRoomContext<Presence, Storage, UserMeta, RoomEvent>(client);
}

export const RoomProvider = _ctx?.RoomProvider ?? null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useLbStorage<T>(selector: (root: any) => T): T {
  if (!_ctx) throw new Error("Liveblocks not configured");
  return _ctx.useStorage(selector);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useLbMutation(callback: any, deps: unknown[]): any {
  if (!_ctx) throw new Error("Liveblocks not configured");
  return _ctx.useMutation(callback, deps);
}

export function useLbOthers() {
  if (!_ctx) throw new Error("Liveblocks not configured");
  return _ctx.useOthers();
}

export function useLbUpdateMyPresence() {
  if (!_ctx) throw new Error("Liveblocks not configured");
  return _ctx.useUpdateMyPresence();
}

// Storage shape for Centurion CRM. One LiveList per top-level collection.
// Tasks, documents, templates, and contacts are kept flat; deals own properties via embedded fields.
// teamMembers + allowedEmails were added with Google auth — see contexts/AuthContext.tsx.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createInitialStorage(): any {
  return {
    deals: new LiveList([]),
    contacts: new LiveList([]),
    tasks: new LiveList([]),
    templates: new LiveList([]),
    documents: new LiveList([]),
    teamMembers: new LiveList([]),
    allowedEmails: new LiveList([]),
  };
}

// Centurion uses a single Liveblocks room — separate from the Mālama PM room.
// Override with NEXT_PUBLIC_LIVEBLOCKS_ROOM_ID if running multiple environments off one key.
export const LIVEBLOCKS_ROOM_ID =
  process.env.NEXT_PUBLIC_LIVEBLOCKS_ROOM_ID ?? "centurion-crm";

export { LiveList, LiveObject };
export type { Presence };
