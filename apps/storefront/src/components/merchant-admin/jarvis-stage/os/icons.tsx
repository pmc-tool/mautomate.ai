"use client"

/* ------------------------------------------------------------------ */
/* Pixi OS — inline stroke icon set (NO emoji, no dependencies).      */
/*                                                                     */
/* One <Icon name=… /> component renders a 24x24 stroke glyph. The card  */
/* registry references icons by NAME (a string union), so registering a   */
/* tool never needs a component import. Add a glyph here, add its name to  */
/* IconName, and every card can use it.                                    */
/* ------------------------------------------------------------------ */

import React from "react"

export type IconName =
  | "spark"
  | "gauge"
  | "cart"
  | "receipt"
  | "box"
  | "boxes"
  | "tag"
  | "users"
  | "user"
  | "bell"
  | "globe"
  | "phone"
  | "truck"
  | "mail"
  | "chart"
  | "trend"
  | "megaphone"
  | "target"
  | "chat"
  | "doc"
  | "page"
  | "folder"
  | "grid"
  | "percent"
  | "palette"
  | "image"
  | "money"
  | "gear"
  | "flag"
  | "calendar"
  | "check"
  | "bolt"
  | "cube"

const P: Record<IconName, React.ReactNode> = {
  spark: (
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2" />
  ),
  gauge: (
    <>
      <path d="M12 13a1 1 0 100-2 1 1 0 000 2z" />
      <path d="M12 12l3-3" />
      <path d="M4 15a8 8 0 1116 0" />
    </>
  ),
  cart: (
    <>
      <circle cx="9" cy="20" r="1" />
      <circle cx="18" cy="20" r="1" />
      <path d="M3 4h2l2.4 12.2a1 1 0 001 .8h9.2a1 1 0 001-.8L21 8H6" />
    </>
  ),
  receipt: (
    <>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z" />
      <path d="M9 8h6M9 12h6" />
    </>
  ),
  box: (
    <>
      <path d="M21 8l-9-5-9 5 9 5 9-5z" />
      <path d="M3 8v8l9 5 9-5V8" />
      <path d="M12 13v8" />
    </>
  ),
  boxes: (
    <>
      <path d="M3 7l4-2 4 2-4 2-4-2z" />
      <path d="M13 7l4-2 4 2-4 2-4-2z" />
      <path d="M8 16l4-2 4 2-4 2-4-2z" />
    </>
  ),
  tag: (
    <>
      <path d="M3 12l8-8h7v7l-8 8-7-7z" />
      <circle cx="15" cy="9" r="1" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20a6 6 0 0112 0" />
      <path d="M16 5.5a3 3 0 010 5.5M21 20a6 6 0 00-4-5.6" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5 20a7 7 0 0114 0" />
    </>
  ),
  bell: (
    <>
      <path d="M6 9a6 6 0 1112 0c0 5 2 6 2 6H4s2-1 2-6z" />
      <path d="M10 20a2 2 0 004 0" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />
    </>
  ),
  phone: (
    <path d="M4 4h4l2 5-2.5 1.5a11 11 0 006 6L15 14l5 2v4a2 2 0 01-2 2C9.7 22 2 14.3 2 6a2 2 0 012-2z" />
  ),
  truck: (
    <>
      <path d="M2 6h11v9H2zM13 9h4l4 3v3h-8z" />
      <circle cx="6" cy="18" r="1.5" />
      <circle cx="17" cy="18" r="1.5" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20V4" />
      <path d="M4 20h16" />
      <rect x="7" y="12" width="3" height="5" />
      <rect x="12" y="8" width="3" height="9" />
      <rect x="17" y="14" width="3" height="3" />
    </>
  ),
  trend: (
    <>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M15 7h6v6" />
    </>
  ),
  megaphone: (
    <>
      <path d="M3 11v2a1 1 0 001 1h3l7 4V6L7 10H4a1 1 0 00-1 1z" />
      <path d="M18 8a4 4 0 010 8" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="1" />
    </>
  ),
  chat: (
    <path d="M4 5h16v11H9l-4 4v-4H4V5z" />
  ),
  doc: (
    <>
      <path d="M6 3h8l4 4v14H6V3z" />
      <path d="M14 3v4h4M9 13h6M9 17h6" />
    </>
  ),
  page: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </>
  ),
  folder: (
    <path d="M3 6a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V6z" />
  ),
  grid: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="1" />
      <rect x="13" y="4" width="7" height="7" rx="1" />
      <rect x="4" y="13" width="7" height="7" rx="1" />
      <rect x="13" y="13" width="7" height="7" rx="1" />
    </>
  ),
  percent: (
    <>
      <path d="M5 19L19 5" />
      <circle cx="7.5" cy="7.5" r="2" />
      <circle cx="16.5" cy="16.5" r="2" />
    </>
  ),
  palette: (
    <>
      <path d="M12 3a9 9 0 000 18c1.5 0 2-1 2-2s-.5-1.5.5-2.5S18 15 19 14a5 5 0 002-4c0-4-4-7-9-7z" />
      <circle cx="8" cy="10" r="1" />
      <circle cx="12" cy="7" r="1" />
      <circle cx="16" cy="10" r="1" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="M4 18l5-5 4 4 3-3 4 4" />
    </>
  ),
  money: (
    <>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" />
    </>
  ),
  flag: (
    <>
      <path d="M5 21V4" />
      <path d="M5 4h11l-2 4 2 4H5" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v4M16 3v4" />
    </>
  ),
  check: <path d="M4 12l5 5L20 6" />,
  bolt: <path d="M13 2L4 14h7l-2 8 9-12h-7l2-8z" />,
  cube: (
    <>
      <path d="M12 2l9 5v10l-9 5-9-5V7l9-5z" />
      <path d="M12 12l9-5M12 12v10M12 12L3 7" />
    </>
  ),
}

export function Icon({
  name,
  size = 18,
  color = "currentColor",
  strokeWidth = 1.75,
}: {
  name: IconName
  size?: number
  color?: string
  strokeWidth?: number
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ display: "block", flex: "0 0 auto" }}
    >
      {P[name] ?? P.cube}
    </svg>
  )
}
