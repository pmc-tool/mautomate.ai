"use client"

import React, { useState } from "react"
import { CheckCircleSolid, Swatch } from "@medusajs/icons"
import { cn } from "@lib/util/cn"

/**
 * Asks HOW to switch themes — the choice that stops a switch from breaking the
 * layout. "Fresh install" gives the new theme its own default design (the old
 * one is kept in history and restorable); "keep" leaves current content in place.
 * Products, orders and customers are never affected either way.
 */
export function ThemeSwitchDialog({
  open,
  themeName,
  busy,
  onClose,
  onConfirm,
}: {
  open: boolean
  themeName: string
  busy?: boolean
  onClose: () => void
  onConfirm: (mode: "fresh" | "keep") => void
}) {
  const [mode, setMode] = useState<"fresh" | "keep">("fresh")
  if (!open) return null

  const Option = ({
    value,
    title,
    desc,
  }: {
    value: "fresh" | "keep"
    title: string
    desc: string
  }) => (
    <button
      type="button"
      onClick={() => setMode(value)}
      className={cn(
        "flex w-full items-start gap-3 rounded-xl border p-4 text-left transition",
        mode === value
          ? "border-grey-90 bg-grey-5 ring-1 ring-grey-90"
          : "border-grey-20 hover:border-grey-30"
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
          mode === value ? "border-grey-90 bg-grey-90" : "border-grey-30"
        )}
      >
        {mode === value && <span className="h-2 w-2 rounded-full bg-white" />}
      </span>
      <span>
        <span className="block text-sm font-semibold text-grey-90">{title}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-grey-50">{desc}</span>
      </span>
    </button>
  )

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-grey-90 text-white">
            <Swatch className="h-5 w-5" />
          </span>
          <h3 className="text-lg font-semibold text-grey-90">Switch to {themeName}?</h3>
        </div>

        <p className="mb-4 text-sm leading-relaxed text-grey-50">
          Choose how to apply this theme. Your products, orders and customers are
          never affected — only the storefront design.
        </p>

        <div className="space-y-2.5">
          <Option
            value="fresh"
            title="Fresh install (recommended)"
            desc={`Install ${themeName} with its own default design so nothing looks broken. Your current design is backed up — you can restore it anytime.`}
          />
          <Option
            value="keep"
            title="Keep my current content"
            desc="Switch the theme but keep your existing pages. May not fit the new theme perfectly."
          />
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded-lg px-4 py-2 text-sm font-medium text-grey-60 transition hover:bg-grey-10 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(mode)}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-grey-90 px-4 py-2 text-sm font-semibold text-white transition hover:bg-grey-80 disabled:opacity-50"
          >
            {busy ? "Applying…" : "Apply theme"}
            {!busy && <CheckCircleSolid className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  )
}
