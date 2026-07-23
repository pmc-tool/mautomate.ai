/* ------------------------------------------------------------------ */
/* Node contracts — the ARCH-UX §1.2 Content–Style–Advanced table,      */
/* encoded (Phase 3 seat 3D).                                           */
/*                                                                     */
/* "The contract below is binding on every current and future node      */
/* type" (ARCH-UX §1.2). This module is that table's Style/Advanced      */
/* columns as data: ONE map from node kind to the field sets its panel   */
/* offers. SchemaPanel resolves through it via the optional `nodeKind`   */
/* prop; a mount may still pass explicit styleFields/advancedFields      */
/* (2E's column mount does) and those always win.                        */
/*                                                                     */
/*  Kind            Style                       Advanced                 */
/*  --------------  --------------------------  ----------------------- */
/*  section         Full UNIVERSAL_STYLE        Full UNIVERSAL_ADVANCED  */
/*  container       Full                        Full                     */
/*  widget          Full                        Full                     */
/*  commerceWidget  Full                        Full                     */
/*  column          COLUMN_STYLE_FIELDS         COLUMN_ADVANCED_FIELDS   */
/*                  (layout + subset, 2E)       (visibility/identity/    */
/*                                              customCss; engine-       */
/*                                              enforced in              */
/*                                              buildColumnCss)          */
/*  innerSection    column-like subset          visibility + customCss   */
/*  element         Full vocabulary,            visibility + customCss   */
/*                  element-worded              (form-side only — see    */
/*                                              element.ts for the       */
/*                                              live-data grandfather)   */
/*  chrome          Full vocabulary,            identity + customCss     */
/*                  bar-worded                  (engine-enforced in      */
/*                                              buildChromeCss)          */
/*  chromeElement   element set                 visibility only          */
/*                                              (engine-enforced)        */
/*                                                                     */
/* NOT in the union (on purpose):                                       */
/*  - "sliderLayer" (U3's ninth row): its panel is a slider-doc          */
/*    takeover where the Position group becomes PRIMARY — the exact       */
/*    inverse of every subset here. It ships with Wave 5 (ARCH-SLIDER    */
/*    S2) and must be added HERE when the layer node type exists,         */
/*    not approximated by one of these kinds.                             */
/*  - "chrome" region CONTENT stays the chrome settings schema; this      */
/*    map only governs the Style/Advanced tabs, exactly like U3's         */
/*    columns.                                                            */
/* ------------------------------------------------------------------ */

import type { FieldDef } from "../types"
import { UNIVERSAL_STYLE } from "./style"
import { UNIVERSAL_ADVANCED } from "./advanced"
import { COLUMN_STYLE_FIELDS, COLUMN_ADVANCED_FIELDS } from "./column"
import { ELEMENT_STYLE_FIELDS, ELEMENT_ADVANCED_FIELDS } from "./element"
import {
  CHROME_STYLE_FIELDS,
  CHROME_ADVANCED_FIELDS,
  CHROME_ELEMENT_STYLE_FIELDS,
  CHROME_ELEMENT_ADVANCED_FIELDS,
} from "./chrome"
import {
  INNER_SECTION_STYLE_FIELDS,
  INNER_SECTION_ADVANCED_FIELDS,
} from "./inner-section"

/**
 * Every node kind the editor can select whose panel carries Style/Advanced
 * tabs. Mirrors the ARCH-CANVAS NodeRef union's stylable members (the canvas
 * doc "must emit selection for each of these node kinds and nothing else" —
 * ARCH-UX §1.2).
 */
export type NodeContractKind =
  | "section"
  | "container"
  | "widget"
  | "commerceWidget"
  | "column"
  | "innerSection"
  | "element"
  | "chrome"
  | "chromeElement"

/** The Style/Advanced field sets one node kind offers. */
export interface NodeContract {
  styleFields: FieldDef[]
  advancedFields: FieldDef[]
}

const FULL: NodeContract = {
  styleFields: UNIVERSAL_STYLE,
  advancedFields: UNIVERSAL_ADVANCED,
}

export const NODE_CONTRACTS: Record<NodeContractKind, NodeContract> = {
  section: FULL,
  container: FULL,
  widget: FULL,
  commerceWidget: FULL,
  column: {
    styleFields: COLUMN_STYLE_FIELDS,
    advancedFields: COLUMN_ADVANCED_FIELDS,
  },
  innerSection: {
    styleFields: INNER_SECTION_STYLE_FIELDS,
    advancedFields: INNER_SECTION_ADVANCED_FIELDS,
  },
  element: {
    styleFields: ELEMENT_STYLE_FIELDS,
    advancedFields: ELEMENT_ADVANCED_FIELDS,
  },
  chrome: {
    styleFields: CHROME_STYLE_FIELDS,
    advancedFields: CHROME_ADVANCED_FIELDS,
  },
  chromeElement: {
    styleFields: CHROME_ELEMENT_STYLE_FIELDS,
    advancedFields: CHROME_ELEMENT_ADVANCED_FIELDS,
  },
}

/**
 * Resolve the field sets for a node kind. Total over the union (the map is
 * Record-typed), but defensive for untyped call sites: an unknown kind gets
 * the full universal sets — never a crash, never an accidentally-restricted
 * panel.
 */
export function nodeContractFor(kind: NodeContractKind): NodeContract {
  return NODE_CONTRACTS[kind] ?? FULL
}
