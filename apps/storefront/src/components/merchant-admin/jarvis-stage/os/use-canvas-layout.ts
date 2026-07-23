"use client"

/* ------------------------------------------------------------------ */
/* Pixi OS — use-canvas-layout.ts. The CANVAS layout store.           */
/*                                                                     */
/* The card-store (card-store.ts) owns each card's LIFECYCLE (status,     */
/* minimized, dismissed, slot, turn) and is driven by os-provider's SSE +   */
/* the voice agent. This store owns each card's SPATIAL layout {x,y,w,h}      */
/* — the part os-provider deliberately does not expose a dispatch for. It is    */
/* a self-contained reducer owned by CardHost, a pure projection of the active   */
/* card set: it accumulates positions, and exposes MOVE / RESIZE / AUTO_ARRANGE   */
/* (+ RECONCILE / SET_GRID) that re-pack via packing.ts so nothing ever overlaps.  */
/* ------------------------------------------------------------------ */

import { useReducer } from "react"
import {
  type Geom,
  type GridRect,
  arrangeAll,
  reconcileAdd,
  moveCard,
  resizeCard,
  orderByPosition,
  defaultRect,
} from "./packing"

export type CanvasLayoutState = {
  geom: Geom
  layouts: Record<string, GridRect>
}

/** A card as far as layout cares: its id + kind (for the default size). */
export type LayoutCardHint = { id: string; kind: string }

export type CanvasLayoutAction =
  // Reconcile the active-card set against the current geometry. Adds new
  // cards into the first free slot; prunes departed cards; on a geometry
  // change (viewport resize) it re-packs everything to stay valid.
  | { type: "RECONCILE"; cards: LayoutCardHint[]; geom: Geom; geomChanged: boolean }
  // Update geometry only (viewport resize) and re-pack to fit.
  | { type: "SET_GRID"; geom: Geom }
  // Drag-drop: pin a card at a target cell, re-pack the rest.
  | { type: "MOVE_CARD"; id: string; x: number; y: number }
  // Resize handle: apply a clamped size, re-pack the rest.
  | { type: "RESIZE_CARD"; id: string; w: number; h: number }
  // Tidy the whole board (toolbar button / auto on reflow).
  | { type: "AUTO_ARRANGE" }

const EMPTY_GEOM: Geom = {
  cols: 12,
  colW: 80,
  rowH: 8,
  gap: 12,
  blocked: [],
  maxPlaceable: 12,
}

export const initialCanvasLayout: CanvasLayoutState = {
  geom: EMPTY_GEOM,
  layouts: {},
}

function sizeForFactory(
  cards: LayoutCardHint[],
  layouts: Record<string, GridRect>,
  geom: Geom
) {
  const kindById = new Map(cards.map((c) => [c.id, c.kind]))
  return (id: string): { w: number; h: number } => {
    const existing = layouts[id]
    if (existing) return { w: existing.w, h: existing.h }
    return defaultRect(kindById.get(id) ?? "read", geom)
  }
}

export function canvasLayoutReducer(
  state: CanvasLayoutState,
  action: CanvasLayoutAction
): CanvasLayoutState {
  switch (action.type) {
    case "RECONCILE": {
      const ids = action.cards.map((c) => c.id)
      const sizeFor = sizeForFactory(action.cards, state.layouts, action.geom)
      if (action.geomChanged) {
        // Viewport changed: re-pack everything (existing first, in visual
        // order, then any newcomers) so all rects stay valid under new geom.
        const known = ids.filter((id) => state.layouts[id])
        const fresh = ids.filter((id) => !state.layouts[id])
        const ordered = [...orderByPosition(known, state.layouts), ...fresh]
        return {
          geom: action.geom,
          layouts: arrangeAll(ordered, state.layouts, sizeFor, action.geom),
        }
      }
      // Same geometry: keep existing placements, add newcomers only.
      return {
        geom: action.geom,
        layouts: reconcileAdd(ids, state.layouts, sizeFor, action.geom),
      }
    }

    case "SET_GRID": {
      const ids = orderByPosition(Object.keys(state.layouts), state.layouts)
      const sizeFor = sizeForFactory([], state.layouts, action.geom)
      return {
        geom: action.geom,
        layouts: arrangeAll(ids, state.layouts, sizeFor, action.geom),
      }
    }

    case "MOVE_CARD":
      return {
        ...state,
        layouts: moveCard(state.layouts, action.id, action.x, action.y, state.geom),
      }

    case "RESIZE_CARD":
      return {
        ...state,
        layouts: resizeCard(state.layouts, action.id, action.w, action.h, state.geom),
      }

    case "AUTO_ARRANGE": {
      const ids = orderByPosition(Object.keys(state.layouts), state.layouts)
      const sizeFor = sizeForFactory([], state.layouts, state.geom)
      return { ...state, layouts: arrangeAll(ids, state.layouts, sizeFor, state.geom) }
    }

    default:
      return state
  }
}

export function useCanvasLayout() {
  return useReducer(canvasLayoutReducer, initialCanvasLayout)
}
