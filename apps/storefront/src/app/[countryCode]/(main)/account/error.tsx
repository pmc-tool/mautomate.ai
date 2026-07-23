"use client"

import { useEffect } from "react"

// Account-scoped error boundary (#19). A client-side throw in the account tree
// (e.g. a bad currency code on an order) previously bubbled to the GLOBAL
// app/error.tsx "something went wrong" page. This contains it to the account
// area with a friendly message + retry, and logs the real error to the console
// for diagnosis.
export default function AccountError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[account] render error:", error)
  }, [error])

  return (
    <div className="flex flex-col items-start gap-4 py-24 px-2 max-w-xl">
      <h1 className="text-2xl-semi text-ui-fg-base">
        We couldn&apos;t load your account
      </h1>
      <p className="text-base-regular text-ui-fg-subtle">
        Something went wrong loading this page. Please try again — if it keeps
        happening, contact support.
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="text-white bg-gray-900 hover:bg-gray-800 transition-colors rounded-md px-6 py-3 text-base-regular"
      >
        Try again
      </button>
    </div>
  )
}
