"use client"

import React, { useState } from "react"
import { useControlAuth } from "@/lib/auth"
import { Spinner } from "@medusajs/icons"

function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-grey-10 p-4">
      <div className="w-full max-w-md rounded-large bg-white p-6 sm:p-8 shadow-lg transition-all">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-base bg-grey-90 text-white">
            <span className="text-sm font-bold">B2D</span>
          </div>
          <div>
            <h1 className="text-xl font-semibold text-grey-90">{title}</h1>
            <p className="text-sm text-grey-50">{subtitle}</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}

function LoginView() {
  const { login, loading, error } = useControlAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  return (
    <AuthCard title="Control Plane" subtitle="Operator sign in">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          login({ email, password })
        }}
        className="space-y-4"
      >
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-grey-70">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@mautomate.ai"
            className="w-full rounded-base border border-grey-30 bg-white px-3 py-2.5 text-sm text-grey-90 placeholder:text-grey-40 transition-colors focus:border-grey-90 focus:outline-none focus:ring-2 focus:ring-grey-90/20"
          />
        </div>
        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-grey-70">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-base border border-grey-30 bg-white px-3 py-2.5 text-sm text-grey-90 placeholder:text-grey-40 transition-colors focus:border-grey-90 focus:outline-none focus:ring-2 focus:ring-grey-90/20"
          />
        </div>
        {error && (
          <p className="rounded-base bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center rounded-base bg-grey-90 py-2.5 font-medium text-white transition-all hover:bg-grey-80 focus:outline-none focus:ring-2 focus:ring-grey-90/20 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <>
              <Spinner className="mr-2 h-4 w-4 animate-spin" />
              Signing in…
            </>
          ) : (
            "Sign in"
          )}
        </button>
      </form>
    </AuthCard>
  )
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { view, loading } = useControlAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-grey-10">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-borders-base">
          <Spinner className="h-6 w-6 animate-spin text-grey-90" />
        </div>
        <p className="text-sm font-medium text-grey-50">Loading…</p>
      </div>
    )
  }

  if (view === "login") return <LoginView />
  return <>{children}</>
}
