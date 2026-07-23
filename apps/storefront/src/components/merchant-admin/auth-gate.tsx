"use client"

import React, { useState } from "react"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import { Spinner } from "@medusajs/icons"
import { requestMerchantPasswordReset } from "@lib/merchant-admin/api"

// The mAutomate brand mark (same asset used by the merchant sidebar), kept as a
// self-contained data URI so the login card renders with no network dependency.
const MAUTOMATE_MARK =
  "data:image/png;base64,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"

// Shown only while the stored session is read from localStorage - a single
// frame in practice, since session validation no longer blocks the first paint.
// It is deliberately neutral: painting a login card here made a normal reload
// look like a sign-out, and painting the dashboard would flash a fake shell at
// signed-out visitors.
function LoadingShell() {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-grey-5"
      role="status"
      aria-label="Loading"
    >
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-grey-20 border-t-grey-60" />
    </div>
  )
}

// Shared card chrome so the merchant login/MFA screens match the console's
// polish: brand mark, title, subtitle.
export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fdf9f8] p-4">
      <div className="w-full max-w-md rounded-large bg-white p-6 sm:p-8 shadow-lg transition-all">
        <div className="mb-6 flex flex-col items-center text-center">
          <img
            src={MAUTOMATE_MARK}
            alt="mAutomate"
            className="h-12 w-12 shrink-0 rounded-base"
          />
          <h1 className="mt-4 text-xl font-semibold text-grey-90">{title}</h1>
          <p className="mt-1 text-sm text-grey-50">{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  )
}

export const inputClass =
  "w-full rounded-base border border-grey-30 bg-white px-3 py-2.5 text-sm text-grey-90 placeholder:text-grey-40 transition-colors focus:border-[#F15A29] focus:outline-none focus:ring-2 focus:ring-[#F15A29]/20"

function LoginView() {
  const { login, loading, error } = useMerchantAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showReset, setShowReset] = useState(false)
  const [resetEmail, setResetEmail] = useState("")
  const [resetLoading, setResetLoading] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)

  // Toggle the inline recovery panel. Prefill it with whatever the merchant
  // already typed in the sign-in email field so they rarely retype it.
  const openReset = () => {
    setResetError(null)
    setResetSent(false)
    setResetEmail((prev) => prev || email)
    setShowReset((v) => !v)
  }

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setResetError(null)
    setResetLoading(true)
    try {
      await requestMerchantPasswordReset(resetEmail)
      // Generic confirmation regardless of whether the account exists — the
      // backend deliberately does not reveal it, and neither do we.
      setResetSent(true)
    } catch (err) {
      setResetError(
        err instanceof Error ? err.message : "Could not send the reset link."
      )
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <AuthCard title="Welcome back" subtitle="Sign in to manage your store">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          login({ email, password })
        }}
        className="space-y-4"
      >
        <div>
          <label
            htmlFor="merchant-email"
            className="mb-1.5 block text-sm font-medium text-grey-70"
          >
            Email
          </label>
          <input
            id="merchant-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@yourstore.com"
            className={inputClass}
          />
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label
              htmlFor="merchant-password"
              className="block text-sm font-medium text-grey-70"
            >
              Password
            </label>
            <button
              type="button"
              onClick={openReset}
              aria-expanded={showReset}
              aria-controls="merchant-reset-panel"
              className="text-xs font-medium text-grey-50 underline-offset-2 transition-colors hover:text-[#F15A29] hover:underline"
            >
              Forgot password?
            </button>
          </div>
          <input
            id="merchant-password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </div>
        {error && (
          <p
            role="alert"
            className="rounded-base bg-red-50 px-3 py-2 text-sm text-red-600"
          >
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center rounded-base bg-[#F15A29] py-2.5 font-semibold text-white transition-all hover:bg-[#d94e20] focus:outline-none focus:ring-2 focus:ring-[#F15A29]/30 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
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
      {showReset && (
        <div
          id="merchant-reset-panel"
          className="mt-4 rounded-base border border-grey-20 bg-grey-5 p-4"
        >
          {resetSent ? (
            <p role="status" className="text-sm text-grey-70">
              If an account exists for{" "}
              <span className="font-medium text-grey-90">{resetEmail}</span>,
              we&apos;ve sent a reset link — check your inbox and spam folder.
            </p>
          ) : (
            <form onSubmit={handleReset} className="space-y-3">
              <div>
                <label
                  htmlFor="merchant-reset-email"
                  className="mb-1.5 block text-sm font-medium text-grey-70"
                >
                  Reset your password
                </label>
                <input
                  id="merchant-reset-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="you@yourstore.com"
                  className={inputClass}
                />
                <p className="mt-1.5 text-xs text-grey-50">
                  Enter your account email and we&apos;ll send a link to set a
                  new password.
                </p>
              </div>
              {resetError && (
                <p
                  role="alert"
                  className="rounded-base bg-red-50 px-3 py-2 text-sm text-red-600"
                >
                  {resetError}
                </p>
              )}
              <button
                type="submit"
                disabled={resetLoading}
                className="flex w-full items-center justify-center rounded-base border border-grey-30 bg-white py-2.5 font-medium text-grey-90 transition-all hover:bg-grey-10 focus:outline-none focus:ring-2 focus:ring-[#F15A29]/20 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {resetLoading ? (
                  <>
                    <Spinner className="mr-2 h-4 w-4 animate-spin" />
                    Sending…
                  </>
                ) : (
                  "Send reset link"
                )}
              </button>
            </form>
          )}
        </div>
      )}

      <div className="mt-6 border-t border-grey-20 pt-5 text-center">
        <p className="text-sm text-grey-50">
          New to mAutomate?{" "}
          <a
            href="https://mautomate.ai/get-started"
            className="font-semibold underline-offset-2 hover:underline"
            style={{ color: "#F15A29" }}
          >
            Create your store
          </a>
        </p>
      </div>
    </AuthCard>
  )
}

function MfaView() {
  const { submitMfa, pendingToken, loading, error, logout } = useMerchantAuth()
  const [code, setCode] = useState("")

  return (
    <AuthCard
      title="Two-factor authentication"
      subtitle="Enter the code from your authenticator app or a recovery code"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submitMfa({ token: pendingToken || "", code })
        }}
        className="space-y-4"
      >
        <div>
          <label
            htmlFor="merchant-mfa-code"
            className="mb-1.5 block text-sm font-medium text-grey-70"
          >
            TOTP or recovery code
          </label>
          <input
            id="merchant-mfa-code"
            type="text"
            required
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className={inputClass}
          />
        </div>
        {error && (
          <p
            role="alert"
            className="rounded-base bg-red-50 px-3 py-2 text-sm text-red-600"
          >
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center rounded-base bg-[#F15A29] py-2.5 font-semibold text-white transition-all hover:bg-[#d94e20] focus:outline-none focus:ring-2 focus:ring-[#F15A29]/30 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <>
              <Spinner className="mr-2 h-4 w-4 animate-spin" />
              Verifying…
            </>
          ) : (
            "Verify"
          )}
        </button>
        <button
          type="button"
          onClick={logout}
          className="w-full text-sm text-grey-60 transition-colors hover:text-grey-90"
        >
          Cancel
        </button>
      </form>
    </AuthCard>
  )
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { view, loading } = useMerchantAuth()

  if (loading) return <LoadingShell />
  if (view === "login") return <LoginView />
  if (view === "mfa") return <MfaView />
  return <>{children}</>
}
