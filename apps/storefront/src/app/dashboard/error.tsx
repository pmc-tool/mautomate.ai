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
    // Keep the technical detail in the console for support/debugging only —
    // it is never rendered to the merchant.
    console.error("Merchant admin client error", error)
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center bg-grey-10 p-4">
      <div
        role="alert"
        aria-live="assertive"
        className="w-full max-w-md rounded-large bg-white p-8 text-center shadow-borders-base"
      >
        <span
          aria-hidden="true"
          className="mx-auto mb-5 block h-1 w-10 rounded-circle bg-brand-500"
        />
        <h1 className="mb-2 text-xl font-semibold text-grey-90">
          Something went wrong on our end
        </h1>
        <p className="mb-6 text-sm leading-relaxed text-grey-50">
          We hit an unexpected problem loading this page. Please try again — if it
          keeps happening, contact support and we&apos;ll help you sort it out.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-base bg-grey-90 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-grey-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-base border border-grey-20 bg-white px-5 py-2.5 text-sm font-medium text-grey-70 transition-colors hover:bg-grey-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
          >
            Reload page
          </button>
        </div>
      </div>
    </div>
  )
}
