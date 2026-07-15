"use client"

/* ------------------------------------------------------------------ */
/* Palette icons (Composer W2)                                          */
/*                                                                     */
/* Small hand-authored inline-SVG glyphs (24x24 viewBox, stroke style,  */
/* currentColor) for the add-section palette and the widget picker —    */
/* no icon package. One flat map keyed by block_type / widget_type:     */
/* the two namespaces don't collide (rich_text vs text, image_with_text */
/* vs image, ...). Unknown types fall back to a plain square so a new   */
/* schema never renders blank.                                          */
/* ------------------------------------------------------------------ */

import React, { useState } from "react"

const ICONS: Record<string, React.ReactNode> = {
  /* ------------------------- section blocks ------------------------ */
  // layout grid — a frame split into columns
  container: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <line x1="9.5" y1="5" x2="9.5" y2="19" />
      <line x1="15.5" y1="5" x2="15.5" y2="19" />
    </>
  ),
  // slide with prev/next chevrons
  hero_slider: (
    <>
      <rect x="6.5" y="5" width="11" height="14" rx="1.5" />
      <polyline points="3.5 10 1.8 12 3.5 14" />
      <polyline points="20.5 10 22.2 12 20.5 14" />
    </>
  ),
  // 2x2 banner grid
  promo_banner_grid: (
    <>
      <rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="13" y="3.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="3.5" y="13" width="7.5" height="7.5" rx="1.5" />
      <rect x="13" y="13" width="7.5" height="7.5" rx="1.5" />
    </>
  ),
  // shopping cart
  product_tabs: (
    <>
      <path d="M3 4.5h2.2l2.3 10h10l2.5-7H6.2" />
      <circle cx="9.5" cy="18.5" r="1.5" />
      <circle cx="16.5" cy="18.5" r="1.5" />
    </>
  ),
  // percent — deal / discount
  deal_of_day: (
    <>
      <line x1="6" y1="18" x2="18" y2="6" />
      <circle cx="7.5" cy="7.5" r="2.5" />
      <circle cx="16.5" cy="16.5" r="2.5" />
    </>
  ),
  // showcase tiles (one tall + two small)
  category_showcase: (
    <>
      <rect x="3.5" y="4" width="7.5" height="16" rx="1.5" />
      <rect x="13.5" y="4" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13" width="7" height="7" rx="1.5" />
    </>
  ),
  // logo dots in a strip
  brand_strip: (
    <>
      <circle cx="5" cy="12" r="2.3" />
      <circle cx="12" cy="12" r="2.3" />
      <circle cx="19" cy="12" r="2.3" />
    </>
  ),
  // big T — rich text
  rich_text: (
    <>
      <path d="M5.5 7V5h13v2" />
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="9.5" y1="19" x2="14.5" y2="19" />
    </>
  ),
  // image frame beside text lines
  image_with_text: (
    <>
      <rect x="3" y="6" width="9" height="12" rx="1.5" />
      <line x1="15" y1="8.5" x2="21" y2="8.5" />
      <line x1="15" y1="12" x2="21" y2="12" />
      <line x1="15" y1="15.5" x2="19" y2="15.5" />
    </>
  ),
  // envelope
  newsletter: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <polyline points="3.5 7.5 12 13.5 20.5 7.5" />
    </>
  ),
  // camera (instagram)
  instagram_grid: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="4.5" />
      <circle cx="12" cy="12" r="3.5" />
      <line x1="16.8" y1="7.2" x2="16.9" y2="7.2" />
    </>
  ),
  // speech bubble with quote dashes
  testimonials: (
    <>
      <path d="M20 5H4v11h4v4l4-4h8z" />
      <line x1="8.5" y1="9" x2="10.5" y2="9" />
      <line x1="13.5" y1="9" x2="15.5" y2="9" />
    </>
  ),

  /* ----------------------------- widgets --------------------------- */
  // H glyph
  heading: (
    <>
      <line x1="6" y1="5" x2="6" y2="19" />
      <line x1="18" y1="5" x2="18" y2="19" />
      <line x1="6" y1="12" x2="18" y2="12" />
    </>
  ),
  // paragraph lines
  text: (
    <>
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="13" y2="17" />
    </>
  ),
  // image frame: sun + mountains
  image: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="10" r="1.5" />
      <path d="M5 17.5l4.5-4.5 3.5 3.5 3-3 4 4" />
    </>
  ),
  // pill button with label bar
  button: (
    <>
      <rect x="3" y="8" width="18" height="8" rx="4" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </>
  ),
  // vertical expand arrows
  spacer: (
    <>
      <line x1="12" y1="4" x2="12" y2="20" />
      <polyline points="8.5 7.5 12 4 15.5 7.5" />
      <polyline points="8.5 16.5 12 20 15.5 16.5" />
    </>
  ),
  // horizontal rule between faint content
  divider: (
    <>
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="8" y1="6.5" x2="16" y2="6.5" opacity={0.35} />
      <line x1="8" y1="17.5" x2="16" y2="17.5" opacity={0.35} />
    </>
  ),
  // play in a rounded frame
  video: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <polygon points="10 9 15.5 12 10 15" />
    </>
  ),
  // star
  icon: (
    <polygon points="12 4 14.3 9.2 20 9.9 15.8 13.6 17 19.2 12 16.4 7 19.2 8.2 13.6 4 9.9 9.7 9.2" />
  ),
  // code brackets
  html: (
    <>
      <polyline points="9 7.5 4.5 12 9 16.5" />
      <polyline points="15 7.5 19.5 12 15 16.5" />
    </>
  ),
}

/**
 * One palette glyph. `type` is a block_type or widget_type; unknown types
 * render a plain square (never blank). Inherits color via currentColor.
 */
export function PaletteIcon({
  type,
  size = 20,
  style,
}: {
  type: string
  size?: number
  style?: React.CSSProperties
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={style}
    >
      {ICONS[type] ?? <rect x="4" y="4" width="16" height="16" rx="2" />}
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/* UI chrome glyphs (Composer W4)                                       */
/*                                                                     */
/* Small utility icons for the editor chrome itself (toolbar buttons,   */
/* accordions, device toggle, status toast, chrome-region rows). Same   */
/* hand-authored stroke style as the palette set — no icon package.     */
/* ------------------------------------------------------------------ */

const UI_ICONS: Record<string, React.ReactNode> = {
  /* Added for the Studio design pass: every text glyph the editor used to
     draw (⠿ ⧉ ✕ ▤ ✎ ⇔ − ▾) is now a real 24-grid icon, so weight, optical
     size and alignment match the dashboard's icon set instead of inheriting
     whatever the system font felt like. */
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V6a2 2 0 0 1 2-2h9" />
    </>
  ),
  paste: (
    <>
      <path d="M9 4h6v3H9z" />
      <path d="M9 5.5H7a2 2 0 0 0-2 2V19a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7.5a2 2 0 0 0-2-2h-2" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
    </>
  ),
  template: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M9 9v11" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-3.5-3.5" />
    </>
  ),
  sparkles: (
    <>
      <path d="M12 4l1.4 3.6L17 9l-3.6 1.4L12 14l-1.4-3.6L7 9l3.6-1.4z" />
      <path d="M18 15l.7 1.8L20.5 17.5l-1.8.7L18 20l-.7-1.8L15.5 17.5l1.8-.7z" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="10" r="1.5" />
      <path d="M21 16l-5-5-4 4-2-2-4 4" />
    </>
  ),
  brush: (
    <>
      <path d="M14 4l6 6-8 8H6v-6z" />
      <path d="M12 6l6 6" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.5M12 18.5V21M4.2 7.5l2.2 1.2M17.6 15.3l2.2 1.2M4.2 16.5l2.2-1.2M17.6 8.7l2.2-1.2" />
    </>
  ),
  text: (
    <>
      <path d="M5 6h14M9 6v13M12 12h7M15 12v7" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4.5l3 1.8" />
    </>
  ),
  columns: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M9 5v14M15 5v14" />
    </>
  ),
  minus: <path d="M5 12h14" />,
  "chevron-down": <polyline points="6 9 12 15 18 9" />,
  "external-link": (
    <>
      <path d="M14 5h5v5" />
      <path d="M19 5l-8 8" />
      <path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
    </>
  ),
  "resize-h": (
    <>
      <path d="M8 8L4 12l4 4M16 8l4 4-4 4" />
      <path d="M4 12h16" />
    </>
  ),
  reset: (
    <>
      <path d="M4 12a8 8 0 1 0 2.6-5.9" />
      <polyline points="4 4 4 9 9 9" />
    </>
  ),
  "arrow-up": (
    <>
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="6 11 12 5 18 11" />
    </>
  ),
  "arrow-down": (
    <>
      <line x1="12" y1="5" x2="12" y2="19" />
      <polyline points="6 13 12 19 18 13" />
    </>
  ),
  "arrow-left": (
    <>
      <line x1="20" y1="12" x2="4" y2="12" />
      <polyline points="10 6 4 12 10 18" />
    </>
  ),
  x: (
    <>
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </>
  ),
  plus: (
    <>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </>
  ),
  duplicate: (
    <>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </>
  ),
  // single down chevron — rotate in CSS for open/closed accordions
  chevron: <polyline points="6 9 12 15 18 9" />,
  undo: (
    <>
      <polyline points="9 14 4 9 9 4" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H12" />
    </>
  ),
  redo: (
    <>
      <polyline points="15 14 20 9 15 4" />
      <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H12" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  monitor: (
    <>
      <rect x="2.5" y="4" width="19" height="13" rx="2" />
      <line x1="9" y1="20.5" x2="15" y2="20.5" />
      <line x1="12" y1="17" x2="12" y2="20.5" />
    </>
  ),
  tablet: (
    <>
      <rect x="4.5" y="3" width="15" height="18" rx="2.5" />
      <line x1="11" y1="17.5" x2="13" y2="17.5" />
    </>
  ),
  phone: (
    <>
      <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
      <line x1="11" y1="18.5" x2="13" y2="18.5" />
    </>
  ),
  // side panel (collapse/expand the editing panel)
  panel: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="15" y1="4" x2="15" y2="20" />
    </>
  ),
  check: <polyline points="4.5 12.5 9.5 17.5 19.5 7" />,
  alert: (
    <>
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="7.5" x2="12" y2="13" />
      <line x1="12" y1="16.4" x2="12.01" y2="16.4" />
    </>
  ),
  // 2x3 drag-grip dots (filled)
  grip: (
    <g fill="currentColor" stroke="none">
      <circle cx="9" cy="6" r="1.6" />
      <circle cx="15" cy="6" r="1.6" />
      <circle cx="9" cy="12" r="1.6" />
      <circle cx="15" cy="12" r="1.6" />
      <circle cx="9" cy="18" r="1.6" />
      <circle cx="15" cy="18" r="1.6" />
    </g>
  ),
  /* chrome-region rows */
  topbar: (
    <>
      <rect x="3" y="4.5" width="18" height="15" rx="2" />
      <line x1="3" y1="8" x2="21" y2="8" />
    </>
  ),
  header: (
    <>
      <rect x="3" y="4.5" width="18" height="15" rx="2" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="6" y1="7.2" x2="10" y2="7.2" />
    </>
  ),
  footer: (
    <>
      <rect x="3" y="4.5" width="18" height="15" rx="2" />
      <line x1="3" y1="15" x2="21" y2="15" />
    </>
  ),
  theme: (
    <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z" />
  ),
}

/**
 * One editor-chrome glyph (toolbars, accordions, toasts). Unknown names
 * render a plain square, never blank. Inherits color via currentColor.
 */
export function UiIcon({
  name,
  size = 14,
  strokeWidth = 1.6,
  style,
}: {
  name: string
  size?: number
  strokeWidth?: number
  style?: React.CSSProperties
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={style}
    >
      {UI_ICONS[name] ?? <rect x="4" y="4" width="16" height="16" rx="2" />}
    </svg>
  )
}

/**
 * Compact square icon button with a proper aria-label, hover state and an
 * optional danger (red) or dark (light-on-dark, for the branded header)
 * variant. Pure presentation — callers own the click behavior.
 */
export function IconButton({
  icon,
  label,
  onClick,
  disabled = false,
  danger = false,
  dark = false,
  size = 26,
  iconSize = 14,
  style,
}: {
  icon: string
  label: string
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
  disabled?: boolean
  danger?: boolean
  dark?: boolean
  size?: number
  iconSize?: number
  style?: React.CSSProperties
}) {
  const [hover, setHover] = useState(false)
  const lit = hover && !disabled
  const variant: React.CSSProperties = dark
    ? {
        border: "1px solid rgba(255,255,255,0.16)",
        background: lit ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.07)",
        color: "#e5e7eb",
      }
    : {
        border: `1px solid ${danger ? "#fecaca" : "#e5e7eb"}`,
        background: lit ? (danger ? "#fef2f2" : "#f3f4f6") : "#fff",
        color: danger ? "#b91c1c" : "#374151",
      }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...variant,
        width: size,
        height: size,
        borderRadius: 6,
        padding: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.35 : 1,
        flexShrink: 0,
        transition: "background .12s, border-color .12s",
        ...style,
      }}
    >
      <UiIcon name={icon} size={iconSize} />
    </button>
  )
}
