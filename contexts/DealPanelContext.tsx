"use client";

import { createContext, useContext } from "react";

// Shared selection state for the deal slide-out panel. Provided at the page
// level so it survives SpreadStore re-keys (which happen when deals are
// added, deleted, or change between active/escrow). Consumed by SpreadRow
// (to highlight + open) and DealDetailPanel (to read the active dealId).
export type DealPanelContextValue = {
  selectedId: string | null;
  open: (id: string) => void;
  close: () => void;
};

const DealPanelContext = createContext<DealPanelContextValue>({
  selectedId: null,
  open: () => {},
  close: () => {},
});

export function useDealPanel(): DealPanelContextValue {
  return useContext(DealPanelContext);
}

export default DealPanelContext;
