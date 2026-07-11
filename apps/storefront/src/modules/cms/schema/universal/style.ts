/* ------------------------------------------------------------------ */
/* Universal STYLE schema — the shared Style tab every block carries     */
/*                                                                     */
/* Authored ONCE here, merged into every block at panel-build time (it   */
/* is NOT part of any BlockSchema.fields, which stay content-only). Its   */
/* values live in a namespaced `block.style` bag, kept fully separate     */
/* from content props so copy-style / reset-style never touch text.       */
/*                                                                       */
/* Storage is DIFF-ONLY: `block.style` holds only the keys a user has     */
/* actually set — see `defaultStyle()`. Size-like leaves are flagged       */
/* `responsive: true` so their value is a `ResponsiveValue<T>`; scalar     */
/* leaves (font family / weight / color) stay plain. v1 is deliberately    */
/* focused on spacing / size / background / border / typography — no       */
/* exotic filters or blend modes yet.                                     */
/* ------------------------------------------------------------------ */

import type { FieldDef } from "../types"

/** CSS length units offered by the box (dimensions) controls. */
const LENGTH_UNITS = ["px", "%", "em", "rem"]

export const UNIVERSAL_STYLE: FieldDef[] = [
  /* --- Spacing ---------------------------------------------------- */
  {
    name: "padding",
    type: "dimensions",
    label: "Padding",
    group: "Spacing",
    units: LENGTH_UNITS,
    linked: true,
    responsive: true,
    help: "Inner spacing on each side of the section box.",
  },
  {
    name: "margin",
    type: "dimensions",
    label: "Margin",
    group: "Spacing",
    units: LENGTH_UNITS,
    linked: true,
    responsive: true,
    help: "Outer spacing around the section box.",
  },
  {
    name: "gap",
    type: "unitNumber",
    label: "Gap",
    group: "Spacing",
    units: ["px", "rem", "em"],
    min: 0,
    max: 200,
    step: 1,
    responsive: true,
    help: "Space between the section's direct children.",
  },

  /* --- Size ------------------------------------------------------- */
  {
    name: "width",
    type: "choose",
    label: "Content width",
    group: "Size",
    default: "normal",
    help: "Layout width of the section's content column.",
    options: [
      { label: "Narrow", value: "narrow", icon: "FoldHorizontal" },
      { label: "Normal", value: "normal", icon: "AlignJustify" },
      { label: "Wide", value: "wide", icon: "UnfoldHorizontal" },
      { label: "Full", value: "full", icon: "MoveHorizontal" },
    ],
  },
  {
    name: "minHeight",
    type: "unitNumber",
    label: "Min height",
    group: "Size",
    units: ["px", "vh", "%"],
    min: 0,
    max: 2000,
    step: 1,
    responsive: true,
    help: "Minimum height of the section box.",
  },

  /* --- Background ------------------------------------------------- */
  {
    name: "background",
    type: "background",
    label: "Background",
    group: "Background",
    gradient: true,
    allowImage: true,
    help: "Solid colour, gradient or image behind the section.",
  },

  /* --- Border ----------------------------------------------------- */
  {
    name: "border",
    type: "border",
    label: "Border",
    group: "Border",
    help: "Border width, style and colour.",
  },
  {
    name: "borderRadius",
    type: "dimensions",
    label: "Border radius",
    group: "Border",
    units: ["px", "%"],
    linked: true,
    help: "Corner rounding (top / right / bottom / left).",
  },
  {
    name: "boxShadow",
    type: "boxShadow",
    label: "Box shadow",
    group: "Border",
    help: "Drop shadow cast by the section box.",
  },

  /* --- Typography ------------------------------------------------- */
  {
    name: "typography",
    type: "typographyGroup",
    label: "Typography",
    group: "Typography",
    units: ["px", "rem", "em"],
    responsive: true,
    help: "Font family, size, weight, line height and letter spacing.",
  },
  {
    name: "align",
    type: "choose",
    label: "Text align",
    group: "Typography",
    options: [
      { label: "Left", value: "left", icon: "AlignLeft" },
      { label: "Center", value: "center", icon: "AlignCenter" },
      { label: "Right", value: "right", icon: "AlignRight" },
      { label: "Justify", value: "justify", icon: "AlignJustify" },
    ],
  },

  /* --- Text color ------------------------------------------------- */
  {
    name: "color",
    type: "color",
    label: "Text color",
    group: "Text color",
    help: "Base text colour for the section's content.",
  },
]

/**
 * Seed value for a fresh `block.style` bag. Storage is diff-only: nothing is
 * baked in, so absent keys fall back to theme tokens / CSS defaults at render
 * time and copy-style / reset-style stay trivial. Returns an empty object.
 */
export function defaultStyle(): Record<string, unknown> {
  return {}
}

export default UNIVERSAL_STYLE
