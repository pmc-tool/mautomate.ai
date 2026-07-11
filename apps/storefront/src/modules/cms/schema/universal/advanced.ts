/* ------------------------------------------------------------------ */
/* Universal Advanced schema — one shared FieldDef[] merged into every  */
/* block at panel-build time (NOT authored per block). Its values live   */
/* in the namespaced `block.advanced` bag, kept fully separate from      */
/* content props. Every field carries a `group` so the panel's           */
/* accordions render cleanly. Motion (Phase 6) is CSS-only: transitions,  */
/* hover animation, and position:sticky. Entrance-on-scroll (F3) is        */
/* no-JS-safe: sections only get hidden AFTER a client observer adds        */
/* `ff-io` to <html>, so content is never invisible without JS.             */
/* ------------------------------------------------------------------ */

import type { FieldDef } from "../types"

export const UNIVERSAL_ADVANCED: FieldDef[] = [
  /* --- Visibility: hide the section per device (pure @media CSS) ------ */
  {
    name: "hideOnDesktop",
    type: "boolean",
    label: "Hide on desktop",
    default: false,
    help: "Remove this section on screens wider than the tablet breakpoint.",
    group: "Visibility",
  },
  {
    name: "hideOnTablet",
    type: "boolean",
    label: "Hide on tablet",
    default: false,
    help: "Remove this section at tablet widths.",
    group: "Visibility",
  },
  {
    name: "hideOnMobile",
    type: "boolean",
    label: "Hide on mobile",
    default: false,
    help: "Remove this section at mobile widths.",
    group: "Visibility",
  },

  /* --- Position: how the section box is placed ----------------------- */
  {
    name: "position",
    type: "choose",
    label: "Position",
    default: "default",
    group: "Position",
    options: [
      { label: "Default", value: "default", icon: "Square" },
      { label: "Relative", value: "relative", icon: "Move" },
      { label: "Absolute", value: "absolute", icon: "Move3d" },
      { label: "Fixed", value: "fixed", icon: "Pin" },
    ],
  },
  {
    name: "zIndex",
    type: "number",
    label: "Z-index",
    help: "Stacking order. Higher values sit on top.",
    group: "Position",
  },
  {
    name: "offsetX",
    type: "unitNumber",
    label: "Horizontal offset",
    units: ["px", "%", "rem", "em"],
    responsive: true,
    help: "Shift the section horizontally (uses the chosen position).",
    group: "Position",
  },
  {
    name: "offsetY",
    type: "unitNumber",
    label: "Vertical offset",
    units: ["px", "%", "rem", "em"],
    responsive: true,
    help: "Shift the section vertically (uses the chosen position).",
    group: "Position",
  },

  /* --- Motion: CSS-only transition / hover / sticky (Phase 6) -------- */
  /* Entrance-on-scroll (F3) is the ONE JS-assisted effect, and it is      */
  /* no-JS-safe by design: the hiding CSS only applies under `html.ff-io`, */
  /* a class added by the EntranceObserver client component on mount.      */
  {
    name: "transitionDuration",
    type: "unitNumber",
    label: "Transition duration",
    units: ["ms", "s"],
    help: "How long hover / state changes take to animate (e.g. 300ms).",
    group: "Motion",
  },
  {
    name: "hoverAnimation",
    type: "choose",
    label: "Hover animation",
    default: "none",
    group: "Motion",
    options: [
      { label: "None", value: "none", icon: "Ban" },
      { label: "Grow", value: "grow", icon: "Maximize2" },
      { label: "Shrink", value: "shrink", icon: "Minimize2" },
      { label: "Lift", value: "lift", icon: "ArrowUp" },
    ],
  },
  {
    name: "entranceAnimation",
    type: "choose",
    label: "Entrance animation",
    default: "none",
    help: "Animate the section in the first time it scrolls into view.",
    group: "Motion",
    options: [
      { label: "None", value: "none", icon: "Ban" },
      { label: "Fade", value: "fade", icon: "Eye" },
      { label: "Slide up", value: "slide-up", icon: "ArrowUp" },
      { label: "Zoom", value: "zoom", icon: "ZoomIn" },
    ],
  },
  {
    name: "entranceDuration",
    type: "unitNumber",
    label: "Entrance duration",
    units: ["ms", "s"],
    default: 600,
    help: "How long the entrance animation plays (default 600ms).",
    group: "Motion",
    hidden: (props) =>
      typeof props.entranceAnimation !== "string" ||
      props.entranceAnimation === "none" ||
      props.entranceAnimation === "",
  },
  {
    name: "sticky",
    type: "boolean",
    label: "Stick on scroll",
    default: false,
    help: "Pin the section as the page scrolls (CSS position:sticky). Ignored when Position is set.",
    group: "Motion",
  },
  {
    name: "stickyOffset",
    type: "unitNumber",
    label: "Sticky offset (top)",
    units: ["px", "rem", "em"],
    help: "Distance from the top of the viewport when stuck.",
    group: "Motion",
    hidden: (props) => props.sticky !== true,
  },

  /* --- Identity: anchor id + extra classes --------------------------- */
  {
    name: "anchorId",
    type: "text",
    label: "CSS ID / anchor",
    help: "Element id used for in-page anchor links (without the #).",
    group: "Identity",
  },
  {
    name: "cssClasses",
    type: "text",
    label: "CSS classes",
    help: "Space-separated extra classes added to the section wrapper.",
    group: "Identity",
  },

  /* --- Custom CSS: raw escape hatch ---------------------------------- */
  {
    name: "customCss",
    type: "code",
    label: "Custom CSS",
    rows: 8,
    help: "Scoped to this section. Use {{selector}} to target the wrapper.",
    group: "Custom CSS",
  },
]

/**
 * Fresh default value for the `block.advanced` bag. Advanced values are stored
 * as diffs only — nothing is pre-populated — so this returns an empty bag.
 */
export function defaultAdvanced(): Record<string, unknown> {
  return {}
}
