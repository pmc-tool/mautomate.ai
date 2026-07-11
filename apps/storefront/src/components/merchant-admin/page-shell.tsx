"use client"

import { Sidebar } from "./sidebar"
import { AuthGate } from "./auth-gate"

export function PageShell({ children }: { children: React.ReactNode }) {
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
