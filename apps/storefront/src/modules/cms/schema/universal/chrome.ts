/* ------------------------------------------------------------------ */
/* Chrome contracts (Phase 3 seat 3D — ARCH-UX §1.2 "Chrome              */
/* (topbar/header/footer)" and "Chrome leaf (data-el in chrome)" rows)   */
/*                                                                     */
/* U3, chrome region: Style = "Chrome style bag (exists)" (full          */
/* universal vocabulary); Advanced = "Subset: identity + custom CSS      */
/* only." — NO visibility, NO position, NO motion. Chrome ships to       */
/* EVERY page of a live store; a sticky/absolute header or a             */
/* hidden-on-mobile topbar authored as a per-bar "advanced" tweak is     */
/* the highest-blast-radius footgun in the product. The subset rule is    */
/* deliberate (ARCH-UX: "restraint here is a feature").                  */
/*                                                                     */
/* U3, chrome leaf: Style = "Element bag"; Advanced = "Visibility        */
/* only."                                                              */
/*                                                                     */
/* ENGINE-ENFORCED (the 2E column pattern, extended to chrome as the     */
/* 3D brief requires): style-engine's buildChromeCss filters both the    */
/* region advanced bag and every chrome elementStyles advanced bag to    */
/* the allowed sets below, so a template-/AI-/import-crafted bag cannot  */
/* re-introduce position/sticky on chrome. SAFE against live data:       */
/* a 2026-07-19 scan of all 51 chrome cms_setting rows (every tenant,    */
/* every locale) found ZERO advanced keys outside these sets (region     */
/* advanced bags were entirely empty; one region style bag exists —       */
/* {color} — and style is unrestricted).                                 */
/*                                                                     */
/* The ALLOWED sets are mirrored as literals in                          */
/* render/style-engine.ts (CHROME_ADVANCED_KEYS /                        */
/* CHROME_ELEMENT_ADVANCED_KEYS) so the render engine stays free of      */
/* editor-schema imports — same arrangement as 2E's column filter; the   */
/* two files cite each other and must not drift.                         */
/*                                                                     */
/* Identity on the region (anchorId/cssClasses) is CONTRACT-level per    */
/* U3; the markup stamping on the chrome roots (base-header / footer)    */
/* is an anchored edit in INTEGRATION-3D.md §5 — until it lands, the     */
/* identity fields write bag keys that the engine allows but nothing     */
/* reads. Custom CSS and (for leaves) visibility are live immediately.   */
/* ------------------------------------------------------------------ */

import type { FieldDef } from "../types"
import { UNIVERSAL_STYLE } from "./style"
import { UNIVERSAL_ADVANCED } from "./advanced"
import { pickFields } from "./derive"
import { ELEMENT_STYLE_FIELDS } from "./element"

/** Full universal style vocabulary, re-worded for a chrome bar. */
const CHROME_STYLE_KEYS = [
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

/** UNIVERSAL_ADVANCED keys a chrome REGION carries: identity + custom CSS. */
const CHROME_ADVANCED_KEYS = ["anchorId", "cssClasses", "customCss"] as const

/** UNIVERSAL_ADVANCED keys a chrome LEAF carries: visibility only. */
const CHROME_ELEMENT_ADVANCED_KEYS = [
  "hideOnDesktop",
  "hideOnTablet",
  "hideOnMobile",
] as const

/**
 * The advanced keys buildChromeCss will actually serialize for a chrome
 * region — exported so the style engine's mirror literal and this schema can
 * be asserted against each other. (anchorId/cssClasses are markup-side
 * identity, kept in the allowed set so a bag holding only them still counts
 * as meaningful — exactly the column arrangement.)
 */
export const CHROME_ADVANCED_ALLOWED: ReadonlySet<string> = new Set(
  CHROME_ADVANCED_KEYS
)

/** The advanced keys buildChromeCss serializes for a chrome ELEMENT. */
export const CHROME_ELEMENT_ADVANCED_ALLOWED: ReadonlySet<string> = new Set(
  CHROME_ELEMENT_ADVANCED_KEYS
)

/** Style tab for a selected chrome region (topbar / header / footer). */
export const CHROME_STYLE_FIELDS: FieldDef[] = pickFields(
  UNIVERSAL_STYLE,
  CHROME_STYLE_KEYS,
  "bar"
)

/** Advanced tab for a chrome region: identity + custom CSS only (U3). */
export const CHROME_ADVANCED_FIELDS: FieldDef[] = pickFields(
  UNIVERSAL_ADVANCED,
  CHROME_ADVANCED_KEYS,
  "bar"
)

/** Style tab for a chrome leaf — identical to the themed-leaf element set. */
export const CHROME_ELEMENT_STYLE_FIELDS: FieldDef[] = ELEMENT_STYLE_FIELDS

/** Advanced tab for a chrome leaf: per-device visibility only (U3). */
export const CHROME_ELEMENT_ADVANCED_FIELDS: FieldDef[] = pickFields(
  UNIVERSAL_ADVANCED,
  CHROME_ELEMENT_ADVANCED_KEYS,
  "element"
)
