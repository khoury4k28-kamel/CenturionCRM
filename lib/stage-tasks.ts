import type { DealStage } from "./types";

export type StageTaskTemplate = {
  title: string;
  daysFromNow: number;
};

export const STAGE_TASK_TEMPLATES: Record<DealStage, StageTaskTemplate[]> = {
  NEW_LEAD: [
    { title: "Pull tax + ownership records", daysFromNow: 1 },
    { title: "Run comps in the neighborhood", daysFromNow: 2 },
    { title: "Find seller contact info", daysFromNow: 3 },
  ],
  RESEARCHING: [
    { title: "Estimate ARV", daysFromNow: 2 },
    { title: "Verify property condition", daysFromNow: 3 },
    { title: "Set max offer based on margins", daysFromNow: 5 },
  ],
  CONTACTED: [
    { title: "Send intro email / LOI", daysFromNow: 1 },
    { title: "Schedule follow-up call", daysFromNow: 3 },
    { title: "Add seller notes to deal", daysFromNow: 1 },
  ],
  NEGOTIATING: [
    { title: "Send counter or revised offer", daysFromNow: 1 },
    { title: "Confirm agreement terms with seller", daysFromNow: 2 },
    { title: "Prepare purchase agreement draft", daysFromNow: 3 },
  ],
  UNDER_AGREEMENT: [
    { title: "Open escrow", daysFromNow: 1 },
    { title: "Order title report", daysFromNow: 2 },
    { title: "Schedule property inspection", daysFromNow: 3 },
    { title: "Send disclosure forms", daysFromNow: 3 },
  ],
  IN_ESCROW: [
    { title: "Confirm closing date", daysFromNow: 1 },
    { title: "Schedule final walkthrough", daysFromNow: 5 },
    { title: "Coordinate signing with escrow officer", daysFromNow: 7 },
    { title: "Wire earnest money / closing funds", daysFromNow: 7 },
  ],
  LISTED: [
    { title: "Confirm listing details with realtor", daysFromNow: 1 },
    { title: "Upload marketing photos", daysFromNow: 2 },
    { title: "Schedule open house", daysFromNow: 5 },
  ],
  CLOSED: [
    { title: "Archive closing documents", daysFromNow: 2 },
    { title: "Send thank-you note to seller", daysFromNow: 3 },
    { title: "Reconcile commissions / payouts", daysFromNow: 5 },
  ],
  DEAD: [
    { title: "Note kill reason in deal", daysFromNow: 1 },
  ],
};

export function getSuggestionsForStage(stage: DealStage): StageTaskTemplate[] {
  return STAGE_TASK_TEMPLATES[stage] ?? [];
}

export function dueDateForTemplate(template: StageTaskTemplate, now: Date = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() + template.daysFromNow);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
