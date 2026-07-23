/* ------------------------------------------------------------------ */
/* Inner-section contract (Phase 3 seat 3D — ARCH-UX §1.2)              */
/*                                                                     */
/* The inner_section widget is the one nesting level of the node tree   */
/* (FINAL-PLAN §2: "one inner-section level"). U3 has no dedicated row  */
/* for it because it is COLUMN-LIKE: a structural flex row, not a       */
/* content widget — so it takes the column subset, not the full basic-   */
/* widget contract.                                                     */
/*                                                                     */
/* Style exclusions (same rationale as column.ts, which see):           */
/*  - `width` (content-width): an inner section spans its parent        */
/*    column; a max-width on it produces dead space inside the column.   */
/*    Column WIDTHS inside the row belong to its structure controls      */
/*    (the layout/columns Content fields), not the style bag.            */
/*  - `gap`: the row gap is already a CONTENT field of the widget        */
/*    (ContainerData.gap, rendered by container-html) — offering a       */
/*    second gap in the style bag would target the widget's data-w       */
/*    wrapper, not the flex row, and silently no-op.                     */
/*                                                                     */
/* Advanced exclusions:                                                 */
/*  - Position group + sticky: positioning a layout row breaks the       */
/*    container contract — the canonical U3 footgun, same as columns.    */
/*  - Motion group: entrance needs the data-anim wrapper sections have    */
/*    and widgets don't; hover-grow on a layout row fights the widgets    */
/*    inside it.                                                         */
/*  - Identity (anchorId/cssClasses): container-html stamps identity     */
/*    for COLUMNS only (columnIdentity); nothing writes id/class from a   */
/*    widget's advanced bag, so these would be dead controls. If widget   */
/*    identity stamping ever lands, add them back here.                   */
/*                                                                     */
/* ENFORCEMENT IS FORM-SIDE ONLY for now: inner_section bags serialize   */
/* through buildWidgetCssPath, which is shared by every widget type and   */
/* deliberately untouched (the engine has no widget-type awareness).      */
/* This is SAFE to tighten later: the 2026-07-19 scan of all draft        */
/* sections + published snapshots found ZERO inner_section style or       */
/* advanced bags stored anywhere, so an engine filter (via a widget-type  */
/* branch in container-html's collect walk) would be byte-identical on    */
/* all live data — noted in INTEGRATION-3D.md as an optional follow-up.   */
/* ------------------------------------------------------------------ */

import type { FieldDef } from "../types"
import { UNIVERSAL_STYLE } from "./style"
import { UNIVERSAL_ADVANCED } from "./advanced"
import { pickFields } from "./derive"

/** UNIVERSAL_STYLE keys an inner section carries (column subset, no
 *  verticalAlign — align-self is meaningless for a block stacked inside a
 *  column, and only buildColumnCss maps it anyway). */
const INNER_SECTION_STYLE_KEYS = [
  "padding",
  "margin",
  "minHeight",
  "background",
  "border",
  "borderRadius",
  "boxShadow",
  "typography",
  "align",
  "color",
] as const

/** UNIVERSAL_ADVANCED keys an inner section carries. */
const INNER_SECTION_ADVANCED_KEYS = [
  "hideOnDesktop",
  "hideOnTablet",
  "hideOnMobile",
  "customCss",
] as const

/** Style tab for a selected inner_section widget. */
export const INNER_SECTION_STYLE_FIELDS: FieldDef[] = pickFields(
  UNIVERSAL_STYLE,
  INNER_SECTION_STYLE_KEYS,
  "inner section"
)

/** Advanced tab for an inner_section widget: visibility + custom CSS. */
export const INNER_SECTION_ADVANCED_FIELDS: FieldDef[] = pickFields(
  UNIVERSAL_ADVANCED,
  INNER_SECTION_ADVANCED_KEYS,
  "inner section"
)
