/* ------------------------------------------------------------------ */
/* Themed-leaf element contract (Phase 3 seat 3D — ARCH-UX §1.2         */
/* "Themed leaf (data-el)" row)                                         */
/*                                                                     */
/* U3 contract: Style = "Element style bag (exists)" — the FULL          */
/* universal style vocabulary, kept as-is (live bags already use every   */
/* group incl. gap and width; a scan of all 304 draft sections + 246     */
/* published snapshots on 2026-07-19 found gap×12, typography×17,        */
/* color×13, minHeight×12, width×1 … in element style bags).             */
/* Advanced = "Subset: visibility, custom CSS. No position — leaves      */
/* live inside theme markup we don't own."                               */
/*                                                                     */
/* WHY THE ADVANCED SUBSET IS FORM-ONLY (no engine filter — the ONE      */
/* deliberate divergence from the column/chrome pattern):                */
/* buildElementCssForBase serializes element bags in FULL, and it MUST   */
/* keep doing so: real published data already carries excluded keys —    */
/* snapshot cmssnap_01KXX3THA5FDNW9CVRFF8ZD59A (tenant                   */
/* ten_01KXKAY3PSQ22F10EGAR9M7H5S) has el "title" with                   */
/* hoverAnimation:"grow" + entranceAnimation:"slide-up". An engine       */
/* filter would silently strip a live page's animation, violating        */
/* FINAL-PLAN invariant 1 (published pages never break). So: the panel   */
/* stops OFFERING the footgun fields; legacy keys keep rendering and,     */
/* because the Style/Advanced form spreads the whole bag on write,        */
/* survive edits untouched. (Columns and chrome can be engine-enforced    */
/* because their restricted keys have ZERO stored occurrences — columns   */
/* proven by 2E, chrome by the same 2026-07-19 scan.)                     */
/*                                                                     */
/* Position is excluded because a [data-el] leaf sits inside theme        */
/* markup whose geometry the theme owns — absolutely-positioning a        */
/* heading inside a Liquid section is the exact merchant footgun the      */
/* U3 subset rule exists to prevent. Identity (anchorId/cssClasses) is    */
/* excluded because nothing stamps markup attributes on theme-owned       */
/* elements (the renderer only ever ADDS CSS scoped to the existing       */
/* data-el marker).                                                      */
/* ------------------------------------------------------------------ */

import type { FieldDef } from "../types"
import { UNIVERSAL_STYLE } from "./style"
import { UNIVERSAL_ADVANCED } from "./advanced"
import { pickFields } from "./derive"

/** The full universal style vocabulary — every key, in source order. */
const ELEMENT_STYLE_KEYS = [
  "padding",
  "margin",
  "gap",
  "width",
  "minHeight",
  "background",
  "border",
  "borderRadius",
  "boxShadow",
  "typography",
  "align",
  "color",
] as const

/** UNIVERSAL_ADVANCED keys a themed leaf carries: visibility + custom CSS. */
const ELEMENT_ADVANCED_KEYS = [
  "hideOnDesktop",
  "hideOnTablet",
  "hideOnMobile",
  "customCss",
] as const

/**
 * Style tab for a selected themed-leaf element. Same vocabulary as today —
 * only the copy is re-targeted ("the section box" → "the element box") so
 * the panel reads honestly.
 */
export const ELEMENT_STYLE_FIELDS: FieldDef[] = pickFields(
  UNIVERSAL_STYLE,
  ELEMENT_STYLE_KEYS,
  "element"
)

/** Advanced tab for a themed leaf: visibility + custom CSS only (U3). */
export const ELEMENT_ADVANCED_FIELDS: FieldDef[] = pickFields(
  UNIVERSAL_ADVANCED,
  ELEMENT_ADVANCED_KEYS,
  "element"
)
