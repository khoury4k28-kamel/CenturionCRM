// Label formatters used by every pushActivity() call site. Centralized so
// the activity rail's prose stays consistent across mutations.
//
// All helpers degrade gracefully when fields are missing — Centurion deals
// in particular often start as bare leads with just a city, and an activity
// row should never render with a raw UUID or "null".

import { DEAL_STAGE_LABELS, CONTACT_TYPE_LABELS } from "./types";
import type { DealStage, ContactType, ActivityKind } from "./types";
import type { DealDTO, ContactDTO, TaskDTO, TemplateDTO } from "./dto";

// One-line prose for a manually-logged activity (call / note / email / meeting).
// The free-text body is rendered separately under this summary in the feed.
export function manualActivitySummary(kind: ActivityKind): string {
  switch (kind) {
    case "call.logged":
      return "logged a call";
    case "note.logged":
      return "added a note";
    case "email.logged":
      return "logged an email";
    case "meeting.logged":
      return "logged a meeting";
    default:
      return "logged activity";
  }
}

export function dealDisplayLabel(deal: Pick<DealDTO, "property"> | null | undefined): string {
  if (!deal) return "untitled deal";
  const addr = deal.property?.address?.trim();
  if (addr) return addr;
  const city = deal.property?.city?.trim();
  if (city) return city;
  return "untitled deal";
}

export function contactDisplayLabel(c: Pick<ContactDTO, "firstName" | "lastName" | "type"> | null | undefined): string {
  if (!c) return "contact";
  const first = c.firstName?.trim() ?? "";
  const last = c.lastName?.trim() ?? "";
  const full = `${first} ${last}`.trim();
  if (full) return full;
  return CONTACT_TYPE_LABELS[c.type as ContactType] ?? "contact";
}

export function taskDisplayLabel(t: Pick<TaskDTO, "title"> | null | undefined): string {
  const title = t?.title?.trim();
  return title || "untitled task";
}

export function templateDisplayLabel(t: Pick<TemplateDTO, "name"> | null | undefined): string {
  const name = t?.name?.trim();
  return name || "untitled template";
}

export function stageDisplay(stage: DealStage): string {
  return DEAL_STAGE_LABELS[stage] ?? stage;
}
