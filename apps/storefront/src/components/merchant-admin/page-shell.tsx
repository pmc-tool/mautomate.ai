"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { Sidebar } from "./sidebar"
import { AuthGate } from "./auth-gate"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import { getMerchantMe } from "@lib/merchant-admin/api"

/**
 * Paid-plan signup whose card was never captured: the store exists but is
 * deliberately offline (tenant status "pending_payment") until the Paddle
 * webhook confirms the $0 trial checkout. This banner is that state's one
 * honest surface in the dashboard — everything else works, but the public
 * storefront stays dark until they finish.
 */
function PendingPaymentBanner() {
  const { token } = useMerchantAuth()
  const [pending, setPending] = useState(false)
  useEffect(() => {
    if (!token) return
    let dead = false
    getMerchantMe(token)
      .then((me) => {
        if (!dead) setPending((me as any)?.status === "pending_payment")
      })
      .catch(() => {})
    return () => {
      dead = true
    }
  }, [token])
  if (!pending) return null
  return (
    <div
      className="mb-5 flex flex-col gap-3 rounded-large border p-4 sm:flex-row sm:items-center sm:justify-between"
      style={{ borderColor: "#F8C4A8", background: "#FFF1EA" }}
    >
      <div>
        <p className="text-sm font-semibold text-grey-90">
          Your store isn't live yet
        </p>
        <p className="mt-0.5 text-sm text-grey-60">
          Finish setting up your 7-day free trial — add a card (nothing is
          charged today) and your store goes live right away.
        </p>
      </div>
      <a
        href="/dashboard/billing#plans"
        className="inline-flex flex-none items-center justify-center rounded-base px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
        style={{ background: "#F26522" }}
      >
        Finish setup
      </a>
    </div>
  )
}

/**
 * The inbox is a workspace, not a document: it owns the full viewport, brings its
 * own navigation (the channel rail), and must never be centred inside the
 * reading-width container that every other page wants. Anything under
 * /dashboard/inbox therefore renders edge to edge, and the main nav steps aside
 * for the rail — which is what buys the inbox a whole extra column of width.
 */
const FULL_BLEED = ["/dashboard/inbox", "/dashboard/assistant"]

export function PageShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || ""

  // Recovery pages must render for SIGNED-OUT visitors: a locked-out merchant
  // arrives here from an email link with no session. So the password-reset
  // route bypasses the AuthGate (and the signed-in chrome) entirely and paints
  // its own full-screen card. It is the only public route under /dashboard.
  const isPublic =
    pathname === "/dashboard/reset-password" ||
    pathname.startsWith("/dashboard/reset-password/")
  if (isPublic) {
    return <div className="min-h-screen bg-grey-10">{children}</div>
  }

  const fullBleed = FULL_BLEED.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  )

  if (fullBleed) {
    return (
      <AuthGate>
        <div className="h-screen overflow-hidden bg-grey-5">{children}</div>
      </AuthGate>
    )
  }

  return (
    <AuthGate>
      <div className="min-h-screen bg-grey-5">
        <Sidebar />
        <main className="min-h-screen pt-16 lg:ml-64 lg:pt-0">
          <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
            <PendingPaymentBanner />
            {children}
          </div>
        </main>
      </div>
    </AuthGate>
  )
}
