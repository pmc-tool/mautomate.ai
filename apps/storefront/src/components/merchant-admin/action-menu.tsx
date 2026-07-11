"use client"

import React, { useState, useRef, useEffect } from "react"
import { EllipsisHorizontal } from "@medusajs/icons"
import { cn } from "@lib/util/cn"

export type ActionMenuItem = {
  label: string
  onClick: () => void
  destructive?: boolean
  icon?: React.ComponentType<{ className?: string }>
}

export function ActionMenu({
  items,
  label = "Actions",
}: {
  items: ActionMenuItem[]
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        className="inline-flex h-8 w-8 items-center justify-center rounded-base border border-grey-20 bg-white text-grey-60 transition-colors hover:bg-grey-10 hover:text-grey-90"
      >
        <EllipsisHorizontal className="h-5 w-5" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-44 rounded-large border border-grey-20 bg-white py-1 shadow-lg"
        >
          {items.map((item, idx) => {
            const Icon = item.icon
            return (
              <button
                key={idx}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false)
                  item.onClick()
                }}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
                  item.destructive
                    ? "text-red-600 hover:bg-red-50"
                    : "text-grey-90 hover:bg-grey-10"
                )}
              >
                {Icon && <Icon className="h-4 w-4" />}
                {item.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
