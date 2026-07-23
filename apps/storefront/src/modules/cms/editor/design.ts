/* ------------------------------------------------------------------ */
/* mAutomate Studio — the ONE design language.                          */
/*                                                                     */
/* The editor and the merchant dashboard used to look like two products */
/* from two companies: the dashboard is Inter on a cool-grey ramp with   */
/* an ink-black primary; the editor was system-ui with EIGHT corner radii,*/
/* NINE font sizes and THREE competing accents — magenta (#d004d4), blue */
/* (#2563eb) and #93003f, which is Elementor's own brand maroon. Nothing  */
/* anywhere used mAutomate's actual brand colour.                        */
/*                                                                     */
/* So: one ramp, one scale, one accent. The neutrals are EXACTLY the      */
/* dashboard's grey ramp (same hexes it already ships), so the two        */
/* surfaces are literally built from the same material. The accent is     */
/* the brand's ember orange, spent sparingly — on the thing you are       */
/* touching right now and nothing else. That restraint IS the identity:   */
/* quiet ink chrome, hairline structure, one warm signal.                 */
/* ------------------------------------------------------------------ */

import type { CSSProperties } from "react"

/* ---------------- Neutrals: the dashboard's own ramp ---------------- */
export const grey = {
  0: "#FFFFFF",
  5: "#F9FAFB",
  10: "#F3F4F6",
  20: "#E5E7EB",
  30: "#D1D5DB",
  40: "#9CA3AF",
  50: "#6B7280",
  60: "#4B5563",
  70: "#374151",
  80: "#1F2937",
  90: "#111827",
} as const

/* Ink — the dark chrome (top bar, panel header, canvas chips). One value,
   not the four near-blacks the editor used to mix (#26292c, #0c0d0e, #1f2124,
   #000). Slightly deeper than grey-90 so dark UI sits BEHIND content. */
export const ink = {
  base: "#0F1319",
  raised: "#171C24",
  hairline: "#242A33",
  text: "#E7EAEE",
  muted: "#9BA3AF",
} as const

/* ---------------- Accent: mAutomate ember (the brand) ---------------- */
export const accent = {
  base: "#F26522",
  hover: "#E05A1A",
  active: "#C94D12",
  /** Backgrounds for selected rows / active tabs — warm, never loud. */
  tint: "#FEF1EA",
  tintStrong: "#FBDCC9",
  /** Focus ring + selection glow. */
  ring: "rgba(242, 101, 34, 0.28)",
  soft: "rgba(242, 101, 34, 0.10)",
  /** On-ember foreground. */
  on: "#FFFFFF",
} as const

/* ---------------- Semantic ---------------- */
export const semantic = {
  successFg: "#067647",
  successBg: "#ECFDF3",
  successBorder: "#ABEFC6",
  dangerFg: "#B42318",
  dangerBg: "#FEF3F2",
  dangerBorder: "#FECDCA",
  warnFg: "#B54708",
  warnBg: "#FFFAEB",
  warnBorder: "#FEDF89",
  infoFg: "#175CD3",
  infoBg: "#EFF8FF",
} as const

/* ---------------- Type: one family, one scale ----------------
   Inter, matching the dashboard exactly. Six sizes — not nine. */
export const font =
  "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"

export const type = {
  /** Eyebrow / section label. Uppercase, tracked — the editorial signature. */
  micro: {
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: "0.07em",
    textTransform: "uppercase",
    lineHeight: 1.4,
  } as CSSProperties,
  /** Field labels, chips, hints. */
  label: { fontSize: 12, fontWeight: 500, lineHeight: 1.45 } as CSSProperties,
  /** Body — the workhorse. */
  body: { fontSize: 13, fontWeight: 400, lineHeight: 1.55 } as CSSProperties,
  bodyStrong: { fontSize: 13, fontWeight: 500, lineHeight: 1.55 } as CSSProperties,
  /** Panel / card titles. */
  title: {
    fontSize: 14,
    fontWeight: 600,
    lineHeight: 1.4,
    letterSpacing: "-0.006em",
  } as CSSProperties,
  /** Page / modal titles. */
  heading: {
    fontSize: 18,
    fontWeight: 600,
    lineHeight: 1.3,
    letterSpacing: "-0.012em",
  } as CSSProperties,
} as const

/* ---------------- Shape, depth, motion ---------------- */
export const radius = { sm: 4, md: 6, lg: 10, pill: 999 } as const

export const shadow = {
  xs: "0 1px 2px rgba(16, 24, 40, 0.05)",
  sm: "0 2px 6px rgba(16, 24, 40, 0.08)",
  md: "0 8px 24px rgba(16, 24, 40, 0.12)",
  lg: "0 20px 48px rgba(16, 24, 40, 0.16)",
  /** Floating chips over the canvas — dark UI needs a deeper shadow. */
  chip: "0 2px 8px rgba(15, 19, 25, 0.28)",
} as const

export const ease = "cubic-bezier(0.2, 0.8, 0.2, 1)"
export const motion = {
  fast: `120ms ${ease}`,
  base: `160ms ${ease}`,
  slow: `240ms ${ease}`,
} as const

export const focusRing = `0 0 0 3px ${accent.ring}`

/* ---------------- Primitive styles ----------------
   Every button, field, chip and menu row in the editor comes from HERE, so
   there is no second opinion about what a 32px control looks like. */

type Tone = "primary" | "secondary" | "ghost" | "danger" | "accent"
type Size = "sm" | "md"

const HEIGHT: Record<Size, number> = { sm: 28, md: 32 }

export function button(tone: Tone = "secondary", size: Size = "md"): CSSProperties {
  const base: CSSProperties = {
    ...type.bodyStrong,
    fontFamily: font,
    height: HEIGHT[size],
    padding: size === "sm" ? "0 10px" : "0 14px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: radius.md,
    border: "1px solid transparent",
    cursor: "pointer",
    whiteSpace: "nowrap",
    transition: `background ${motion.fast}, border-color ${motion.fast}, color ${motion.fast}, box-shadow ${motion.fast}`,
  }
  switch (tone) {
    case "primary":
      return { ...base, background: grey[90], color: "#fff" }
    case "accent":
      return { ...base, background: accent.base, color: accent.on }
    case "danger":
      return {
        ...base,
        background: "#fff",
        color: semantic.dangerFg,
        borderColor: semantic.dangerBorder,
      }
    case "ghost":
      return { ...base, background: "transparent", color: grey[70] }
    default:
      return {
        ...base,
        background: "#fff",
        color: grey[90],
        borderColor: grey[30],
      }
  }
}

/** Square icon-only control (toolbars, panel headers). */
export function iconButton(size: Size = "md", dark = false): CSSProperties {
  const s = HEIGHT[size]
  return {
    width: s,
    height: s,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    border: `1px solid ${dark ? ink.hairline : grey[20]}`,
    background: dark ? "rgba(255,255,255,0.04)" : "#fff",
    color: dark ? ink.text : grey[70],
    cursor: "pointer",
    transition: `background ${motion.fast}, border-color ${motion.fast}, color ${motion.fast}`,
  }
}

/** Text input / select — one look, everywhere. */
export function field(): CSSProperties {
  return {
    ...type.body,
    fontFamily: font,
    width: "100%",
    height: 32,
    padding: "0 10px",
    color: grey[90],
    background: "#fff",
    border: `1px solid ${grey[30]}`,
    borderRadius: radius.md,
    outline: "none",
    transition: `border-color ${motion.fast}, box-shadow ${motion.fast}`,
  }
}

/** A surface: panel card, popover, menu. */
export function surface(elevated: keyof typeof shadow | null = null): CSSProperties {
  return {
    background: "#fff",
    border: `1px solid ${grey[20]}`,
    borderRadius: radius.lg,
    ...(elevated ? { boxShadow: shadow[elevated] } : {}),
  }
}

/** Dark chip floating over the canvas (section label, toolbar, badges). */
export function chip(): CSSProperties {
  return {
    ...type.label,
    fontFamily: font,
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    height: 26,
    padding: "0 8px",
    borderRadius: radius.md,
    background: ink.base,
    color: ink.text,
    boxShadow: shadow.chip,
    whiteSpace: "nowrap",
  }
}

/** One row in a dropdown / context menu. */
export function menuItem(state: {
  disabled?: boolean
  danger?: boolean
} = {}): CSSProperties {
  return {
    ...type.body,
    fontFamily: font,
    display: "flex",
    width: "100%",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    height: 30,
    padding: "0 10px",
    border: 0,
    borderRadius: radius.sm,
    background: "none",
    textAlign: "left",
    cursor: state.disabled ? "default" : "pointer",
    color: state.disabled
      ? grey[40]
      : state.danger
        ? semantic.dangerFg
        : grey[80],
    transition: `background ${motion.fast}`,
  }
}

/** The uppercase eyebrow above a group of controls. */
export function eyebrow(): CSSProperties {
  return { ...type.micro, fontFamily: font, color: grey[50] }
}

/** Hairline divider — the structural grammar of both surfaces. */
export const hairline = `1px solid ${grey[20]}`
export const hairlineDark = `1px solid ${ink.hairline}`

/* ---------------- Canvas selection language ----------------
   Sections, elements and widgets are all "the thing you are touching", so
   they share ONE colour (the ember) and differ only in weight. The old
   editor used a different pink for each, which read as decoration rather
   than meaning. */
export const canvas = {
  hover: `1px solid ${accent.tintStrong}`,
  hoverStrong: `1px solid ${accent.base}`,
  selected: `2px solid ${accent.base}`,
  /* 6C: `dropLine` deleted with the 2px indicator it colored (3A moved
     drops to the in-flow placeholder + dropFill outline). */
  dropFill: accent.soft,
} as const

/* ---------------- Overlay affordances: the ONE metric spec ----------------
   Every floating control the canvas draws over the merchant's page — the
   section toolbar, the widget chip, name badges, seam dots, add pills, the
   font handle — comes from HERE. Before this block existed, same-rank
   affordances shipped at five heights (22/24/26/28/30), three radius
   treatments (md, pill, and one asymmetric "0 0 6px 0" corner that read as
   a rendering bug) and three shadows. Each felt like a different product.

   The semantic rule that ends the two-colour confusion:

       INK MANIPULATES WHAT EXISTS. EMBER CREATES WHAT DOESN'T.

   Toolbars, name badges, drag grips and the font handle act on things
   already on the page — they are ink chips. Insertion affordances (seam
   dots, add pills, "+ Add widget") bring new things into being — they are
   ember pills. Two families, one metric system, and deliberately NO third
   size anywhere: the old 22px "compact" pill is dead, section toolbars
   come down from 30 and widget toolbars up from 26 to the one 28px rank
   (they are the same rank; Elementor uses one handle style for both). */
export const overlay = {
  /** The manipulate family's surfaces: the dark chip over content. */
  ink: { bg: ink.base, fg: ink.text, muted: ink.muted } as const,
  /** The create family's surfaces: brand ember, white foreground. */
  ember: {
    bg: accent.base,
    hover: accent.hover,
    on: accent.on,
  } as const,
  /** Node toolbars — section, widget and column alike. ONE height, ONE
      radius, ONE shadow; only which actions render may differ per node. */
  toolbar: {
    height: 28,
    padding: "0 4px",
    gap: 2,
    radius: radius.md,
    bg: ink.base,
    shadow: shadow.chip,
    /** The square controls inside a toolbar (buttons and drag grips). */
    btn: { size: 22, radius: radius.sm, icon: 14 },
  } as const,
  /** Name/status badges (section label, element brush badge, "Hidden on
      mobile"). Symmetric radius on purpose — see the block comment. */
  badge: {
    height: 20,
    padding: "0 6px",
    radius: radius.sm,
    bg: ink.base,
    color: ink.muted,
    icon: 13,
  } as const,
  /** The labeled ember pill ("Add widget"). Rest = sm shadow; hover
      commits to the hover ember + md shadow. Never a second size. */
  pill: {
    height: 24,
    padding: "0 10px 0 8px",
    gap: 5,
    radius: radius.pill,
    bg: accent.base,
    hoverBg: accent.hover,
    color: accent.on,
    shadow: shadow.sm,
    hoverShadow: shadow.md,
    icon: 14,
  } as const,
  /** The circular "+" (seam dots and the dot-variant AddPill). */
  dot: { size: 22, radius: radius.pill, icon: 14 } as const,
  /** Floating panels the overlays open — widget picker, context menu,
      the seam's structure popover. Light surface, the deep shadow. */
  popover: { radius: radius.lg, shadow: shadow.lg, padding: 8, bg: grey[0] } as const,
  /** How overlays arrive: a fast fade + 4px rise; expansion (popovers,
      pickers growing content) takes the base duration. */
  motion: {
    show: motion.fast,
    expand: motion.base,
    ease,
    enterTransform: "translateY(4px)",
  } as const,
} as const

/* ---------------- Stacking: every layer has a NAME ----------------
   The canvas used to stack its overlays with nine magic near-MAX_INT
   literals (2147482000 … 2147483401) and the shell modules with a second,
   uncoordinated set (5, 50, 10000, 10001, 10020, 100000). This scale is
   the complete editor stacking order; NOTHING may ship a raw zIndex again.

   Canvas layers keep the near-MAX_INT band because they live inside the
   theme's iframe and must beat arbitrary theme CSS. Shell layers live in a
   small human band because the shell owns its own stacking context. The
   order encodes intent: content < outlines < seams < toolbars < pills <
   drop indicators < menus < pickers — the thing you are actively using
   always sits above the thing merely offered.

   A scrim-and-panel pair (context menu, widget picker) puts the scrim at
   the layer value and the panel one above it — use zAbove(). */
export const zLayer = {
  /** The merchant's page itself — everything else only annotates it. */
  canvasContent: 0,
  /** Selection / hover outline boxes (drawn by the overlay layer). */
  canvasOutline: 2147481000,
  /** Section seam bars + passive fixed badges ("Hidden on mobile"). */
  canvasSeam: 2147482000,
  /** Node toolbars and name badges — section, widget, column alike. */
  canvasToolbar: 2147483000,
  /** Point affordances that must clear a toolbar they graze: ember add
      pills, the element badge, the font handle. */
  canvasPill: 2147483100,
  /** Drag-drop indicators: drop line, drop-column highlight, their labels. */
  canvasIndicator: 2147483200,
  /** The right-click context menu (scrim + panel via zAbove). */
  canvasMenu: 2147483300,
  /** The in-canvas widget picker — the topmost canvas surface. */
  canvasPicker: 2147483400,
  /** Shell: slide-over panels (AI panel, revisions, template library). */
  shellPanel: 10000,
  /** Shell: modal dialogs and the command palette. */
  shellModal: 10010,
  /** Shell: pickers that must open above a modal (media, video). */
  shellPicker: 10020,
  /** Shell: toasts — above everything the shell shows. */
  shellToast: 10030,
} as const

/** The panel of a scrim-and-panel pair sits one step above its scrim. */
export const zAbove = (z: number): number => z + 1
