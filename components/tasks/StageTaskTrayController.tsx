"use client";

import { useEffect, useState } from "react";
import { subscribeStageChanged } from "@/lib/stage-task-events";
import { StageTaskTray } from "./StageTaskTray";
import type { DealStage } from "@/lib/types";

// Mounted once at root (app/layout.tsx). Listens for user-driven stage
// transitions and renders the suggestion tray for the most recent one.
// Newer transitions replace older trays — we don't queue.
export function StageTaskTrayController() {
  const [active, setActive] = useState<{ dealId: string; toStage: DealStage } | null>(null);

  useEffect(() => {
    return subscribeStageChanged((detail) => {
      setActive({ dealId: detail.dealId, toStage: detail.toStage });
    });
  }, []);

  if (!active) return null;

  return (
    <StageTaskTray
      key={`${active.dealId}-${active.toStage}`}
      dealId={active.dealId}
      toStage={active.toStage}
      onClose={() => setActive(null)}
    />
  );
}
