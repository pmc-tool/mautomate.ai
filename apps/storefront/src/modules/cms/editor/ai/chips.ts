"use client"

/* ------------------------------------------------------------------ */
/* 3F AI surface — the per-node-type CHIP MATRIX (ARCH-AI §2.3).        */
/*                                                                     */
/* Chips are DATA, not JSX, keyed by resolved target kind + subtype so  */
/* the slider (Phase 5) and chrome reuse the same box with different    */
/* rows. Every chip maps to {tier, action}; "Change tone"/"Translate"   */
/* are single chips opening a submenu (§2.3: nine flat actions read as  */
/* a wall). The exclusion list (§5.3) is enforced here as `null` caps:  */
/* columns and html widgets get NO sparkle, NO box, NOTHING.            */
/* ------------------------------------------------------------------ */

import type { NodeRef } from "../canvas/protocol"
import type { AiOverlayContext, AiTarget } from "./targets"
import { targetOf } from "./targets"
import { getBlockSchema } from "../../schema"

export type AiPriceKey = "ai_text" | "ai_node_edit" | "ai_image"

export type AiChipDef = {
  id: string
  label: string
  /** ARCH-AI tier: 1 = micro (/cms/ai-node micro), 2 = node. */
  tier: 1 | 2
  /** Backend action key (ACTIONS / NODE_ACTIONS in /cms/ai-node). */
  action: string
  priceKey: AiPriceKey
  /** Past-tense verb for the history label ("AI: rewrote Heading"). */
  past: string
  /** Opens the image studio flow instead of a text tier (§2.3 image row). */
  image?: boolean
  submenu?: { id: string; label: string; action: string }[]
}

export type AiCaps = {
  chips: AiChipDef[]
  /** What the free-prompt textarea runs (§2.3 last paragraph):
   *  "micro" = Tier-1 custom on the bound field / item;
   *  "node"  = Tier-2 custom scoped to the owning node;
   *  "none"  = textarea hidden (chrome bars without a bound field, image widgets). */
  freePrompt: "micro" | "node" | "none"
  /** Site-wide banner (chrome family — ARCH-AI §5.2). */
  banner?: string
  placeholder: string
}

const TONE: AiChipDef["submenu"] = [
  { id: "premium", label: "Premium", action: "premium" },
  { id: "friendly", label: "Friendly", action: "friendly" },
  { id: "urgent", label: "Urgent", action: "urgent" },
]

const TRANSLATE_MICRO: AiChipDef["submenu"] = [
  { id: "bangla", label: "To Bangla", action: "bangla" },
  { id: "english", label: "To English", action: "english" },
]

const TRANSLATE_NODE: AiChipDef["submenu"] = [
  { id: "bangla", label: "To Bangla", action: "translate_bangla" },
  { id: "english", label: "To English", action: "translate_english" },
]

/* ---- Tier-1 set for text-ish widgets / elements (§2.3 rows 3, 6) ---- */

const TEXT_MICRO_CHIPS: AiChipDef[] = [
  { id: "rewrite", label: "Rewrite", tier: 1, action: "rewrite", priceKey: "ai_text", past: "rewrote" },
  { id: "shorten", label: "Shorten", tier: 1, action: "shorten", priceKey: "ai_text", past: "shortened" },
  { id: "lengthen", label: "Lengthen", tier: 1, action: "lengthen", priceKey: "ai_text", past: "lengthened" },
  { id: "tone", label: "Change tone", tier: 1, action: "premium", priceKey: "ai_text", past: "retoned", submenu: TONE },
  { id: "translate", label: "Translate", tier: 1, action: "english", priceKey: "ai_text", past: "translated", submenu: TRANSLATE_MICRO },
  { id: "grammar", label: "Fix grammar", tier: 1, action: "grammar", priceKey: "ai_text", past: "corrected" },
]

const ELEMENT_CHIPS: AiChipDef[] = [
  { id: "rewrite", label: "Rewrite", tier: 1, action: "rewrite", priceKey: "ai_text", past: "rewrote" },
  { id: "tone", label: "Change tone", tier: 1, action: "premium", priceKey: "ai_text", past: "retoned", submenu: TONE },
]

const BUTTON_CHIPS: AiChipDef[] = [
  { id: "punchier", label: "Punchier label", tier: 1, action: "punchier", priceKey: "ai_text", past: "sharpened" },
  { id: "translate", label: "Translate", tier: 1, action: "english", priceKey: "ai_text", past: "translated", submenu: TRANSLATE_MICRO },
]

const IMAGE_CHIPS: AiChipDef[] = [
  { id: "generate", label: "Generate image", tier: 1, action: "generate", priceKey: "ai_image", past: "generated imagery for", image: true },
  { id: "replace", label: "Replace with AI", tier: 1, action: "replace", priceKey: "ai_image", past: "replaced imagery in", image: true },
]

/* ---- Tier-2 sets for sections (§2.3 rows 1–2) ---- */

const SECTION_CHIPS: AiChipDef[] = [
  { id: "rewrite", label: "Rewrite copy", tier: 2, action: "rewrite", priceKey: "ai_node_edit", past: "rewrote" },
  { id: "imagery", label: "Regenerate imagery", tier: 2, action: "imagery", priceKey: "ai_image", past: "regenerated imagery in", image: true },
  { id: "restyle", label: "Restyle", tier: 2, action: "restyle", priceKey: "ai_node_edit", past: "restyled" },
  { id: "translate", label: "Translate", tier: 2, action: "translate_english", priceKey: "ai_node_edit", past: "translated", submenu: TRANSLATE_NODE },
]

const CONTAINER_CHIPS: AiChipDef[] = [
  { id: "rewrite", label: "Rewrite copy", tier: 2, action: "rewrite", priceKey: "ai_node_edit", past: "rewrote" },
  { id: "restyle", label: "Restyle", tier: 2, action: "restyle", priceKey: "ai_node_edit", past: "restyled" },
]

const ITEM_CHIPS: AiChipDef[] = [
  { id: "rewrite_item", label: "Rewrite this item", tier: 1, action: "rewrite_item", priceKey: "ai_text", past: "rewrote" },
]

/* ---- 5C: the slider rows (ARCH-AI §2.3 matrix + §5.1) ---- */

/** Slide-level: item-scoped (item_path = "slides.<n>", the §3.2 micro
 *  mechanics — the prompt carries ONE slide, set paths are prefix-locked
 *  server-side). "Arrange layers" writes numerically validated
 *  `layers.<j>.frame.base` patches ONLY (never device overrides —
 *  tiny-screen art direction stays human, per ARCH-SLIDER). */
const SLIDER_SLIDE_CHIPS: AiChipDef[] = [
  { id: "rewrite_slide", label: "Rewrite copy", tier: 1, action: "rewrite_item", priceKey: "ai_text", past: "rewrote" },
  { id: "arrange", label: "Arrange layers", tier: 1, action: "arrange", priceKey: "ai_text", past: "arranged" },
]

/** Does this block's schema carry any image field (gates the section
 *  "Regenerate imagery" chip — a newsletter has no imagery to redo)? */
function blockHasImagery(blockType: string | null): boolean {
  if (!blockType) return false
  const schema = getBlockSchema(blockType) as
    | { fields?: { type?: string; itemFields?: { type?: string }[] }[] }
    | undefined
  const fields = Array.isArray(schema?.fields) ? schema!.fields! : []
  return fields.some(
    (f) =>
      f.type === "image" ||
      (Array.isArray(f.itemFields) && f.itemFields.some((g) => g.type === "image"))
  )
}

/**
 * The matrix (ARCH-AI §2.3). Returns null for EXCLUDED nodes — no
 * sparkle, no context-menu row, no box: columns (structural), html
 * widgets (§5.3.2), spacer/divider (nothing to say), media widgets
 * without a text field, commerce widgets (commerce-driven content).
 */
export function aiCapsFor(target: AiTarget): AiCaps | null {
  switch (target.kind) {
    case "section": {
      const chips = blockHasImagery(target.blockType)
        ? SECTION_CHIPS
        : SECTION_CHIPS.filter((c) => c.id !== "imagery")
      return {
        chips,
        freePrompt: "node",
        placeholder: "Change this section…",
      }
    }
    case "container":
      return {
        chips: CONTAINER_CHIPS,
        freePrompt: "node",
        placeholder: "Change this section…",
      }
    case "widget": {
      const t = target.widgetType
      if (t === "heading" || t === "text") {
        return { chips: TEXT_MICRO_CHIPS, freePrompt: "micro", placeholder: "Rewrite this text…" }
      }
      if (t === "button") {
        return { chips: BUTTON_CHIPS, freePrompt: "micro", placeholder: "Change this button…" }
      }
      if (t === "image") {
        return { chips: IMAGE_CHIPS, freePrompt: "none", placeholder: "" }
      }
      // html (§5.3.2), spacer, divider, video, icon, inner_section,
      // commerce widgets: excluded — the toolbar shows no sparkle.
      return null
    }
    case "element":
      // Bound text field -> Tier-1 chips; unresolvable -> the free prompt
      // runs Tier 2 on the owning section (the box says which).
      return target.field
        ? { chips: ELEMENT_CHIPS, freePrompt: "micro", placeholder: "Rewrite this text…" }
        : { chips: [], freePrompt: "node", placeholder: "Change this section…" }
    case "item":
      return {
        chips: ITEM_CHIPS,
        freePrompt: "micro",
        placeholder: "Change this item…",
      }
    case "chrome":
      return {
        chips: [],
        freePrompt: "none",
        banner: "Applies to every page",
        placeholder: "",
      }
    case "chromeEl":
      return target.field
        ? {
            chips: ELEMENT_CHIPS,
            freePrompt: "micro",
            banner: "Applies to every page",
            placeholder: "Rewrite this text…",
          }
        : {
            chips: [],
            freePrompt: "none",
            banner: "Applies to every page",
            placeholder: "",
          }
    /* 5C — the slider rows (§5.1). */
    case "sliderSlide":
      // Item-scoped: the free prompt runs the §3.2 item micro over THIS
      // slide (target.itemPath = "slides.<n>").
      return {
        chips: SLIDER_SLIDE_CHIPS,
        freePrompt: "micro",
        placeholder: "Change this slide…",
      }
    case "sliderLayer":
      // Text/button layers only (targets.ts refuses the rest): the same
      // Tier-1 rows as heading/button widgets, bound to layer.props.
      return target.field
        ? target.sliderLayerType === "button"
          ? { chips: BUTTON_CHIPS, freePrompt: "micro", placeholder: "Change this button…" }
          : { chips: TEXT_MICRO_CHIPS, freePrompt: "micro", placeholder: "Rewrite this text…" }
        : null
  }
}

/** Toolbar/context-menu gate: does this ref get an AI affordance at all?
 *  (Column refs resolve but are excluded by the matrix.) */
export function aiEligible(ref: NodeRef, ctx: AiOverlayContext): boolean {
  if (ref.t === "column") return false
  const t = targetOf(ref, ctx)
  if (!t) return false
  const caps = aiCapsFor(t)
  if (!caps) return false
  return caps.chips.length > 0 || caps.freePrompt !== "none"
}
