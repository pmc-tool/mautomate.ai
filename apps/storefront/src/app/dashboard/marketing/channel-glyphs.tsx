import React from "react"
import { cn } from "@lib/util/cn"

/**
 * Brand glyphs for the messaging/publishing channels that @medusajs/icons does
 * not ship (Instagram, WhatsApp). Shared by the Connect page and the chatbot
 * studio so both render the same mark. currentColor everywhere, so the caller
 * tints them.
 */

export function InstagramGlyph({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  )
}

export function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.86 9.86 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm0 1.82c2.16 0 4.19.84 5.72 2.37a8.03 8.03 0 0 1 2.37 5.72c0 4.46-3.63 8.09-8.09 8.09a8.1 8.1 0 0 1-4.12-1.13l-.3-.18-3.06.8.82-2.99-.19-.31a8.03 8.03 0 0 1-1.24-4.29c0-4.46 3.63-8.08 8.09-8.08zM8.53 7.33c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1s.9 2.43 1.03 2.6c.13.17 1.75 2.67 4.25 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.46-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.06-.1-.23-.17-.48-.29-.25-.13-1.46-.72-1.69-.8-.23-.09-.39-.13-.56.12-.17.25-.64.8-.78.97-.15.17-.29.19-.54.06-.25-.13-1.04-.38-1.98-1.22-.73-.65-1.23-1.46-1.37-1.71-.15-.25-.02-.38.11-.5.11-.11.25-.29.37-.44.13-.15.17-.25.25-.42.09-.17.04-.31-.02-.44-.06-.12-.55-1.36-.78-1.86-.18-.4-.37-.4-.55-.41h-.49z" />
    </svg>
  )
}

/** A rounded, brand-tinted chip around any channel glyph. */
export function ChannelChip({
  icon: Icon,
  color,
  gradient,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>
  color: string
  gradient?: string
  className?: string
}) {
  const style = gradient
    ? { background: gradient, color: "#fff" }
    : { backgroundColor: `${color}14`, color }
  return (
    <div
      className={cn("flex items-center justify-center rounded-large", className)}
      style={style}
    >
      <Icon className="h-5 w-5" />
    </div>
  )
}
