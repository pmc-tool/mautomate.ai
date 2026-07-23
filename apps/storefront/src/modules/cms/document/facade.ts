/* ------------------------------------------------------------------ */
/* facadeOf — facade labeling for normalized sections (ARCH-CORE §1.4)  */
/*                                                                      */
/* "A flush single-commerce-widget container presents as its widget     */
/* everywhere in the UI — NavigatorTree row says 'Hero Slider' not      */
/* 'Container', the section toolbar and panel breadcrumb likewise."     */
/*                                                                      */
/* The facade is DERIVED from structure, never stored: `flush: true` +  */
/* exactly one column + exactly one commerce widget is the signal.      */
/* The moment the merchant adds a second column or widget the shape no  */
/* longer matches, the facade drops away, and the container controls    */
/* reveal themselves — no flag to clear, nothing to migrate.            */
/*                                                                      */
/* Consumers (seat 1C wires them): NavigatorTree rows, the canvas       */
/* OverlayLayer toolbar, the panel breadcrumb. `iconType` is the        */
/* block/widget TYPE KEY (e.g. "hero_slider", "container"); consumers   */
/* resolve the drawable icon via getWidgetSchema(iconType)?.icon —      */
/* exactly how NavigatorTree already resolves widget icons.             */
/* ------------------------------------------------------------------ */

import { getWidgetSchema, isCommerceWidget } from "../schema/widgets"
import type { SectionNode, WidgetNode } from "./normalize"

export interface SectionFacade {
  /** Human label for the row/toolbar/breadcrumb ("Hero Slider"). */
  label: string
  /** Type key for icon lookup ("hero_slider", "container", "heading"). */
  iconType: string
  /** true when a flush 1-col 1-commerce-widget container presents as its
   *  inner widget; false for real containers and for flat sections. */
  isFacade: boolean
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v)

/** "promo_banner_grid" → "Promo Banner Grid" (fallback when a type has no
 *  registered schema — unknown/future block types still get a readable row). */
function titleize(type: string): string {
  return type
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

function labelForType(type: string): string {
  return getWidgetSchema(type)?.label ?? titleize(type || "Section")
}

/**
 * The sole commerce widget of a flush single-column container, or null when
 * the section is anything else. This is the SAME shape predicate as the
 * engine collapse rule (flush + 1 column + exactly 1 commerce widget) —
 * exported so shell/canvas code shares one definition of "collapsible".
 */
export function flushSingleCommerceWidget(
  section: SectionNode
): WidgetNode | null {
  if (!isObj(section) || section.block_type !== "container") {
    return null
  }
  if (section.flush !== true) {
    return null
  }
  // Mirror engine.ts collapseFlushContainer EXACTLY (1V finding F4): filter
  // non-object entries before counting, and refuse widgets that carry their
  // own appearance bags — the engine will not collapse those, so the editor
  // must not present them as facades either.
  const cols = (Array.isArray(section.columns) ? section.columns : []).filter(
    (c) => isObj(c)
  )
  if (cols.length !== 1) {
    return null
  }
  // Mirror of the engine's column-bag refusal (2E): a styled column cannot
  // collapse, so it must not present as a facade either.
  const c0 = cols[0] as Record<string, unknown>
  const bagFilled = (v: unknown): boolean =>
    isObj(v) && Object.keys(v as object).length > 0
  if (bagFilled(c0.style) || bagFilled(c0.advanced)) {
    return null
  }
  const widgets = (
    Array.isArray((cols[0] as Record<string, unknown>).widgets)
      ? ((cols[0] as Record<string, unknown>).widgets as unknown[])
      : []
  ).filter((w) => isObj(w))
  if (widgets.length !== 1) {
    return null
  }
  const w = widgets[0] as WidgetNode
  if (!isCommerceWidget(w.widget_type)) {
    return null
  }
  const hasOwnKeys = (v: unknown): boolean =>
    isObj(v) && Object.keys(v as object).length > 0
  if (hasOwnKeys(w.style) || hasOwnKeys(w.advanced) || hasOwnKeys(w.elementStyles)) {
    return null
  }
  return w
}

/**
 * How a section presents in the UI.
 *
 * - normalized flush 1-col 1-commerce-widget container → its inner block
 *   ({ label: "Hero Slider", iconType: "hero_slider", isFacade: true })
 * - any other container (multi-column, multi-widget, non-flush, empty)
 *   → { label: "Container", iconType: "container", isFacade: false }
 * - flat legacy section → its block's label ({ label: "Rich Text",
 *   iconType: "rich_text", isFacade: false })
 * - unknown block type → titleized type, isFacade: false
 */
export function facadeOf(section: SectionNode): SectionFacade {
  if (!isObj(section) || typeof section.block_type !== "string") {
    return { label: "Section", iconType: "container", isFacade: false }
  }

  if (section.block_type === "container") {
    const inner = flushSingleCommerceWidget(section)
    if (inner) {
      const t = String(inner.widget_type)
      return { label: labelForType(t), iconType: t, isFacade: true }
    }
    return { label: "Container", iconType: "container", isFacade: false }
  }

  return {
    label: labelForType(section.block_type),
    iconType: section.block_type,
    isFacade: false,
  }
}
