/* ------------------------------------------------------------------ */
/* Column node contract (Phase 2 seat 2E — ARCH-UX §1.2 "Column" row)   */
/*                                                                     */
/* Columns get style bags: `columns[i].style` / `columns[i].advanced`,  */
/* the SAME diff-only shape and vocabulary as every other node's bags.  */
/* The field lists below are DERIVED from UNIVERSAL_STYLE /             */
/* UNIVERSAL_ADVANCED — never re-authored — so a control tweak there    */
/* (units, ranges, help copy) flows into the column form automatically. */
/* Only the SELECTION of fields is column-specific.                     */
/*                                                                     */
/* WHAT IS EXCLUDED, AND WHY (the subset rule is deliberate —           */
/* ARCH-UX: "Elementor gives every node the full Advanced tab and its   */
/* forums are full of merchants who absolutely-positioned a column and  */
/* destroyed their page. We own the theme contract; restraint here is   */
/* a feature."):                                                       */
/*                                                                     */
/* Style exclusions:                                                   */
/*  - `width` (content-width choose narrow/normal/wide/full): a         */
/*    SECTION-content concept (max-width on the section box). A column  */
/*    is a `flex:1` item — a max-width on it produces dead space inside */
/*    the row, and real column WIDTH belongs to the structure controls  */
/*    (column widths %, ARCH-UX column Content tab), not the style bag. */
/*  - `gap`: the column div is a flex ITEM whose children stack as      */
/*    normal blocks — `gap` would be a silent no-op unless we flipped   */
/*    the column to display:flex, which changes margin-collapse         */
/*    behavior inside every existing column. The row gap lives on the   */
/*    container; a per-column gap ships with the flex controls (U4 P2). */
/*                                                                     */
/* Advanced exclusions:                                                */
/*  - Position group (position/zIndex/offsetX/offsetY) and              */
/*    sticky/stickyOffset: columns positioning breaks the container     */
/*    contract (the flex row's geometry) — ARCH-UX names this the       */
/*    canonical merchant footgun. Enforced in the ENGINE too:           */
/*    buildColumnCss filters the advanced bag to the allowed subset,    */
/*    so an imported/AI-crafted bag cannot re-introduce it.             */
/*  - Motion group (transition/hover/entrance): entrance needs the      */
/*    data-anim wrapper + observer wiring sections have and columns     */
/*    don't; hover-grow on a layout cell is a gimmick that fights the   */
/*    widgets inside it. Widgets and sections keep motion; columns are  */
/*    layout.                                                          */
/*                                                                     */
/* Column-specific addition:                                           */
/*  - `verticalAlign` (Style → Layout): per-column align-self override  */
/*    of the row's vertical alignment (top/center/bottom/stretch) —     */
/*    the flex-item control ARCH-UX U3/U4 calls for on columns.         */
/* ------------------------------------------------------------------ */

import type { FieldDef } from "../types"
import { UNIVERSAL_STYLE } from "./style"
import { UNIVERSAL_ADVANCED } from "./advanced"

/** UNIVERSAL_STYLE keys a column carries (order preserved from the source). */
const COLUMN_STYLE_KEYS = [
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

/** UNIVERSAL_ADVANCED keys a column carries: visibility, identity, custom CSS. */
const COLUMN_ADVANCED_KEYS = [
  "hideOnDesktop",
  "hideOnTablet",
  "hideOnMobile",
  "anchorId",
  "cssClasses",
  "customCss",
] as const

/**
 * The advanced keys buildColumnCss will actually serialize for a column —
 * exported so the style engine and this schema can never drift. (cssClasses /
 * anchorId are MARKUP-side identity handled by container-html, but they live
 * in the allowed set so a bag holding only them still counts as meaningful.)
 */
export const COLUMN_ADVANCED_ALLOWED: ReadonlySet<string> = new Set(
  COLUMN_ADVANCED_KEYS
)

/**
 * Re-target a shared field's merchant-facing copy at the column. The control
 * definition (type, units, ranges, responsive flag) is untouched — only the
 * words "section" / "Section" become "column" / "Column" so the help text
 * reads honestly in the column panel. Single vocabulary, no re-authoring.
 */
function retarget(f: FieldDef): FieldDef {
  const swap = (s: string) =>
    s.replace(/section/g, "column").replace(/Section/g, "Column")
  return {
    ...f,
    label: swap(f.label),
    ...(f.help !== undefined ? { help: swap(f.help) } : {}),
  }
}

function pick(source: FieldDef[], keys: readonly string[]): FieldDef[] {
  return keys
    .map((k) => source.find((f) => f.name === k))
    .filter((f): f is FieldDef => !!f)
    .map(retarget)
}

/** Style tab for a selected column: Layout (column-specific) + the subset. */
export const COLUMN_STYLE_FIELDS: FieldDef[] = [
  {
    name: "verticalAlign",
    type: "choose",
    label: "Vertical align",
    group: "Layout",
    default: "",
    help: "Align this column inside the row, overriding the container's vertical alignment.",
    options: [
      { label: "Top", value: "top", icon: "AlignStartHorizontal" },
      { label: "Center", value: "center", icon: "AlignCenterHorizontal" },
      { label: "Bottom", value: "bottom", icon: "AlignEndHorizontal" },
      { label: "Stretch", value: "stretch", icon: "StretchVertical" },
    ],
  },
  ...pick(UNIVERSAL_STYLE, COLUMN_STYLE_KEYS),
]

/** Advanced tab for a selected column: visibility, identity, custom CSS only. */
export const COLUMN_ADVANCED_FIELDS: FieldDef[] = pick(
  UNIVERSAL_ADVANCED,
  COLUMN_ADVANCED_KEYS
)

/** A column's optional appearance bags, as stored on `columns[i]`. Diff-only:
 *  absent key = no CSS, byte-identical render to an un-styled column. */
export interface ColumnStyleBags {
  style?: Record<string, unknown>
  advanced?: Record<string, unknown>
}
