/* ------------------------------------------------------------------ */
/* Pixi OS — the card store & state machine.                          */
/*                                                                     */
/* Every tool the agent invokes becomes a Card, keyed by the tool-call   */
/* `id` that correlates the SSE frames (tool_call -> tool -> tool_result  */
/* for reads; tool_call -> confirm for writes). The reducer below is the   */
/* single source of truth the orb, the CardHost rails, the SignalLines     */
/* overlay and the Dock all read from.                                     */
/*                                                                     */
/* Placement (minimized / dismissed) is tracked as booleans, SEPARATE      */
/* from the data-lifecycle `status`, so a card can be collapsed into the     */
/* dock without losing whether it was `ready`, `proposed`, etc.              */
/*                                                                     */
/* SPATIAL layout ({x,y,w,h}) is owned by a SEPARATE store                  */
/* (use-canvas-layout.ts) that CardHost projects; this store carries an       */
/* optional `layout` hint only. Lifecycle here stays the single source of       */
/* truth so the SSE path AND the voice agent keep driving cards unchanged.       */
/* ------------------------------------------------------------------ */

export type CardKind = "read" | "write" | "note"

/** The DATA lifecycle of a card (independent of dock placement). */
export type CardStatus =
  | "spawning" // tool_call seen, nothing else yet
  | "loading" // running
  | "ready" // read data arrived
  | "proposed" // write confirm arrived — awaiting the merchant
  | "applying" // write confirm being applied
  | "done" // write applied (or a read that settled)
  | "error" // tool/read/apply failed
  | "expired" // write plan token past its exp

export type ConfirmState = {
  tier: "soft" | "hard"
  requireText: string | null
  summary: string
  details: Record<string, unknown>
  token: string
  exp: number // epoch seconds
  applyMessage?: string
  undo?: { token: string; label: string } | null
}

/** Spatial placement hint in grid units (owned/driven by use-canvas-layout). */
export type CardLayout = { x: number; y: number; w: number; h: number }

export type Card = {
  id: string // = tool-call id
  kind: CardKind
  tool: string // tool name (registry key)
  label: string // human label from the stream
  turn: number // which conversation turn spawned it
  args?: Record<string, unknown> // from tool_call
  data?: unknown // from tool_result (reads)
  error?: string | null
  confirm?: ConfirmState // writes
  status: CardStatus
  minimized: boolean // collapsed into the dock
  dismissed: boolean // removed by the merchant
  createdAt: number
  updatedAt: number
  slot: number // stable layout order (drives which rail)
  layout?: CardLayout // optional spatial hint (canvas store is the live owner)
}

export type CardStoreState = {
  byId: Record<string, Card>
  order: string[] // insertion order of ids
  focusId: string | null // the single "primary" card
  turn: number
  nextSlot: number
  maxExpanded: number // capacity budget (set by the CardHost from viewport)
}

export const initialCardStore: CardStoreState = {
  byId: {},
  order: [],
  focusId: null,
  turn: 0,
  nextSlot: 0,
  maxExpanded: 4,
}

export type CardAction =
  | { type: "TURN_START" }
  | {
      type: "TOOL_CALL"
      id: string
      tool: string
      label: string
      kind: CardKind
      args?: Record<string, unknown>
    }
  | { type: "TOOL_STATE"; id: string; state: "running" | "done" | "error" }
  | {
      type: "TOOL_RESULT"
      id: string
      ok: boolean
      data?: unknown
      error?: string | null
    }
  | {
      type: "CONFIRM"
      id: string
      tool?: string
      label?: string
      confirm: ConfirmState
    }
  | { type: "FOCUS"; id: string } // expand + make primary
  | { type: "MINIMIZE"; id: string }
  | { type: "DISMISS"; id: string }
  | { type: "APPLY_START"; id: string }
  | {
      type: "APPLY_RESULT"
      id: string
      ok: boolean
      message?: string
      undo?: { token: string; label: string } | null
    }
  | { type: "EXPIRE"; id: string }
  | { type: "SET_CAPACITY"; maxExpanded: number }

/** A card is "active" if it currently wants a slot in the rails. */
export function isActive(c: Card): boolean {
  return !c.dismissed && !c.minimized
}

/** Cards that should render in the rails, in stable slot order. */
export function activeCards(s: CardStoreState): Card[] {
  return s.order
    .map((id) => s.byId[id])
    .filter((c): c is Card => !!c && isActive(c))
    .sort((a, b) => a.slot - b.slot)
}

/** Cards collapsed into the dock, newest first. */
export function dockCards(s: CardStoreState): Card[] {
  return s.order
    .map((id) => s.byId[id])
    .filter((c): c is Card => !!c && c.minimized && !c.dismissed)
    .sort((a, b) => b.createdAt - a.createdAt)
}

/**
 * Enforce the expanded-card budget: keep at most `maxExpanded` active cards
 * on screen; the OLDEST overflow (never the focus card) auto-minimizes into
 * the dock. This is what keeps a long conversation from becoming a wall of
 * cards — the board never overflows because we bleed excess into the dock.
 */
function enforceCapacity(s: CardStoreState): CardStoreState {
  const active = activeCards(s)
  if (active.length <= s.maxExpanded) return s
  // Oldest first; keep the focus card safe.
  const byAge = active.slice().sort((a, b) => a.createdAt - b.createdAt)
  let toMinimize = active.length - s.maxExpanded
  const byId = { ...s.byId }
  for (const c of byAge) {
    if (toMinimize <= 0) break
    if (c.id === s.focusId) continue
    byId[c.id] = { ...byId[c.id], minimized: true, updatedAt: Date.now() }
    toMinimize--
  }
  return { ...s, byId }
}

function patch(
  s: CardStoreState,
  id: string,
  fn: (c: Card) => Card
): CardStoreState {
  const cur = s.byId[id]
  if (!cur) return s
  return {
    ...s,
    byId: { ...s.byId, [id]: { ...fn(cur), updatedAt: Date.now() } },
  }
}

export function cardReducer(
  state: CardStoreState,
  action: CardAction
): CardStoreState {
  switch (action.type) {
    case "SET_CAPACITY": {
      if (action.maxExpanded === state.maxExpanded) return state
      return enforceCapacity({ ...state, maxExpanded: action.maxExpanded })
    }

    case "TURN_START": {
      // ACCUMULATE: a new command must NOT wipe the board. We only bump the
      // turn counter and clear the transient focus; every prior card stays
      // active and accumulates. `enforceCapacity` alone decides when the board
      // is genuinely too full and docks the OLDEST — nothing else minimizes.
      return { ...state, focusId: null, turn: state.turn + 1 }
    }

    case "TOOL_CALL": {
      const now = Date.now()
      const existing = state.byId[action.id]
      if (existing) {
        // Re-announced — just refresh args, bring it back to focus.
        return enforceCapacity(
          patch({ ...state, focusId: action.id }, action.id, (c) => ({
            ...c,
            args: action.args ?? c.args,
            minimized: false,
          }))
        )
      }
      const card: Card = {
        id: action.id,
        kind: action.kind,
        tool: action.tool,
        label: action.label,
        turn: state.turn,
        args: action.args,
        status: "loading",
        minimized: false,
        dismissed: false,
        createdAt: now,
        updatedAt: now,
        slot: state.nextSlot,
      }
      const next: CardStoreState = {
        ...state,
        byId: { ...state.byId, [action.id]: card },
        order: [...state.order, action.id],
        focusId: action.id,
        nextSlot: state.nextSlot + 1,
      }
      return enforceCapacity(next)
    }

    case "TOOL_STATE": {
      return patch(state, action.id, (c) => {
        if (action.state === "error")
          return { ...c, status: "error", error: c.error ?? "Tool failed" }
        // "running" keeps loading; "done" waits for tool_result (reads) or
        // confirm (writes) to carry the payload — don't prematurely settle.
        if (action.state === "running" && c.status === "spawning")
          return { ...c, status: "loading" }
        return c
      })
    }

    case "TOOL_RESULT": {
      return patch(state, action.id, (c) => ({
        ...c,
        status: action.ok ? "ready" : "error",
        data: action.ok ? action.data : c.data,
        error: action.ok ? null : action.error ?? "Tool failed",
      }))
    }

    case "CONFIRM": {
      const existing = state.byId[action.id]
      const now = Date.now()
      if (!existing) {
        // A write confirm can arrive without a prior tool_call on older
        // backends — synthesize the card so writes still render.
        const card: Card = {
          id: action.id,
          kind: "write",
          tool: action.tool ?? "unknown_write",
          label: action.label ?? "Confirm change",
          turn: state.turn,
          confirm: action.confirm,
          status: "proposed",
          minimized: false,
          dismissed: false,
          createdAt: now,
          updatedAt: now,
          slot: state.nextSlot,
        }
        return enforceCapacity({
          ...state,
          byId: { ...state.byId, [action.id]: card },
          order: [...state.order, action.id],
          focusId: action.id,
          nextSlot: state.nextSlot + 1,
        })
      }
      return enforceCapacity(
        patch({ ...state, focusId: action.id }, action.id, (c) => ({
          ...c,
          kind: "write",
          status: "proposed",
          confirm: action.confirm,
          minimized: false,
        }))
      )
    }

    case "FOCUS": {
      // Raise a card to primary. In the accumulating packing canvas every
      // active card is always visible, so focusing must NOT dock any other
      // card (that was the old single-expanded-radio "wipe"). We only mark it
      // focused + ensure it's un-minimized (this also restores a dock chip
      // into the canvas, where the layout store re-packs it into a free slot).
      const target = state.byId[action.id]
      if (!target) return state
      const s = patch({ ...state, focusId: action.id }, action.id, (c) => ({
        ...c,
        minimized: false,
        dismissed: false,
      }))
      return enforceCapacity(s)
    }

    case "MINIMIZE": {
      const s = patch(state, action.id, (c) => ({ ...c, minimized: true }))
      return {
        ...s,
        focusId: state.focusId === action.id ? null : state.focusId,
      }
    }

    case "DISMISS": {
      const s = patch(state, action.id, (c) => ({
        ...c,
        dismissed: true,
        minimized: false,
      }))
      return {
        ...s,
        focusId: state.focusId === action.id ? null : state.focusId,
      }
    }

    case "APPLY_START": {
      return patch(state, action.id, (c) => ({ ...c, status: "applying" }))
    }

    case "APPLY_RESULT": {
      return patch(state, action.id, (c) => ({
        ...c,
        status: action.ok ? "done" : "error",
        confirm: c.confirm
          ? {
              ...c.confirm,
              applyMessage: action.message,
              undo: action.ok ? action.undo ?? null : c.confirm.undo,
            }
          : c.confirm,
        error: action.ok ? null : action.message ?? "That didn't go through.",
      }))
    }

    case "EXPIRE": {
      return patch(state, action.id, (c) =>
        c.status === "proposed" ? { ...c, status: "expired" } : c
      )
    }

    default:
      return state
  }
}
