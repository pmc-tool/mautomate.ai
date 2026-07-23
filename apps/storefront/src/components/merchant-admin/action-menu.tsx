"use client"

import React, { useState, useRef, useEffect, useCallback } from "react"
import { createPortal } from "react-dom"
import { EllipsisHorizontal } from "@medusajs/icons"
import { cn } from "@lib/util/cn"

export type ActionMenuItem = {
  label: string
  onClick: () => void
  destructive?: boolean
  icon?: React.ComponentType<{ className?: string }>
}

// Fixed menu width (w-44 = 11rem = 176px). The dropdown is rendered in a portal
// on document.body with position:fixed, so it is never clipped by the table's
// overflow containers or hidden behind the pagination bar (the last-row bug).
const MENU_WIDTH = 176

export function ActionMenu({
  items,
  label = "Actions",
}: {
  items: ActionMenuItem[]
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [coords, setCoords] = useState<{
    top: number
    left: number
    up: boolean
  } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => setMounted(true), [])

  // Position the menu off the trigger's viewport rect, flipping upward when
  // there isn't room below (e.g. the last row above the pagination bar).
  const place = useCallback(() => {
    const btn = triggerRef.current
    if (!btn) return
    const r = btn.getBoundingClientRect()
    const estHeight = items.length * 40 + 8
    const spaceBelow = window.innerHeight - r.bottom
    const up = spaceBelow < estHeight + 12 && r.top > estHeight
    const left = Math.max(
      8,
      Math.min(r.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8)
    )
    const top = up ? r.top - 4 : r.bottom + 4
    setCoords({ top, left, up })
  }, [items.length])

  useEffect(() => {
    if (!open) return
    place()
    const close = () => setOpen(false)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    const onDown = (e: MouseEvent) => {
      if (
        !triggerRef.current?.contains(e.target as Node) &&
        !menuRef.current?.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    // A row menu inside a scroll container: reposition would drift, so we close
    // on any scroll/resize (simple and robust).
    window.addEventListener("scroll", close, true)
    window.addEventListener("resize", close)
    window.addEventListener("keydown", onKey)
    document.addEventListener("mousedown", onDown)
    return () => {
      window.removeEventListener("scroll", close, true)
      window.removeEventListener("resize", close)
      window.removeEventListener("keydown", onKey)
      document.removeEventListener("mousedown", onDown)
    }
  }, [open, place])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((s) => !s)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        className="inline-flex h-8 w-8 items-center justify-center rounded-base border border-grey-20 bg-white text-grey-60 transition-colors hover:bg-grey-10 hover:text-grey-90"
      >
        <EllipsisHorizontal className="h-5 w-5" />
      </button>

      {open &&
        mounted &&
        coords &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{
              position: "fixed",
              top: coords.top,
              left: coords.left,
              width: MENU_WIDTH,
              transform: coords.up ? "translateY(-100%)" : undefined,
            }}
            className="z-[100] rounded-large border border-grey-20 bg-white py-1 shadow-lg"
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
          </div>,
          document.body
        )}
    </>
  )
}
