"use client"

import React from "react"
import { AuthGate } from "./auth-gate"
import { Sidebar } from "./sidebar"

export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <div className="min-h-screen bg-grey-5">
        <Sidebar />
        <main className="min-h-screen transition-all lg:ml-64">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </AuthGate>
  )
}
