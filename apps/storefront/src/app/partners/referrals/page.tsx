"use client"

import React, { useEffect, useState } from "react"
import { BuildingStorefront } from "@medusajs/icons"
import { PageHeader } from "@components/merchant-admin/page-header"
import { DataTable } from "@components/merchant-admin/data-table"
import { StatusBadge } from "@components/merchant-admin/status-badge"
import { usePartnerAuth } from "@lib/partner/auth"
import {
  listPartnerReferrals,
  PartnerApiError,
  PartnerReferral,
} from "@lib/partner/api"

type Row = {
  id: string
  name: string
  plan: string
  status: string
  referred_at: string
}

export default function PartnerReferralsPage() {
  const { token, logout } = usePartnerAuth()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    listPartnerReferrals(token)
      .then((res) =>
        setRows(
          (res.referrals || []).map((r: PartnerReferral) => ({
            id: r.id,
            name: r.store?.name || r.store?.slug || "—",
            plan: (r.store?.package || "—").replace(/_/g, " "),
            status: r.store?.status || "unknown",
            referred_at: r.referred_at,
          }))
        )
      )
      .catch((err) => {
        if (err instanceof PartnerApiError && err.status === 401) logout()
        else setError(err instanceof Error ? err.message : "Failed to load referrals")
      })
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const columns = [
    {
      key: "name",
      header: "Store",
      sortable: true,
      render: (r: Row) => <span className="font-medium text-grey-90">{r.name}</span>,
    },
    {
      key: "plan",
      header: "Plan",
      render: (r: Row) => <span className="capitalize text-grey-60">{r.plan}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (r: Row) => <StatusBadge status={r.status} />,
    },
    {
      key: "referred_at",
      header: "Referred",
      sortable: true,
      render: (r: Row) => (
        <span className="text-grey-60">
          {new Date(r.referred_at).toLocaleDateString()}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Referred stores"
        description="Every store that signed up through your referral link or was attributed to you."
      />

      {error && (
        <div className="rounded-base border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <DataTable<Row>
        columns={columns}
        rows={rows}
        searchKeys={["name"]}
        sortKeys={[
          { key: "name", label: "Store" },
          { key: "referred_at", label: "Referred" },
        ]}
        emptyIcon={BuildingStorefront}
        emptyTitle="No referred stores yet"
        emptyDescription="Share your referral link — stores that sign up through it appear here."
        isLoading={loading}
        pageSize={20}
      />
    </div>
  )
}
