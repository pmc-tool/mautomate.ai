"use client"

import { usePathname } from "next/navigation"
import { Sidebar } from "./sidebar"
import { AuthGate } from "./auth-gate"

/**
 * The inbox is a workspace, not a document: it owns the full viewport, brings its
 * own navigation (the channel rail), and must never be centred inside the
 * reading-width container that every other page wants. Anything under
 * /dashboard/inbox therefore renders edge to edge, and the main nav steps aside
 * for the rail — which is what buys the inbox a whole extra column of width.
 */
const FULL_BLEED = ["/dashboard/inbox"]

export function PageShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
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
            {children}
          </div>
        </main>
      </div>
    </AuthGate>
  )
}
