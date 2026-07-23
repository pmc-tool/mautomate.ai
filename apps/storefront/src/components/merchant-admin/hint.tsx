"use client"

import React, { useState } from "react"
import { InformationCircleSolid } from "@medusajs/icons"
import { cn } from "@lib/util/cn"

/**
 * A small "what's this?" info tooltip. Hover or focus (keyboard) reveals a short
 * explanation, so a field can stay uncluttered while still being self-explaining
 * for a first-time, non-technical merchant. Click toggles it too (touch).
 */
export function Hint({ text, className }: { text: string; className?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <span className={cn("relative inline-flex align-middle", className)}>
      <button
        type="button"
        aria-label="More information"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => {
          e.preventDefault()
          setOpen((o) => !o)
        }}
        className="text-grey-40 transition-colors hover:text-grey-70 focus:outline-none focus-visible:text-grey-70"
      >
        <InformationCircleSolid className="h-4 w-4" />
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute bottom-full left-1/2 z-50 mb-1.5 w-56 -translate-x-1/2 rounded-lg bg-grey-90 px-3 py-2 text-xs font-normal leading-relaxed text-white shadow-lg"
        >
          {text}
          <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-grey-90" />
        </span>
      )}
    </span>
  )
}
