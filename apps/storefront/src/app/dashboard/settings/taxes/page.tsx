"use client"

import React, { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  BuildingTax,
  ChevronRight,
  GlobeEuropeSolid,
  InformationCircleSolid,
} from "@medusajs/icons"
import { PageHeader } from "@components/merchant-admin/page-header"
import { EmptyState } from "@components/merchant-admin/empty-state"
import { Select } from "@components/merchant-admin/form-field"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import { listTaxRegions, TaxRegion, ApiError } from "@lib/merchant-admin/api"
import { getCountryName, formatTaxRate } from "@lib/merchant-admin/tax-utils"

const PAGE_SIZE = 20

type OrderKey = "updated_at" | "created_at"

// Tax REGIONS are platform-managed on this instance (one shared Platform
// region pool across tenants), so this page is read-only at the region level:
// no create, no delete. Merchants drill into a region to manage the tax rates
// and overrides that apply to their products.
export default function TaxesPage() {
  const router = useRouter()
  const { token, logout } = useMerchantAuth()

  const [items, setItems] = useState<TaxRegion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [orderBy, setOrderBy] = useState<OrderKey>("updated_at")
  const [page, setPage] = useState(1)

  useEffect(() => {
    const load = async () => {
      if (!token) return
      setLoading(true)
      setError(null)
      try {
        const res = await listTaxRegions(token)
        setItems(res.tax_regions || [])
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) logout()
        setError(
          err instanceof Error ? err.message : "Failed to load tax regions"
        )
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [token, logout])

  // Top-level country regions only (provinces carry a province_code).
  const countryRegions = useMemo(() => {
    const parents = items.filter((r) => !r.province_code)
    return [...parents].sort((a, b) => {
      const av = (a[orderBy] || a.created_at || "") as string
      const bv = (b[orderBy] || b.created_at || "") as string
      return bv.localeCompare(av)
    })
  }, [items, orderBy])

  const totalPages = Math.max(1, Math.ceil(countryRegions.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageRows = countryRegions.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  )

  useEffect(() => {
    setPage(1)
  }, [orderBy])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tax Regions"
        description="See what you charge your customers when they shop from different countries and regions."
      />

      <div className="flex items-start gap-2 rounded-base border border-grey-20 bg-grey-5 px-4 py-3 text-sm text-grey-60">
        <InformationCircleSolid className="mt-0.5 h-4 w-4 shrink-0 text-grey-40" />
        <p>
          Tax regions are managed by the platform operator and cannot be changed
          from the merchant dashboard. Open a region to manage the tax rates and
          overrides that apply to your products.
        </p>
      </div>

      {error && (
        <div className="rounded-base border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="rounded-large border border-grey-20 bg-white shadow-borders-base">
        <div className="flex items-center justify-between gap-3 border-b border-grey-10 px-5 py-4">
          <h2 className="text-base font-semibold text-grey-90">Tax regions</h2>
          <Select
            value={orderBy}
            onChange={(e) => setOrderBy(e.target.value as OrderKey)}
            className="w-auto"
            aria-label="Order by"
          >
            <option value="updated_at">Last updated</option>
            <option value="created_at">Date created</option>
          </Select>
        </div>

        {loading ? (
          <div className="space-y-3 p-5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-[52px] animate-pulse rounded-base bg-grey-10"
              />
            ))}
          </div>
        ) : countryRegions.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={BuildingTax}
              title="No tax regions"
              description="No tax regions have been configured by the platform operator yet."
              className="border-0 bg-transparent shadow-none"
            />
          </div>
        ) : (
          <div>
            <ul className="divide-y divide-grey-10">
              {pageRows.map((region) => (
                <li
                  key={region.id}
                  className="transition-colors hover:bg-grey-5"
                >
                  <button
                    type="button"
                    onClick={() =>
                      router.push(`/dashboard/settings/taxes/${region.id}`)
                    }
                    className="flex w-full min-w-0 items-center gap-3 px-5 py-3 text-left"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-base bg-grey-10 text-grey-60">
                      <GlobeEuropeSolid className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-grey-90">
                        {getCountryName(region.country_code)}
                      </span>
                      <span className="block truncate text-xs text-grey-50">
                        {region.default_rate
                          ? `${region.default_rate.name} · ${formatTaxRate(
                              region.default_rate.rate
                            )}`
                          : "No default rate"}
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-grey-40" />
                  </button>
                </li>
              ))}
            </ul>

            {countryRegions.length > PAGE_SIZE && (
              <div className="flex items-center justify-between border-t border-grey-10 px-5 py-3">
                <p className="text-xs text-grey-50">
                  Showing {(currentPage - 1) * PAGE_SIZE + 1}–
                  {Math.min(currentPage * PAGE_SIZE, countryRegions.length)} of{" "}
                  {countryRegions.length}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="rounded-base border border-grey-20 px-3 py-1.5 text-xs font-medium text-grey-70 hover:bg-grey-10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="text-xs text-grey-60">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="rounded-base border border-grey-20 px-3 py-1.5 text-xs font-medium text-grey-70 hover:bg-grey-10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
