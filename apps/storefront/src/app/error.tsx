"use client"

import { useEffect } from "react"

export default function MerchantError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Merchant admin client error", error)
  }, [error])

  const message = error.digest || error.message || String(error) || "Unknown error"

  return (
    <div className="flex min-h-screen items-center justify-center bg-grey-10 p-4">
      <div className="w-full max-w-md rounded-large bg-white p-6 shadow-borders-base">
        <h1 className="mb-2 text-xl font-semibold text-red-600">
          Client-side error
        </h1>
        <p className="mb-4 text-sm text-grey-50">
          Please copy the error below and share it with support.
        </p>
        <pre className="rounded-base bg-grey-5 p-3 text-xs overflow-auto">
          {message}
        </pre>
        {error.stack && (
          <pre className="mt-4 rounded-base bg-grey-5 p-3 text-xs overflow-auto">
            {error.stack}
          </pre>
        )}
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => reset()}
            className="rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  )
}
