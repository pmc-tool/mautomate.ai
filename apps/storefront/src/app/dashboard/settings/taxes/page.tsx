"use client"

import React, { useEffect, useState } from "react"
import { BuildingTax } from "@medusajs/icons"
import { PageHeader } from "@components/merchant-admin/page-header"
import { DataTable } from "@components/merchant-admin/data-table"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import { listTaxRegions, TaxRegion, ApiError } from "@lib/merchant-admin/api"

export default function TaxesPage() {
  const { token, logout } = useMerchantAuth()
  const [items, setItems] = useState<TaxRegion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadTaxRegions = async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const res = await listTaxRegions(token)
      setItems(res.tax_regions || [])
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      setError(err instanceof Error ? err.message : "Failed to load tax regions")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTaxRegions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, logout])

  const columns = [
    {
      key: "country_code",
      header: "Country",
      sortable: true,
      render: (r: TaxRegion) => (
        <span className="uppercase text-grey-90">{r.country_code}</span>
      ),
    },
    {
      key: "province_code",
      header: "Province / State",
      render: (r: TaxRegion) => (
        <span className="uppercase text-grey-70">{r.province_code || "—"}</span>
      ),
    },
    {
      key: "default_rate",
      header: "Default rate",
      render: (r: TaxRegion) => (
        <span className="text-grey-90">
          {r.default_rate ? `${r.default_rate.name} (${r.default_rate.rate}%)` : "—"}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Taxes"
        description="View the tax regions and default rates applied at checkout."
      />

      <div className="rounded-base border border-grey-20 bg-grey-10 px-4 py-3 text-sm text-grey-70">
        Tax regions are managed by the platform.
      </div>

      {error && (
        <div className="rounded-base border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <DataTable<TaxRegion>
        columns={columns}
        rows={items}
        searchKeys={["country_code"]}
        sortKeys={[{ key: "country_code", label: "Country" }]}
        emptyIcon={BuildingTax}
        emptyTitle="No tax regions"
        emptyDescription="Tax regions are managed by the platform."
        isLoading={loading}
      />
    </div>
  )
}
