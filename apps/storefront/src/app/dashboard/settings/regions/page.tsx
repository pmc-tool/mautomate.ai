"use client"

import React, { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Globe, ArrowUpRightOnBox, MapPin } from "@medusajs/icons"
import { PageHeader } from "@components/merchant-admin/page-header"
import { EmptyState } from "@components/merchant-admin/empty-state"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import { listRegions, Region, ApiError } from "@lib/merchant-admin/api"

export default function RegionsPage() {
  const { token, logout } = useMerchantAuth()
  const router = useRouter()
  const [items, setItems] = useState<Region[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      if (!token) return
      setLoading(true)
      setError(null)
      try {
        const res = await listRegions(token)
        setItems(res.regions || [])
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) logout()
        setError(err instanceof Error ? err.message : "Failed to load region")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [token, logout])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Region"
        description="Your store operates in a single region. Its currency is managed in Store settings, and the countries you ship to are set per location under Locations & shipping."
      />

      {error && (
        <div className="rounded-base border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="h-28 animate-pulse rounded-large border border-grey-20 bg-grey-10" />
      ) : items.length === 0 ? (
        <EmptyState icon={Globe} title="No region" description="Your store's region has not been set up yet." />
      ) : (
        <div className="space-y-4">
          {items.map((r) => (
            <div key={r.id} className="rounded-large border border-grey-20 bg-white p-5 shadow-borders-base">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-base bg-grey-10 text-grey-50">
                    <Globe className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-grey-90">{r.name}</h3>
                    <p className="mt-0.5 text-sm text-grey-50">
                      Currency: <span className="font-medium uppercase text-grey-80">{r.currency_code}</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              onClick={() => router.push("/dashboard/settings/store")}
              className="flex items-center justify-between rounded-large border border-grey-20 bg-white px-5 py-4 text-left shadow-borders-base transition-colors hover:bg-grey-10"
            >
              <div>
                <p className="text-sm font-medium text-grey-90">Store settings</p>
                <p className="text-xs text-grey-50">Set your store currency</p>
              </div>
              <ArrowUpRightOnBox className="h-4 w-4 text-grey-40" />
            </button>
            <button
              onClick={() => router.push("/dashboard/settings/locations")}
              className="flex items-center justify-between rounded-large border border-grey-20 bg-white px-5 py-4 text-left shadow-borders-base transition-colors hover:bg-grey-10"
            >
              <div>
                <p className="text-sm font-medium text-grey-90">Locations &amp; shipping</p>
                <p className="text-xs text-grey-50">Choose the countries you ship to</p>
              </div>
              <MapPin className="h-4 w-4 text-grey-40" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
