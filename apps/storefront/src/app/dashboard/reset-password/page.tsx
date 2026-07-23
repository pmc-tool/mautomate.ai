"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { Spinner } from "@medusajs/icons"
import { AuthCard, inputClass } from "@components/merchant-admin/auth-gate"
import { updateMerchantPassword } from "@lib/merchant-admin/api"

// Recovery page: reachable while SIGNED OUT (see page-shell.tsx, which renders
// this route without the AuthGate). It reads the single-use token + email from
// the link in the reset email and sets a new password.

const MIN_LENGTH = 8


export default function MerchantResetPasswordPage() {
  const [token, setToken] = useState<string | null>(null)
  const [email, setEmail] = useState<string>("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setToken(params.get("token"))
    setEmail(params.get("email") || "")
  }, [])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!token) {
      setError("This reset link is missing its token. Request a new link below.")
      return
    }
    if (password.length < MIN_LENGTH) {
      setError(`Your new password must be at least ${MIN_LENGTH} characters.`)
      return
    }
    if (password !== confirm) {
      setError("The two passwords do not match.")
      return
    }
    setLoading(true)
    try {
      await updateMerchantPassword(token, password)
      setDone(true)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "This reset link is invalid or has expired."
      )
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <AuthCard
        title="Password updated"
        subtitle="You can now sign in with your new password"
      >
        <Link
          href="/dashboard"
          className="flex w-full items-center justify-center rounded-base bg-grey-90 py-2.5 font-medium text-white transition-all hover:bg-grey-80 focus:outline-none focus:ring-2 focus:ring-grey-90/20 active:scale-[0.99]"
        >
          Continue to sign in
        </Link>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      title="Set a new password"
      subtitle={
        email ? `Choose a new password for ${email}` : "Choose a new password"
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label
              htmlFor="merchant-new-password"
              className="block text-sm font-medium text-grey-70"
            >
              New password
            </label>
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="text-xs font-medium text-grey-50 underline-offset-2 transition-colors hover:text-grey-90 hover:underline"
            >
              {show ? "Hide" : "Show"}
            </button>
          </div>
          <input
            id="merchant-new-password"
            type={show ? "text" : "password"}
            required
            minLength={MIN_LENGTH}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
          <p className="mt-1.5 text-xs text-grey-50">
            At least {MIN_LENGTH} characters.
          </p>
        </div>
        <div>
          <label
            htmlFor="merchant-confirm-password"
            className="mb-1.5 block text-sm font-medium text-grey-70"
          >
            Confirm new password
          </label>
          <input
            id="merchant-confirm-password"
            type={show ? "text" : "password"}
            required
            minLength={MIN_LENGTH}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={inputClass}
          />
        </div>
        {error && (
          <div
            role="alert"
            className="space-y-2 rounded-base bg-red-50 px-3 py-2 text-sm text-red-600"
          >
            <p>{error}</p>
            <Link
              href="/dashboard"
              className="inline-block font-medium text-red-600 underline underline-offset-2"
            >
              Request a new link
            </Link>
          </div>
        )}
        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center rounded-base bg-grey-90 py-2.5 font-medium text-white transition-all hover:bg-grey-80 focus:outline-none focus:ring-2 focus:ring-grey-90/20 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <>
              <Spinner className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            "Set new password"
          )}
        </button>
        <Link
          href="/dashboard"
          className="block text-center text-sm text-grey-60 transition-colors hover:text-grey-90"
        >
          Back to sign in
        </Link>
      </form>
    </AuthCard>
  )
}
