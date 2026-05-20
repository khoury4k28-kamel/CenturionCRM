// Tiny custom-event bus for "user just moved a deal to a new stage" signals.
// Emitting sites (StageStepper dropdown, SpreadStore stage cell) fire only on
// user-initiated successful transitions — never on undo, programmatic stage
// assignment (e.g., DealCreateModal), or Liveblocks remote updates.
//
// The StageTaskTrayController subscribes once, mounted in app/layout.tsx.

import type { DealStage } from "./types";

export type StageChangedDetail = {
  dealId: string;
  fromStage: DealStage;
  toStage: DealStage;
};

const EVENT_NAME = "centurion:stage-changed";

export function emitStageChanged(detail: StageChangedDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<StageChangedDetail>(EVENT_NAME, { detail }));
}

export function subscribeStageChanged(
  handler: (detail: StageChangedDetail) => void,
): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (e: Event) => {
    const ce = e as CustomEvent<StageChangedDetail>;
    if (ce.detail) handler(ce.detail);
  };
  window.addEventListener(EVENT_NAME, listener);
  return () => window.removeEventListener(EVENT_NAME, listener);
}
