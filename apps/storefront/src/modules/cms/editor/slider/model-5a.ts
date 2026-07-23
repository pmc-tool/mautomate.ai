/* ------------------------------------------------------------------ */
/* Slider model FACADE (Phase 5C swap) — re-exports seat 5A's canonical */
/* model. 5B declared these shapes locally ("5A-replace") before 5A     */
/* landed; this swap keeps every 5B-era export NAME stable while the    */
/* ONE implementation lives in modules/cms/slider/* (model / defaults / */
/* upgrade) — renderer, stage and commands share one vocabulary         */
/* (5A-NOTES §3).                                                       */
/*                                                                     */
/* Editor-side helpers 5A does not own (newSliderId, defaultLayerOf,    */
/* defaultSlide, layerDisplayName) stay here; add-layer drop frames now */
/* come from 5A's DEFAULT_LAYER_FRAME so the stage and the renderer can */
/* never disagree about a new layer's geometry.                         */
/*                                                                     */
/* TYPE WIDENING (editor-only, shape-compatible): the model's           */
/* SliderLayer.props is the LayerProps union — the RENDERER's read-side */
/* refinement. The stage merges PARTIAL prop patches                    */
/* ({ ...layer.props, ...patch }), so the editor-facing SliderLayer /   */
/* LayeredSlide keep `props` as an open record. Every legal model value */
/* satisfies the widened shape; the guards below are re-typed against   */
/* the widened names so 5B call sites keep compiling unchanged.         */
/* ------------------------------------------------------------------ */

export * from "../../slider/model"
export {
  DEFAULT_LAYER_FRAME,
  DEFAULT_PLACEMENT,
  placementForTheme,
  resolvePlacement,
} from "../../slider/defaults"
export type { RolePlacement, SliderPlacement } from "../../slider/defaults"
export type { UpgradeOptions } from "../../slider/upgrade"

/* 5B-era aliases for 5A's names — export names stay stable. */
export type {
  LayerAnchor as SliderAnchor,
  LayerType as SliderLayerType,
} from "../../slider/model"

import {
  isLayeredSlide as isLayeredSlideModel,
  type FieldsSlide,
  type LayerType,
  type LayeredSlide as ModelLayeredSlide,
  type SliderLayer as ModelSliderLayer,
} from "../../slider/model"
import { DEFAULT_LAYER_FRAME } from "../../slider/defaults"
import {
  upgradeFieldsSlide as upgradeFieldsSlideModel,
  type UpgradeOptions,
} from "../../slider/upgrade"

/* ------------------------ widened editor types ------------------------ */

export type SliderLayer = Omit<ModelSliderLayer, "props"> & {
  props: Record<string, unknown>
}

export type LayeredSlide = Omit<ModelLayeredSlide, "layers"> & {
  layers: SliderLayer[]
}

/** 5A's strict guard (layered iff `layers` is an ARRAY), re-typed against
 *  the widened editor shape. ONE implementation — never forked. */
export const isLayeredSlide: (v: unknown) => v is LayeredSlide =
  isLayeredSlideModel as (v: unknown) => v is LayeredSlide

/**
 * 5A's pure, deterministic fields→layered upgrade (ids derive from
 * `opts.index`: `up-<i>` — the SAME convention the renderer uses for
 * render-time upgrades, so an editor commit and a render preview carry
 * identical ids; 5A-NOTES §3). Re-typed to the widened editor shape.
 */
export const upgradeFieldsSlide: (
  slide: FieldsSlide | null | undefined,
  opts?: UpgradeOptions
) => LayeredSlide = upgradeFieldsSlideModel as (
  slide: FieldsSlide | null | undefined,
  opts?: UpgradeOptions
) => LayeredSlide

/* ------------------------------- ids ---------------------------------- */

/** Stable short id for command targeting (nanoid-class uniqueness is not
 *  required — ids only need to be unique within one slider's slides and
 *  within one slide's layers). */
export function newSliderId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 8)}`
}

/* ------------------------------ defaults ------------------------------ */

/** Per-layer-type defaults for the stage's Add-layer toolbar. Drop frames
 *  are 5A's DEFAULT_LAYER_FRAME; prop/style defaults ride brand-token
 *  refs so new layers stay on-theme (§2.1). */
export function defaultLayerOf(type: LayerType, id: string): SliderLayer {
  const base = { id, type, frame: { base: { ...DEFAULT_LAYER_FRAME[type] } } }
  switch (type) {
    case "text":
      return {
        ...base,
        props: { html: "New text", tag: "p" },
        style: { color: { ref: "--ff-heading" } },
      }
    case "image":
      return { ...base, props: { src: "", alt: "" } }
    case "button":
      return {
        ...base,
        props: { label: "Shop now", href: "/store", variant: "solid" },
      }
    case "shape":
      return {
        ...base,
        props: {},
        style: { background: { color: "rgba(15,17,21,0.35)" } },
      }
    case "icon":
      return { ...base, props: { icon: "fas fa-star", size: 32 } }
  }
}

export function defaultSlide(id: string): LayeredSlide {
  return {
    id,
    background: { type: "color", color: { ref: "--ff-primary" } },
    layers: [],
  }
}

/** Layer-rail label: explicit name, else derived from content/type. */
export function layerDisplayName(layer: SliderLayer): string {
  if (layer.name) return layer.name
  if (layer.type === "text") {
    const t = String((layer.props as { html?: unknown }).html ?? "")
      .replace(/<[^>]*>/g, " ")
      .trim()
    if (t) return t.length > 24 ? `${t.slice(0, 24)}…` : t
  }
  if (layer.type === "button") {
    const l = String((layer.props as { label?: unknown }).label ?? "").trim()
    if (l) return l
  }
  return layer.type.charAt(0).toUpperCase() + layer.type.slice(1)
}
