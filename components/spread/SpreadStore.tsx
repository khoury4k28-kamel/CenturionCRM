"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import type { SpreadField, DealStage } from "@/lib/types";
import { useData } from "@/contexts/DataContext";
import { emitStageChanged } from "@/lib/stage-task-events";
import {
  COLUMN_IDS,
  EDITABLE_COLUMN_IDS,
  isEditable,
  type ColumnId,
  type SpreadDeal,
} from "./types";

// ─── Operation model ────────────────────────────────────────────────────
// Every user-driven change is an Op. Ops are pushed to the undo stack so
// Cmd-Z can revert them. Some changes (address, owed) bundle multiple fields
// into one atomic op.

export type AddressBundle = {
  address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
};

export type OwedBundle = {
  amountOwed: number | null;
  weOwn: boolean;
};

// `FieldKind` excludes the multi-field ops (address fragments, amountOwed) since those
// are committed as bundled ops to keep undo coherent.
export type SimpleField = Exclude<SpreadField, "address" | "city" | "state" | "zip" | "amountOwed">;

export type Op =
  | {
      id: string;
      kind: "field";
      dealId: string;
      field: SimpleField;
      prev: string | number | null;
      next: string | number | null;
    }
  | {
      id: string;
      kind: "address";
      dealId: string;
      prev: AddressBundle;
      next: AddressBundle;
    }
  | {
      id: string;
      kind: "owed";
      dealId: string;
      prev: OwedBundle;
      next: OwedBundle;
      // The raw string the user typed (used to re-fire `setOwed` on redo without re-parsing).
      // On undo, we synthesize a string from `prev` since the user never typed it.
      raw: string;
    }
  | {
      id: string;
      kind: "flag";
      dealId: string;
      prev: boolean;
      next: boolean;
    };

// ─── State ──────────────────────────────────────────────────────────────

type SaveStatus = "saving" | "saved" | "failed";
type Selection = { dealId: string; col: ColumnId } | null;

export type SpreadState = {
  rows: Record<string, SpreadDeal>;
  rowOrder: { actives: string[]; inEscrow: string[] };
  selection: Selection;
  editing: boolean;
  saveStatus: Record<string, SaveStatus>; // key = "dealId:col"
  flashUntil: Record<string, number>;     // key = "dealId:col" → ts ms when flash ends
  undo: Op[];
  redo: Op[];
};

type Action =
  | { type: "SELECT"; selection: Selection; editing?: boolean }
  | { type: "ENTER_EDIT" }
  | { type: "EXIT_EDIT" }
  // APPLY: forward direction. push to undo, clear redo.
  | { type: "APPLY"; op: Op }
  // UNDO_STEP: pop undo, apply prev, push to redo.
  | { type: "UNDO_STEP" }
  // REDO_STEP: pop redo, apply next, push to undo.
  | { type: "REDO_STEP" }
  // ROLLBACK_*: reverse the last *_STEP because the server call failed.
  | { type: "ROLLBACK_APPLY"; op: Op }
  | { type: "ROLLBACK_UNDO"; op: Op }
  | { type: "ROLLBACK_REDO"; op: Op }
  | { type: "SET_SAVE_STATUS"; key: string; status: SaveStatus | "idle" }
  | { type: "FLASH"; key: string; durationMs: number }
  | { type: "CLEAR_FLASH"; key: string };

const STACK_LIMIT = 50;

// ─── Helpers ───────────────────────────────────────────────────────────

function statusKey(dealId: string, col: ColumnId): string {
  return `${dealId}:${col}`;
}

// Map an Op to its display target cell (where save status / flash should appear).
function opTarget(op: Op): { dealId: string; col: ColumnId } {
  switch (op.kind) {
    case "address":
      return { dealId: op.dealId, col: "address" };
    case "owed":
      return { dealId: op.dealId, col: "owed" };
    case "flag":
      return { dealId: op.dealId, col: "flag" };
    case "field":
      return { dealId: op.dealId, col: op.field as ColumnId };
  }
}

function applyOpToRow(row: SpreadDeal, op: Op, direction: "next" | "prev"): SpreadDeal {
  switch (op.kind) {
    case "field": {
      const value = op[direction];
      // narrow by field name; SimpleField excludes property strings + amountOwed
      switch (op.field) {
        case "agreedPrice":
        case "listPrice":
          return { ...row, [op.field]: value as number | null };
        case "acceptanceDate":
        case "expirationDate":
          return { ...row, [op.field]: value as string | null };
        case "termOfAgreement":
        case "notes":
          return { ...row, [op.field]: value as string | null };
        case "stage":
          return { ...row, stage: String(value ?? "") };
        default: {
          const _exhaustive: never = op.field;
          return _exhaustive;
        }
      }
    }
    case "address": {
      const b = op[direction];
      return { ...row, property: { ...row.property, ...b } };
    }
    case "owed": {
      const b = op[direction];
      return { ...row, amountOwed: b.amountOwed, weOwn: b.weOwn };
    }
    case "flag":
      return { ...row, flaggedForReview: op[direction] };
  }
}

function applyOpToRows(
  rows: Record<string, SpreadDeal>,
  op: Op,
  direction: "next" | "prev",
): Record<string, SpreadDeal> {
  const row = rows[op.dealId];
  if (!row) return rows;
  return { ...rows, [op.dealId]: applyOpToRow(row, op, direction) };
}

// ─── Reducer ───────────────────────────────────────────────────────────

function reducer(state: SpreadState, action: Action): SpreadState {
  switch (action.type) {
    case "SELECT":
      return { ...state, selection: action.selection, editing: action.editing ?? false };

    case "ENTER_EDIT":
      if (!state.selection || !isEditable(state.selection.col)) return state;
      return { ...state, editing: true };

    case "EXIT_EDIT":
      return { ...state, editing: false };

    case "APPLY": {
      const rows = applyOpToRows(state.rows, action.op, "next");
      const undo = [...state.undo, action.op].slice(-STACK_LIMIT);
      return { ...state, rows, undo, redo: [] };
    }

    case "UNDO_STEP": {
      if (state.undo.length === 0) return state;
      const op = state.undo[state.undo.length - 1];
      const rows = applyOpToRows(state.rows, op, "prev");
      return {
        ...state,
        rows,
        undo: state.undo.slice(0, -1),
        redo: [...state.redo, op],
      };
    }

    case "REDO_STEP": {
      if (state.redo.length === 0) return state;
      const op = state.redo[state.redo.length - 1];
      const rows = applyOpToRows(state.rows, op, "next");
      return {
        ...state,
        rows,
        undo: [...state.undo, op],
        redo: state.redo.slice(0, -1),
      };
    }

    case "ROLLBACK_APPLY": {
      // Reverse APPLY: re-apply prev, pop undo
      const rows = applyOpToRows(state.rows, action.op, "prev");
      return { ...state, rows, undo: state.undo.slice(0, -1) };
    }

    case "ROLLBACK_UNDO": {
      // Reverse UNDO_STEP: re-apply next, swap stacks back
      const rows = applyOpToRows(state.rows, action.op, "next");
      return {
        ...state,
        rows,
        undo: [...state.undo, action.op],
        redo: state.redo.slice(0, -1),
      };
    }

    case "ROLLBACK_REDO": {
      // Reverse REDO_STEP: re-apply prev, swap stacks back
      const rows = applyOpToRows(state.rows, action.op, "prev");
      return {
        ...state,
        rows,
        undo: state.undo.slice(0, -1),
        redo: [...state.redo, action.op],
      };
    }

    case "SET_SAVE_STATUS": {
      if (action.status === "idle") {
        const { [action.key]: _drop, ...rest } = state.saveStatus;
        return { ...state, saveStatus: rest };
      }
      return { ...state, saveStatus: { ...state.saveStatus, [action.key]: action.status } };
    }

    case "FLASH":
      return {
        ...state,
        flashUntil: { ...state.flashUntil, [action.key]: Date.now() + action.durationMs },
      };

    case "CLEAR_FLASH": {
      const { [action.key]: _drop, ...rest } = state.flashUntil;
      return { ...state, flashUntil: rest };
    }
  }
}

// ─── Initial state ─────────────────────────────────────────────────────

function buildInitial(
  initialRows: SpreadDeal[],
  activeIds: string[],
  inEscrowIds: string[],
): SpreadState {
  const rows: Record<string, SpreadDeal> = {};
  for (const r of initialRows) rows[r.id] = r;
  return {
    rows,
    rowOrder: { actives: activeIds, inEscrow: inEscrowIds },
    selection: null,
    editing: false,
    saveStatus: {},
    flashUntil: {},
    undo: [],
    redo: [],
  };
}

// ─── Context ───────────────────────────────────────────────────────────

type Actions = {
  selectCell(dealId: string, col: ColumnId, editing?: boolean): void;
  enterEdit(): void;
  exitEdit(): void;
  // Navigation: returns true if it moved, false if at boundary.
  navigate(direction: "up" | "down" | "left" | "right" | "tab" | "shiftTab"): boolean;

  // Commits — each one is undoable.
  commitField(dealId: string, field: SimpleField, nextValue: string | number | null): void;
  commitAddress(dealId: string, next: AddressBundle): void;
  commitOwed(dealId: string, raw: string): void;
  commitFlag(dealId: string, flagged: boolean): void;

  undo(): void;
  redo(): void;
};

const StateContext = createContext<SpreadState | null>(null);
const ActionsContext = createContext<Actions | null>(null);

// The body shapes fireSave receives. Kept as a discriminated union here so the
// dispatcher (built inside the component, against the active DataProvider) can
// switch exhaustively without `any`.

type SaveBody =
  | { kind: "spread-cell"; field: SpreadField; value: string | number | null }
  | {
      kind: "address";
      address?: string;
      city?: string | null;
      state?: string | null;
      zip?: string | null;
    }
  | { kind: "owed"; raw: string }
  | { kind: "setFlag"; flagged: boolean };

// Convert an OwedBundle back to a raw string that `setOwed` will parse the same way.
function owedToRaw(b: OwedBundle): string {
  if (b.weOwn) return "we own";
  if (b.amountOwed === null || b.amountOwed === 0) return "-0-";
  return String(b.amountOwed);
}

// ─── Provider ──────────────────────────────────────────────────────────

export function SpreadStore({
  initialRows,
  activeIds,
  inEscrowIds,
  children,
}: {
  initialRows: SpreadDeal[];
  activeIds: string[];
  inEscrowIds: string[];
  children: ReactNode;
}) {
  const [state, dispatch] = useReducer(
    reducer,
    null,
    () => buildInitial(initialRows, activeIds, inEscrowIds),
  );

  // Keep latest state available to async callbacks without re-creating actions on each render.
  const stateRef = useRef(state);
  stateRef.current = state;

  // Pull the cell-save endpoints off the active DataProvider. Both
  // BackendDataProvider and LiveblocksDataProvider implement these; the
  // SpreadStore is now mode-agnostic. The provider already toasts on its own
  // failures, so fireSave below only needs to handle the rollback/status dance.
  const {
    updateSpreadField,
    setDealFlag,
    setDealOwed,
    updateDealAddress,
  } = useData();

  // ─── Status indicator lifecycle ──────────────────────────────────────
  // After a successful save, hold "saved" for 800ms then return to "idle".
  // After a failed save, hold "failed" for 1500ms then return to "idle".
  const fadeStatus = useCallback((key: string, ms: number) => {
    setTimeout(() => dispatch({ type: "SET_SAVE_STATUS", key, status: "idle" }), ms);
  }, []);

  // Dispatcher: turn a SaveBody into the matching provider call. The provider
  // owns the actual transport — fetch in backend mode, LiveObject mutation in
  // Liveblocks mode — and is also responsible for the user-facing error toast.
  const dispatchSave = useCallback(
    async (dealId: string, body: SaveBody): Promise<boolean> => {
      switch (body.kind) {
        case "spread-cell":
          return updateSpreadField(dealId, body.field, body.value);
        case "address":
          return updateDealAddress(dealId, {
            address: body.address,
            city: body.city,
            state: body.state,
            zip: body.zip,
          });
        case "owed":
          return setDealOwed(dealId, body.raw);
        case "setFlag":
          return setDealFlag(dealId, body.flagged);
      }
    },
    [updateSpreadField, updateDealAddress, setDealOwed, setDealFlag],
  );

  const fireSave = useCallback(
    async (op: Op, body: SaveBody, mode: "apply" | "undo" | "redo"): Promise<boolean> => {
      const { dealId, col } = opTarget(op);
      const key = statusKey(dealId, col);
      dispatch({ type: "SET_SAVE_STATUS", key, status: "saving" });
      const ok = await dispatchSave(dealId, body);
      if (ok) {
        dispatch({ type: "SET_SAVE_STATUS", key, status: "saved" });
        fadeStatus(key, 800);
        return true;
      }
      // Provider has already surfaced the error via toast. Just flash the cell
      // and roll our optimistic state back to match the provider's source of
      // truth (which, in backend mode, has also rolled itself back).
      dispatch({ type: "SET_SAVE_STATUS", key, status: "failed" });
      fadeStatus(key, 1500);
      if (mode === "apply") dispatch({ type: "ROLLBACK_APPLY", op });
      else if (mode === "undo") dispatch({ type: "ROLLBACK_UNDO", op });
      else dispatch({ type: "ROLLBACK_REDO", op });
      return false;
    },
    [fadeStatus, dispatchSave],
  );

  // ─── Navigation helpers ──────────────────────────────────────────────

  const visibleRowIds = useMemo(
    () => [...state.rowOrder.actives, ...state.rowOrder.inEscrow],
    [state.rowOrder],
  );

  // Build a separate selectable-columns array; flag and expProfit are selectable but
  // some navigation operations want only editable cells. For now, all selectable.
  const selectableCols = COLUMN_IDS;

  const findRowIndex = useCallback(
    (dealId: string) => visibleRowIds.indexOf(dealId),
    [visibleRowIds],
  );

  const navigate = useCallback<Actions["navigate"]>(
    (direction) => {
      const sel = stateRef.current.selection;
      if (!sel) return false;
      const rowIdx = findRowIndex(sel.dealId);
      const colIdx = selectableCols.indexOf(sel.col);
      if (rowIdx < 0 || colIdx < 0) return false;

      let nextRow = rowIdx;
      let nextCol = colIdx;

      switch (direction) {
        case "up":
          nextRow = Math.max(0, rowIdx - 1);
          break;
        case "down":
          nextRow = Math.min(visibleRowIds.length - 1, rowIdx + 1);
          break;
        case "left":
          nextCol = Math.max(0, colIdx - 1);
          break;
        case "right":
          nextCol = Math.min(selectableCols.length - 1, colIdx + 1);
          break;
        case "tab":
          if (colIdx < selectableCols.length - 1) nextCol = colIdx + 1;
          else if (rowIdx < visibleRowIds.length - 1) {
            nextRow = rowIdx + 1;
            nextCol = 0;
          }
          break;
        case "shiftTab":
          if (colIdx > 0) nextCol = colIdx - 1;
          else if (rowIdx > 0) {
            nextRow = rowIdx - 1;
            nextCol = selectableCols.length - 1;
          }
          break;
      }
      if (nextRow === rowIdx && nextCol === colIdx) return false;
      dispatch({
        type: "SELECT",
        selection: { dealId: visibleRowIds[nextRow], col: selectableCols[nextCol] },
        editing: false,
      });
      return true;
    },
    [findRowIndex, visibleRowIds, selectableCols],
  );

  // ─── Commit actions ───────────────────────────────────────────────────

  const commitField = useCallback<Actions["commitField"]>(
    (dealId, field, nextValueRaw) => {
      const row = stateRef.current.rows[dealId];
      if (!row) return;

      // Parse + normalize the next value based on field type so prev === next compare works.
      let next: string | number | null;
      if (field === "agreedPrice" || field === "listPrice") {
        if (nextValueRaw === "" || nextValueRaw === null) next = null;
        else {
          const n = Number(String(nextValueRaw).replace(/[^\d.-]/g, ""));
          next = Number.isFinite(n) ? n : null;
        }
      } else if (field === "acceptanceDate" || field === "expirationDate") {
        next = nextValueRaw === "" || nextValueRaw === null ? null : String(nextValueRaw);
      } else {
        // termOfAgreement, notes, stage
        const s = nextValueRaw === null ? null : String(nextValueRaw).trim();
        next = s === "" ? null : s;
      }

      const prev: string | number | null =
        field === "agreedPrice"
          ? row.agreedPrice
          : field === "listPrice"
            ? row.listPrice
            : field === "acceptanceDate"
              ? row.acceptanceDate
              : field === "expirationDate"
                ? row.expirationDate
                : field === "termOfAgreement"
                  ? row.termOfAgreement
                  : field === "notes"
                    ? row.notes
                    : field === "stage"
                      ? row.stage
                      : null;

      if (prev === next) return;

      const op: Op = {
        id: crypto.randomUUID(),
        kind: "field",
        dealId,
        field,
        prev,
        next,
      };
      dispatch({ type: "APPLY", op });
      // For stage transitions in the spread, emit a user-driven stage-changed
      // event after the save succeeds so the StageTaskTrayController can offer
      // canonical tasks. Skip on undo/redo (those go through fireSave's other
      // modes and never reach this branch).
      void fireSave(op, { kind: "spread-cell", field, value: next }, "apply").then((ok) => {
        if (
          ok &&
          field === "stage" &&
          typeof prev === "string" &&
          typeof next === "string"
        ) {
          emitStageChanged({
            dealId,
            fromStage: prev as DealStage,
            toStage: next as DealStage,
          });
        }
      });
    },
    [fireSave],
  );

  const commitAddress = useCallback<Actions["commitAddress"]>(
    (dealId, next) => {
      const row = stateRef.current.rows[dealId];
      if (!row) return;
      const prev: AddressBundle = {
        address: row.property.address,
        city: row.property.city,
        state: row.property.state,
        zip: row.property.zip,
      };
      if (
        prev.address === next.address &&
        prev.city === next.city &&
        prev.state === next.state &&
        prev.zip === next.zip
      ) {
        return;
      }
      const op: Op = { id: crypto.randomUUID(), kind: "address", dealId, prev, next };
      dispatch({ type: "APPLY", op });
      void fireSave(op, { kind: "address", ...next }, "apply");
    },
    [fireSave],
  );

  const commitOwed = useCallback<Actions["commitOwed"]>(
    (dealId, raw) => {
      const row = stateRef.current.rows[dealId];
      if (!row) return;
      // Parse the raw string the same way `setOwed` does on the server, so we can compare
      // and (more importantly) capture the next bundle for the undo stack.
      const s = raw.trim().toLowerCase();
      let next: OwedBundle;
      if (s === "" || s === "0" || s === "-0-" || s === "-") {
        next = { amountOwed: null, weOwn: false };
      } else if (s.includes("own")) {
        next = { amountOwed: null, weOwn: true };
      } else {
        const n = Number(s.replace(/[^\d.-]/g, ""));
        if (!Number.isFinite(n)) {
          toast.error(`Couldn't parse "${raw}" as a dollar amount`);
          return;
        }
        next = { amountOwed: n, weOwn: false };
      }
      const prev: OwedBundle = { amountOwed: row.amountOwed, weOwn: row.weOwn };
      if (prev.amountOwed === next.amountOwed && prev.weOwn === next.weOwn) return;

      const op: Op = { id: crypto.randomUUID(), kind: "owed", dealId, prev, next, raw };
      dispatch({ type: "APPLY", op });
      void fireSave(op, { kind: "owed", raw }, "apply");
    },
    [fireSave],
  );

  const commitFlag = useCallback<Actions["commitFlag"]>(
    (dealId, flagged) => {
      const row = stateRef.current.rows[dealId];
      if (!row) return;
      if (row.flaggedForReview === flagged) return;
      const op: Op = {
        id: crypto.randomUUID(),
        kind: "flag",
        dealId,
        prev: row.flaggedForReview,
        next: flagged,
      };
      dispatch({ type: "APPLY", op });
      void fireSave(op, { kind: "setFlag", flagged }, "apply");
    },
    [fireSave],
  );

  // ─── Undo / Redo ──────────────────────────────────────────────────────

  const scheduleFlashClear = useCallback((key: string, ms: number) => {
    setTimeout(() => dispatch({ type: "CLEAR_FLASH", key }), ms);
  }, []);

  const undo = useCallback<Actions["undo"]>(() => {
    const s = stateRef.current;
    if (s.undo.length === 0) return;
    const op = s.undo[s.undo.length - 1];
    dispatch({ type: "UNDO_STEP" });
    const { dealId, col } = opTarget(op);
    const key = statusKey(dealId, col);
    dispatch({ type: "FLASH", key, durationMs: 600 });
    scheduleFlashClear(key, 650);
    const body = serverBodyForDirection(op, "prev");
    void fireSave(op, body, "undo");
    const summary = summarizeOp(op, s.rows[dealId]);
    toast(`Undid: ${summary}`);
  }, [fireSave, scheduleFlashClear]);

  const redo = useCallback<Actions["redo"]>(() => {
    const s = stateRef.current;
    if (s.redo.length === 0) return;
    const op = s.redo[s.redo.length - 1];
    dispatch({ type: "REDO_STEP" });
    const { dealId, col } = opTarget(op);
    const key = statusKey(dealId, col);
    dispatch({ type: "FLASH", key, durationMs: 600 });
    scheduleFlashClear(key, 650);
    const body = serverBodyForDirection(op, "next");
    void fireSave(op, body, "redo");
    const summary = summarizeOp(op, s.rows[dealId]);
    toast(`Redid: ${summary}`);
  }, [fireSave, scheduleFlashClear]);

  // ─── Global keydown ───────────────────────────────────────────────────

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const isTyping =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      // Cmd-Z / Cmd-Shift-Z — only when NOT typing in an input.
      // (When typing, the browser handles native input undo, which is what we want.)
      if (!isTyping && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }

      // Other keys only apply when a cell is selected and we're not typing in an input.
      if (isTyping) return;
      const s = stateRef.current;
      if (!s.selection) return;

      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          navigate("up");
          break;
        case "ArrowDown":
          e.preventDefault();
          navigate("down");
          break;
        case "ArrowLeft":
          e.preventDefault();
          navigate("left");
          break;
        case "ArrowRight":
          e.preventDefault();
          navigate("right");
          break;
        case "Tab":
          e.preventDefault();
          navigate(e.shiftKey ? "shiftTab" : "tab");
          break;
        case "Enter":
        case "F2":
          e.preventDefault();
          if (s.selection.col === "flag") {
            commitFlag(s.selection.dealId, !s.rows[s.selection.dealId]?.flaggedForReview);
          } else if (isEditable(s.selection.col)) {
            dispatch({ type: "ENTER_EDIT" });
          }
          break;
        case "Escape":
          e.preventDefault();
          dispatch({ type: "SELECT", selection: null, editing: false });
          break;
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [navigate, undo, redo, commitFlag]);

  // ─── Click-outside to deselect ────────────────────────────────────────

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      // The spread table sets data-spread-root on its outer container.
      if (t.closest("[data-spread-root]")) return;
      if (stateRef.current.selection) {
        dispatch({ type: "SELECT", selection: null, editing: false });
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const actions = useMemo<Actions>(
    () => ({
      selectCell: (dealId, col, editing = false) =>
        dispatch({ type: "SELECT", selection: { dealId, col }, editing }),
      enterEdit: () => dispatch({ type: "ENTER_EDIT" }),
      exitEdit: () => dispatch({ type: "EXIT_EDIT" }),
      navigate,
      commitField,
      commitAddress,
      commitOwed,
      commitFlag,
      undo,
      redo,
    }),
    [navigate, commitField, commitAddress, commitOwed, commitFlag, undo, redo],
  );

  return (
    <StateContext.Provider value={state}>
      <ActionsContext.Provider value={actions}>{children}</ActionsContext.Provider>
    </StateContext.Provider>
  );
}

// ─── Hooks ─────────────────────────────────────────────────────────────

export function useSpreadState(): SpreadState {
  const ctx = useContext(StateContext);
  if (!ctx) throw new Error("useSpreadState must be used inside <SpreadStore>");
  return ctx;
}

export function useSpreadActions(): Actions {
  const ctx = useContext(ActionsContext);
  if (!ctx) throw new Error("useSpreadActions must be used inside <SpreadStore>");
  return ctx;
}

// Convenience: read a single row.
export function useSpreadRow(dealId: string): SpreadDeal | undefined {
  return useSpreadState().rows[dealId];
}

// Convenience: read selection/edit/status for a single cell.
export function useCellMeta(dealId: string, col: ColumnId) {
  const s = useSpreadState();
  const selected = s.selection?.dealId === dealId && s.selection.col === col;
  const editing = selected && s.editing;
  const status = s.saveStatus[statusKey(dealId, col)] ?? "idle";
  const flashing = (s.flashUntil[statusKey(dealId, col)] ?? 0) > Date.now();
  return { selected, editing, status, flashing };
}

// ─── Internal helpers ──────────────────────────────────────────────────

function serverBodyForDirection(op: Op, direction: "next" | "prev"): SaveBody {
  switch (op.kind) {
    case "field":
      return { kind: "spread-cell", field: op.field, value: op[direction] };
    case "address": {
      const b = op[direction];
      return { kind: "address", ...b };
    }
    case "owed": {
      const b = op[direction];
      // For redo, use the original raw string the user typed.
      // For undo, synthesize a string equivalent to `prev`.
      const raw = direction === "next" ? op.raw : owedToRaw(b);
      return { kind: "owed", raw };
    }
    case "flag":
      return { kind: "setFlag", flagged: op[direction] };
  }
}

function summarizeOp(op: Op, row: SpreadDeal | undefined): string {
  const addr = row?.property.address ?? "row";
  switch (op.kind) {
    case "field":
      return `${humanLabel(op.field)} on ${addr}`;
    case "address":
      return `address on ${addr}`;
    case "owed":
      return `owed on ${addr}`;
    case "flag":
      return `flag on ${addr}`;
  }
}

function humanLabel(field: SimpleField): string {
  switch (field) {
    case "agreedPrice":
      return "purchase price";
    case "listPrice":
      return "list price";
    case "acceptanceDate":
      return "acceptance date";
    case "expirationDate":
      return "expiration date";
    case "termOfAgreement":
      return "term of agreement";
    case "notes":
      return "comments";
    case "stage":
      return "stage";
  }
}
