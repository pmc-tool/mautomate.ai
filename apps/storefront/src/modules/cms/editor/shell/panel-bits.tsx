"use client"

/* ------------------------------------------------------------------ */
/* Shell panel bits (ARCH-CANVAS P8, seat 6C — composition root).       */
/*                                                                      */
/* Presentation-only pieces moved VERBATIM out of the shell monolith:   */
/* the ChromeRow list row, the ClipStrip copy/paste/reset strip, the    */
/* shared panel style constants and the device-preview constants. No    */
/* behavior, markup or style change — a move, not a rewrite.            */
/* ------------------------------------------------------------------ */

import React, { useState } from "react"

import { UiIcon } from "@modules/cms/editor/palette-icons"
import {
  accent,
  button,
  field,
  font,
  grey,
  hairline,
  hairlineDark,
  ink,
  motion,
  radius,
  semantic,
  type,
} from "@modules/cms/editor/design"

export function ChromeRow({
  icon,
  label,
  onClick,
}: {
  icon: string
  label: string
  onClick: () => void
}) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...type.body,
        fontFamily: font,
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        textAlign: "left",
        padding: "8px 10px",
        margin: "4px 0",
        border: `1px solid ${hover ? grey[30] : grey[20]}`,
        borderRadius: radius.md,
        background: hover ? grey[5] : grey[0],
        cursor: "pointer",
        color: grey[90],
        transition: `background ${motion.fast}, border-color ${motion.fast}`,
      }}
    >
      <span
        aria-hidden
        style={{
          color: hover ? accent.base : grey[50],
          display: "inline-flex",
          flexShrink: 0,
          transition: `color ${motion.fast}`,
        }}
      >
        <UiIcon name={icon} size={16} strokeWidth={1.7} />
      </span>
      {label}
    </button>
  )
}

/**
 * The Copy/Paste/Reset style strip — the same three buttons in EVERY panel
 * mode (section, widget, element, header/footer, header/footer element), all
 * talking to the one shared clipboard. It used to exist only for sections;
 * an element's look could not be copied from the panel at all.
 */
export function ClipStrip({
  onCopy,
  onPaste,
  onReset,
  canPaste,
}: {
  onCopy: () => void
  onPaste: () => void
  onReset: () => void
  canPaste: boolean
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 6,
        margin: "8px 0 12px",
        paddingBottom: 12,
        borderBottom: hairline,
      }}
    >
      <button
        onClick={onCopy}
        title="Copy this item's Style + Advanced settings"
        style={styleActionBtn}
      >
        <UiIcon name="copy" size={13} />
        Copy style
      </button>
      <button
        onClick={onPaste}
        disabled={!canPaste}
        title={
          canPaste
            ? "Paste the copied Style + Advanced onto this item"
            : "Copy a style first"
        }
        style={{
          ...styleActionBtn,
          opacity: canPaste ? 1 : 0.4,
          cursor: canPaste ? "pointer" : "not-allowed",
        }}
      >
        <UiIcon name="paste" size={13} />
        Paste style
      </button>
      <button
        onClick={onReset}
        title="Clear all Style + Advanced settings on this item"
        style={{
          ...styleActionBtn,
          color: semantic.dangerFg,
          borderColor: semantic.dangerBorder,
        }}
      >
        <UiIcon name="reset" size={13} />
        Reset style
      </button>
    </div>
  )
}

/** "← Elements" / "← Back to Container" — the panel's only text links. */
export const backLink: React.CSSProperties = {
  ...button("ghost", "sm"),
  height: "auto",
  padding: 0,
  marginBottom: 6,
  ...type.label,
  fontFamily: font,
  color: accent.base,
  background: "none",
}

// Compact buttons for the Copy/Paste/Reset/preset style toolbar (P6).
export const styleActionBtn: React.CSSProperties = {
  ...button("secondary", "sm"),
  ...type.label,
  fontFamily: font,
  height: 26,
  padding: "0 8px",
  color: grey[70],
}

export const presetSelect: React.CSSProperties = {
  ...field(),
  ...type.label,
  fontFamily: font,
  width: "auto",
  height: 26,
  padding: "0 6px",
  color: grey[70],
  cursor: "pointer",
  maxWidth: 120,
}

/* Responsive-preview device widths (px). Desktop is unconstrained (full). */
export const DEVICE_WIDTH: Record<"desktop" | "tablet" | "mobile", number> = {
  desktop: 0,
  tablet: 820,
  mobile: 390,
}

export const DEVICES: {
  id: "desktop" | "tablet" | "mobile"
  icon: string
  title: string
}[] = [
  { id: "desktop", icon: "monitor", title: "Desktop — full width" },
  { id: "tablet", icon: "tablet", title: "Tablet — 820px" },
  { id: "mobile", icon: "phone", title: "Mobile — 390px" },
]

/** A control on the dark ink chrome (top strip, panel footer). */
export const deviceBtn: React.CSSProperties = {
  ...button("ghost", "sm"),
  border: hairlineDark,
  background: ink.raised,
  color: ink.text,
}
