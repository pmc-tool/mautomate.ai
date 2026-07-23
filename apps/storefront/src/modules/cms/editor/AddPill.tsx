"use client"

/**
 * AddPill — THE create affordance.
 *
 * Ember creates what doesn't exist: every "add something here" control on
 * the canvas is this one component. It replaces the three visually different
 * implementations the canvas grew this session:
 *
 *   1. the local `AddPill` in editor-canvas/[slug]/page.tsx (~427-486):
 *      a 26px labeled pill with a 22px "compact" circle variant,
 *   2. the seam `dot()` factory in `SectionInsertBar` (~677-691): 22px
 *      circles, one ember and one GREY — a manipulate-family colour on a
 *      create affordance, which the ink/ember rule forbids,
 *   3. the dead `zoneBtn` 40px circle (~399-410), deleted outright.
 *
 * Two variants, both metricated by `overlay` in design.ts and nothing else:
 *
 *   - "pill"  the labeled pill (overlay.pill: 24px, radius.pill, ember)
 *   - "dot"   the circular "+" (overlay.dot: 22px circle)
 *
 * The old compact pill is deliberately gone — one pill size, ever.
 *
 * `context` names WHAT the affordance creates. It picks the default glyph
 * and label so call sites say what they mean ("add a widget to this
 * column") instead of restating presentation; explicit `label`/`icon`
 * override it when copy must be more specific. Colour is NOT a parameter:
 * create affordances are ember. Full stop.
 *
 * Positioning: pass `anchor` to render fixed, centered on that viewport
 * point (empty-column pills, section-rail dots). Omit it for a static
 * inline pill inside overlay-owned flex rows (the seam bar). Either way
 * `data-cms-overlay="1"` marks it as editor chrome: the canvas hover logic
 * ignores it, and it can never reach the published page.
 */

import React, { useState } from "react"
import { font, type, overlay, zLayer } from "./design"
import { UiIcon } from "./palette-icons"

/* ------------------------------ types ------------------------------ */

export type AddPillContext = "widget" | "section" | "container" | "template"

export interface AddPillProps {
  /** What gets created. Picks the default icon + label. */
  context: AddPillContext
  /** Labeled pill (default) or circular "+" dot. */
  variant?: "pill" | "dot"
  /** Pill only. Defaults from `context`; pass to sharpen the copy. */
  label?: string
  /** Tooltip / aria-label. Always required — a dot says nothing else. */
  title: string
  onSelect: () => void
  /** Viewport point to center on (position: fixed). Omit for inline flow. */
  anchor?: { top: number; left: number }
  /** Stacking level when anchored. Defaults to zLayer.canvasPill; pass
      another zLayer token if needed — never a literal. */
  z?: number
  disabled?: boolean
}

const CONTEXT_ICON: Record<AddPillContext, string> = {
  widget: "plus",
  section: "plus",
  container: "plus",
  template: "template",
}

const CONTEXT_LABEL: Record<AddPillContext, string> = {
  widget: "Add widget",
  section: "Add section",
  container: "Add container",
  template: "Insert template",
}

/* ------------------------------ pill ------------------------------ */

export default function AddPill({
  context,
  variant = "pill",
  label,
  title,
  onSelect,
  anchor,
  z = zLayer.canvasPill,
  disabled,
}: AddPillProps) {
  const [hot, setHot] = useState(false)
  const dot = variant === "dot"
  const icon = CONTEXT_ICON[context]
  const text = dot ? undefined : label ?? CONTEXT_LABEL[context]

  return (
    <button
      type="button"
      data-cms-overlay="1"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onSelect()
      }}
      onMouseEnter={() => setHot(true)}
      onMouseLeave={() => setHot(false)}
      style={{
        ...type.label,
        fontFamily: font,
        fontWeight: 600,
        ...(anchor
          ? {
              position: "fixed" as const,
              top: anchor.top,
              left: anchor.left,
              transform: "translate(-50%, -50%)",
              zIndex: z,
            }
          : null),
        height: dot ? overlay.dot.size : overlay.pill.height,
        width: dot ? overlay.dot.size : undefined,
        padding: dot ? 0 : overlay.pill.padding,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: overlay.pill.gap,
        border: 0,
        borderRadius: dot ? overlay.dot.radius : overlay.pill.radius,
        // Quiet until you mean it: rest is the base ember, hover commits.
        // Never a second hue — ember creates, and only ember creates.
        background:
          hot && !disabled ? overlay.pill.hoverBg : overlay.pill.bg,
        color: overlay.pill.color,
        boxShadow:
          hot && !disabled ? overlay.pill.hoverShadow : overlay.pill.shadow,
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "default" : "pointer",
        pointerEvents: "auto",
        whiteSpace: "nowrap",
        transition: `background ${overlay.motion.show}, box-shadow ${overlay.motion.show}`,
      }}
    >
      <UiIcon name={icon} size={dot ? overlay.dot.icon : overlay.pill.icon} />
      {text}
    </button>
  )
}
