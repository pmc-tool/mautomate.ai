"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ArrowRight } from "@medusajs/icons"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import { getSetupStatus } from "@lib/merchant-admin/api"

/**
 * "Continue setup" affordances, shown anywhere in the dashboard while the store
 * is not yet ready to sell. A merchant who leaves the wizard to do something in
 * a full editor (add a product, enable a gateway, connect a domain) is always
 * one click from coming back — the setup flow is never a dead end. Both pieces
 * re-check on every navigation, so they disappear the moment the store is
 * sell-ready and never nag a running store.
 *
 * The shared status hook feeds two renderings: the legacy floating pill
 * (SetupResumeButton, no longer mounted — the Pixi panel is the single
 * floating surface now) and the in-panel SetupResumeCard.
 */
function useSetupResume() {
  const { token } = useMerchantAuth()
  const pathname = usePathname()
  const [ready, setReady] = useState<boolean | null>(null)
  const [pct, setPct] = useState(0)

  useEffect(() => {
    if (!token) return
    let alive = true
    getSetupStatus(token)
      .then((s) => {
        if (!alive) return
        setReady(s.ready_to_sell)
        setPct(s.percent)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [token, pathname])

  const hidden =
    !token || ready === null || ready === true ||
    // Don't show it on the wizard itself.
    Boolean(pathname?.startsWith("/dashboard/setup"))

  return { hidden, pct }
}

export function SetupResumeButton() {
  const { hidden, pct } = useSetupResume()

  if (hidden) return null

  return (
    <Link
      href="/dashboard/setup"
      className="fixed bottom-20 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-grey-90 px-4 py-2.5 text-sm font-semibold text-white shadow-lg ring-1 ring-black/5 transition hover:bg-grey-80"
    >
      Continue setup · {pct}%
      <ArrowRight className="h-4 w-4" />
    </Link>
  )
}

/**
 * The same status, rendered as a card at the top of the Pixi panel body.
 * `onNavigate` lets the panel close itself when the merchant heads to the
 * wizard.
 */
export function SetupResumeCard({ onNavigate }: { onNavigate?: () => void }) {
  const { hidden, pct } = useSetupResume()

  if (hidden) return null

  const width = Math.min(100, Math.max(0, pct))

  return (
    <div
      className="rounded-xl px-3 py-2.5"
      style={{
        background: "rgba(242,101,34,.05)",
        border: "1px solid rgba(242,101,34,.22)",
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-[13px] font-semibold text-grey-90">
          Finish setting up your store
        </div>
        <div className="text-[12px] font-semibold" style={{ color: "#F26522" }}>
          {pct}%
        </div>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-grey-10">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${width}%`, background: "#F26522" }}
        />
      </div>
      <Link
        href="/dashboard/setup"
        onClick={onNavigate}
        className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-grey-90 px-3 py-1.5 text-[12.5px] font-semibold text-white transition hover:bg-grey-80"
      >
        Continue setup
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  )
}
