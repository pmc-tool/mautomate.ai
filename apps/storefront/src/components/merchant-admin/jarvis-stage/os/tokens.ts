/* ------------------------------------------------------------------ */
/* Pixi OS — surface tokens. LIGHT is the committed default theme.    */
/*                                                                     */
/* The OS is a LIGHT premium surface: a warm near-white field, frosted    */
/* white glass cards with hairline borders and soft warm shadows, ink text  */
/* and chrome, one ember signal. It mirrors design.ts (ink #0F1319, ember     */
/* #F26522, Inter, the grey ramp, radius/shadow/motion) — never hardcode a     */
/* hex in a component; import from here.                                        */
/*                                                                            */
/* Theme-capable: `lightTheme` / `darkTheme` share ONE shape; `os` is the      */
/* active palette and defaults to LIGHT. A future toggle can swap `os` to        */
/* darkTheme without touching a single consumer — every component reads `os`.     */
/* ------------------------------------------------------------------ */

import type { CSSProperties } from "react"
import {
  accent,
  ink,
  grey,
  radius,
  shadow,
  motion,
  ease,
  font,
  type as dtype,
  semantic,
} from "@modules/cms/editor/design"

export type OSPalette = {
  /** Full-bleed backdrop behind the core. */
  bg: string
  /** Warm signal (brand ember). */
  ember: string
  emberSoft: string
  emberRing: string
  emberHover: string
  /** Deep ember for signal lines / glow so they read on a light field. */
  emberDeep: string
  /** Cool accent — reserved for "listening / merchant input". */
  cyan: string
  /** Primary text / chrome. */
  text: string
  textDim: string
  muted: string
  faint: string
  danger: string
  successFg: string
  /** Card glass. */
  glass: string
  glassSolid: string
  glassRaised: string
  /** Hairlines. */
  hairline: string
  hairlineStrong: string
  emberHairline: string
  emberHairlineFocus: string
  blur: string
  /** Soft warm shadows for glass. */
  cardShadow: string
  cardShadowFocus: string
}

/* ---------------- LIGHT (default, committed) ---------------- */
export const lightTheme: OSPalette = {
  bg: "#F6F5F3", // warm near-white
  ember: accent.base, // #F26522
  emberSoft: accent.soft, // rgba(242,101,34,0.10)
  emberRing: accent.ring, // rgba(242,101,34,0.28)
  emberHover: accent.hover,
  emberDeep: "#E24E12",
  cyan: "#0E8FA6", // deeper teal — readable on light
  text: ink.base, // #0F1319
  textDim: grey[80], // #1F2937
  muted: grey[50], // #6B7280
  faint: grey[40], // #9CA3AF
  danger: semantic.dangerFg, // #B42318
  successFg: semantic.successFg, // #067647
  glass: "rgba(255,255,255,0.74)",
  glassSolid: "rgba(255,255,255,0.97)",
  glassRaised: "rgba(255,255,255,0.9)",
  hairline: "rgba(15,19,25,0.09)",
  hairlineStrong: "rgba(15,19,25,0.16)",
  emberHairline: "rgba(242,101,34,0.24)",
  emberHairlineFocus: "rgba(242,101,34,0.6)",
  blur: "blur(16px)",
  cardShadow: "0 8px 28px rgba(31,26,20,0.10), 0 1px 2px rgba(31,26,20,0.05)",
  cardShadowFocus:
    "0 16px 44px rgba(226,78,18,0.16), 0 2px 6px rgba(31,26,20,0.08)",
}

/* ---------------- DARK (available via future toggle; NOT default) ---------------- */
export const darkTheme: OSPalette = {
  bg: "#07090D",
  ember: accent.base,
  emberSoft: accent.soft,
  emberRing: accent.ring,
  emberHover: accent.hover,
  emberDeep: "#FFB067",
  cyan: "#4DD8E6",
  text: "#F5F1EC",
  textDim: ink.text,
  muted: ink.muted,
  faint: "rgba(155,163,175,0.55)",
  danger: "#E0645E",
  successFg: "#5FD39A",
  glass: "rgba(15,19,25,0.72)",
  glassSolid: "rgba(19,24,32,0.94)",
  glassRaised: "rgba(23,28,36,0.86)",
  hairline: "rgba(255,255,255,0.08)",
  hairlineStrong: "rgba(255,255,255,0.14)",
  emberHairline: "rgba(242,101,34,0.22)",
  emberHairlineFocus: "rgba(242,101,34,0.55)",
  blur: "blur(14px)",
  cardShadow: "0 12px 40px rgba(0,0,0,0.45)",
  cardShadowFocus: "0 18px 60px rgba(0,0,0,0.55), 0 0 34px rgba(242,101,34,0.22)",
}

/** The ACTIVE palette. Light is the committed default. */
export const os: OSPalette = lightTheme

export { radius, shadow, motion, ease, font, dtype as type, semantic, accent, ink, grey }

/** A frosted light-glass card surface. `focus` warms the ember hairline + glow. */
export function glassSurface(focus = false): CSSProperties {
  return {
    background: focus ? os.glassRaised : os.glass,
    border: `1px solid ${focus ? os.emberHairlineFocus : os.hairline}`,
    borderRadius: radius.lg,
    backdropFilter: os.blur,
    WebkitBackdropFilter: os.blur,
    boxShadow: focus ? os.cardShadowFocus : os.cardShadow,
    color: os.textDim,
  }
}

/** A light chip (dock pills, family tabs, suggestion chips). */
export function osChip(active = false): CSSProperties {
  return {
    ...dtype.label,
    fontFamily: font,
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    minHeight: 40, // touch target
    padding: "0 13px",
    borderRadius: radius.pill,
    background: active ? os.emberSoft : os.glass,
    border: `1px solid ${active ? os.emberHairlineFocus : os.hairline}`,
    color: active ? accent.active : os.textDim,
    cursor: "pointer",
    whiteSpace: "nowrap",
    boxShadow: active ? "none" : "0 1px 2px rgba(31,26,20,0.05)",
    transition: `background ${motion.fast}, border-color ${motion.fast}, color ${motion.fast}, transform ${motion.fast}, box-shadow ${motion.fast}`,
  }
}

/** A light icon button (header controls: minimize/dismiss/close). */
export function osIconButton(size = 30): CSSProperties {
  return {
    width: size,
    height: size,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    border: `1px solid ${os.hairline}`,
    background: os.glass,
    color: os.muted,
    cursor: "pointer",
    flex: "0 0 auto",
    transition: `background ${motion.fast}, border-color ${motion.fast}, color ${motion.fast}`,
  }
}

/** Status badge tone by card lifecycle — readable on the light field. */
export function statusTone(kind: "run" | "ok" | "warn" | "error" | "idle"): {
  fg: string
  bg: string
  border: string
} {
  switch (kind) {
    case "run":
      return { fg: accent.active, bg: os.emberSoft, border: os.emberHairlineFocus }
    case "ok":
      return {
        fg: semantic.successFg,
        bg: semantic.successBg,
        border: semantic.successBorder,
      }
    case "warn":
      return { fg: semantic.warnFg, bg: semantic.warnBg, border: semantic.warnBorder }
    case "error":
      return {
        fg: semantic.dangerFg,
        bg: semantic.dangerBg,
        border: semantic.dangerBorder,
      }
    default:
      return { fg: os.muted, bg: os.glass, border: os.hairline }
  }
}
