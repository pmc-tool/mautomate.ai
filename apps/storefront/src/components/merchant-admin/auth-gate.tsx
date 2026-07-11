"use client"

import React, { useState } from "react"
import { useMerchantAuth } from "@lib/merchant-admin/auth"

function SkeletonCard() {
  return (
    <div className="w-full max-w-md rounded-large bg-white p-8 shadow-lg">
      <div className="mb-6 space-y-2">
        <div className="h-7 w-48 animate-pulse rounded-base bg-grey-10" />
        <div className="h-4 w-64 animate-pulse rounded-base bg-grey-10" />
      </div>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <div className="h-4 w-14 animate-pulse rounded-base bg-grey-10" />
          <div className="h-10 w-full animate-pulse rounded-base bg-grey-10" />
        </div>
        <div className="space-y-1.5">
          <div className="h-4 w-16 animate-pulse rounded-base bg-grey-10" />
          <div className="h-10 w-full animate-pulse rounded-base bg-grey-10" />
        </div>
        <div className="h-10 w-full animate-pulse rounded-base bg-grey-90" />
      </div>
    </div>
  )
}

function LoadingShell() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-grey-10 p-4">
      <SkeletonCard />
    </div>
  )
}

function LoginView() {
  const { login, loading, error } = useMerchantAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  return (
    <div className="flex min-h-screen items-center justify-center bg-grey-10 p-4">
      <div className="w-full max-w-md rounded-large bg-white p-8 shadow-lg">
        <h1 className="mb-1 text-2xl font-semibold text-grey-90">Merchant Admin</h1>
        <p className="mb-6 text-grey-50">Sign in to manage your store</p>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            login({ email, password })
          }}
          className="space-y-4"
        >
          <div>
            <label className="mb-1 block text-sm font-medium text-grey-70">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-base border border-grey-30 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-grey-90"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-grey-70">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-base border border-grey-30 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-grey-90"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-base bg-grey-90 py-2.5 font-medium text-white transition-colors hover:bg-grey-80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  )
}

function MfaView() {
  const { submitMfa, pendingToken, loading, error, logout } = useMerchantAuth()
  const [code, setCode] = useState("")

  return (
    <div className="flex min-h-screen items-center justify-center bg-grey-10 p-4">
      <div className="w-full max-w-md rounded-large bg-white p-8 shadow-lg">
        <h1 className="mb-1 text-2xl font-semibold text-grey-90">Two-factor authentication</h1>
        <p className="mb-6 text-grey-50">Enter the code from your authenticator app or a recovery code</p>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            submitMfa({ token: pendingToken || "", code })
          }}
          className="space-y-4"
        >
          <div>
            <label className="mb-1 block text-sm font-medium text-grey-70">TOTP or recovery code</label>
            <input
              type="text"
              required
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full rounded-base border border-grey-30 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-grey-90"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-base bg-grey-90 py-2.5 font-medium text-white transition-colors hover:bg-grey-80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Verifying..." : "Verify"}
          </button>
          <button
            type="button"
            onClick={logout}
            className="w-full text-sm text-grey-60 transition-colors hover:text-grey-90"
          >
            Cancel
          </button>
        </form>
      </div>
    </div>
  )
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { view, loading } = useMerchantAuth()

  if (loading) return <LoadingShell />
  if (view === "login") return <LoginView />
  if (view === "mfa") return <MfaView />
  return <>{children}</>
}
