"use client"

import type React from "react"

/**
 * Monochrome brand marks for social/messaging providers. @medusajs/icons has no
 * brand glyphs, so these small inline SVGs fill the gap. Each takes the current
 * text color (tint via the wrapping element).
 */
type IconProps = { className?: string }

export function FacebookMark({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.95.93-1.95 1.88v2.26h3.32l-.53 3.49h-2.79V24C19.61 23.1 24 18.1 24 12.07z" />
    </svg>
  )
}

export function InstagramMark({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.7 3.7 0 0 1-1.38-.9 3.7 3.7 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16M12 0C8.74 0 8.33.01 7.05.07c-1.28.06-2.15.26-2.91.56-.79.3-1.46.72-2.13 1.38A5.9 5.9 0 0 0 .63 4.14c-.3.76-.5 1.63-.56 2.91C.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.28.26 2.15.56 2.91.3.79.72 1.46 1.38 2.13.67.66 1.34 1.08 2.13 1.38.76.3 1.63.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.28-.06 2.15-.26 2.91-.56a5.9 5.9 0 0 0 2.13-1.38 5.9 5.9 0 0 0 1.38-2.13c.3-.76.5-1.63.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.28-.26-2.15-.56-2.91a5.9 5.9 0 0 0-1.38-2.13A5.9 5.9 0 0 0 19.86.63c-.76-.3-1.63-.5-2.91-.56C15.67.01 15.26 0 12 0m0 5.84A6.16 6.16 0 1 0 18.16 12 6.16 6.16 0 0 0 12 5.84M12 16a4 4 0 1 1 4-4 4 4 0 0 1-4 4m6.41-10.85a1.44 1.44 0 1 0 1.44 1.44 1.44 1.44 0 0 0-1.44-1.44" />
    </svg>
  )
}

export function LinkedinMark({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.55V9h3.57v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.22.79 24 1.77 24h20.45c.98 0 1.78-.78 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" />
    </svg>
  )
}

export function XMark({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.41l-5.8-7.58-6.64 7.58H.46l8.6-9.83L0 1.15h7.6l5.24 6.93zm-1.29 19.5h2.04L6.48 3.24H4.29z" />
    </svg>
  )
}

export function WhatsappMark({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.3-.02-.46.13-.6.13-.14.3-.35.44-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.5l-.57-.01c-.2 0-.52.07-.79.37-.27.3-1.04 1.01-1.04 2.47s1.06 2.86 1.21 3.06c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35zM12.05 21.8h-.02a9.8 9.8 0 0 1-4.99-1.37l-.36-.21-3.7.97.99-3.62-.23-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.44 4.43-9.87 9.88-9.87a9.8 9.8 0 0 1 6.98 2.9 9.82 9.82 0 0 1 2.88 6.98c0 5.44-4.43 9.86-9.88 9.86zm8.4-18.26A11.8 11.8 0 0 0 12.05.02C5.5.02.16 5.35.16 11.9c0 2.1.55 4.14 1.6 5.95L.06 24l6.3-1.65a11.85 11.85 0 0 0 5.68 1.45h.01c6.55 0 11.88-5.33 11.88-11.88 0-3.17-1.24-6.15-3.48-8.38z" />
    </svg>
  )
}

export function MessengerMark({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 0C5.24 0 0 4.95 0 11.64c0 3.5 1.44 6.53 3.77 8.62.2.17.31.42.32.68l.07 2.13c.02.68.72 1.12 1.34.85l2.38-1.05c.2-.09.42-.1.63-.05 1.09.3 2.25.46 3.49.46 6.76 0 12-4.95 12-11.64C24 4.95 18.76 0 12 0zm7.2 8.93-3.52 5.6c-.56.89-1.76 1.11-2.61.48l-2.8-2.1a.72.72 0 0 0-.87 0l-3.78 2.87c-.5.38-1.16-.22-.82-.75l3.52-5.6c.56-.89 1.76-1.11 2.61-.48l2.8 2.1c.26.19.6.19.86 0l3.79-2.87c.5-.38 1.16.22.82.75z" />
    </svg>
  )
}

export type BrandKey =
  | "facebook"
  | "instagram"
  | "linkedin"
  | "x"
  | "whatsapp"
  | "messenger"

export const BRAND: Record<
  BrandKey,
  { Icon: (p: IconProps) => React.ReactElement; color: string; label: string }
> = {
  facebook: { Icon: FacebookMark, color: "#1877f2", label: "Facebook & Instagram" },
  instagram: { Icon: InstagramMark, color: "#e1306c", label: "Instagram" },
  linkedin: { Icon: LinkedinMark, color: "#0a66c2", label: "LinkedIn" },
  x: { Icon: XMark, color: "#18181b", label: "X (Twitter)" },
  whatsapp: { Icon: WhatsappMark, color: "#25d366", label: "WhatsApp" },
  messenger: { Icon: MessengerMark, color: "#a033ff", label: "Messenger" },
}

/** Map a category string to a brand key (or null for non-social categories). */
export function brandForCategory(category: string): BrandKey | null {
  const c = category.toLowerCase()
  if (c.includes("facebook") || c.includes("instagram")) return "facebook"
  if (c.includes("linkedin")) return "linkedin"
  if (c.includes("x (twitter)") || c.endsWith("· x")) return "x"
  if (c.includes("whatsapp")) return "whatsapp"
  if (c.includes("messenger")) return "messenger"
  return null
}
