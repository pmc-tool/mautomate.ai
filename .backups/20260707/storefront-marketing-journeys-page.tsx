"use client"

import { useEffect, useState } from "react"
import { Sparkles } from "@medusajs/icons"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  listMarketingJourneys,
  MarketingJourney,
  ApiError,
} from "@lib/merchant-admin/api"
import { PageHeader } from "@components/merchant-admin/page-header"
import { StatusBadge } from "@components/merchant-admin/status-badge"
import { EmptyState } from "@components/merchant-admin/empty-state"

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export default function MarketingJourneysPage() {
  const { token } = useMerchantAuth()
  const [journeys, setJourneys] = useState<MarketingJourney[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    listMarketingJourneys(token, { limit: 100 })
      .then((res) => setJourneys(res.journeys || []))
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Failed to load journeys")
      })
      .finally(() => setLoading(false))
  }, [token])

  return (
    <div className="space-y-6">
      <PageHeader title="Journeys" description="Automated customer journeys triggered by events." />

      {error && (
        <div className="rounded-base border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-large border border-grey-20 bg-white shadow-borders-base">
        {loading ? (
          <div className="p-8 text-center text-sm text-grey-50">Loading journeys…</div>
        ) : journeys.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No journeys yet"
              description="Build journeys to automate follow-ups and recover abandoned carts."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-grey-5 text-grey-50">
                <tr>
                  <th className="px-5 py-3 text-left font-medium">Name</th>
                  <th className="px-5 py-3 text-left font-medium">Trigger</th>
                  <th className="px-5 py-3 text-left font-medium">Status</th>
                  <th className="px-5 py-3 text-left font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-grey-10">
                {journeys.map((journey) => (
                  <tr key={journey.id} className="hover:bg-grey-5">
                    <td className="px-5 py-3 font-medium text-grey-90">
                      {journey.name}
                      {journey.description && (
                        <p className="text-xs font-normal text-grey-50">{journey.description}</p>
                      )}
                    </td>
                    <td className="px-5 py-3 text-grey-60">{journey.trigger_event}</td>
                    <td className="px-5 py-3">
                      <StatusBadge status={journey.status} />
                    </td>
                    <td className="px-5 py-3 text-grey-50">{formatDate(journey.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
