"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArrowPath,
  ArrowRightOnRectangle,
  ArrowUpRightOnBox,
  BuildingStorefront,
  Cash,
  CreditCard,
  ExclamationCircle,
  Plus,
  ReceiptPercent,
  Trash,
} from "@medusajs/icons"
import { useControlAuth } from "@/lib/auth"
import {
  deleteTenant,
  getMetrics,
  grantCredits,
  listTenants,
  resumeTenant,
  suspendTenant,
  type Metrics,
  type Tenant,
} from "@/lib/api"
import { DataTable, type Column } from "@/components/data-table"
import { KpiCard } from "@/components/kpi-card"
import { Modal } from "@/components/modal"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { cn } from "@/lib/utils"

function formatUsd(amount: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(amount)
}

function humanizePackage(pkg: string): string {
  return pkg
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function storeUrl(slug: string): string {
  return `https://${slug}.mautomate.ai`
}

function SkeletonValue() {
  return <div className="h-7 w-24 rounded bg-grey-10 animate-pulse" />
}

const searchKeys: (keyof Tenant)[] = ["name", "slug", "package", "status"]

export default function OverviewPage() {
  const { token, logout } = useControlAuth()

  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [workingId, setWorkingId] = useState<string | null>(null)

  const [grantModal, setGrantModal] = useState<{
    open: boolean
    tenant: Tenant | null
  }>({ open: false, tenant: null })
  const [deleteModal, setDeleteModal] = useState<{
    open: boolean
    tenant: Tenant | null
  }>({ open: false, tenant: null })
  const [creditAmount, setCreditAmount] = useState("")

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const [metricsRes, tenantsRes] = await Promise.all([
        getMetrics(token),
        listTenants(token),
      ])
      setMetrics(metricsRes.metrics)
      setTenants(tenantsRes.tenants)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load overview")
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  const toggleStatus = async (tenant: Tenant) => {
    if (!token) return
    setWorkingId(tenant.id)
    try {
      if (tenant.status?.toLowerCase() === "suspended") {
        await resumeTenant(token, tenant.id)
      } else {
        await suspendTenant(token, tenant.id)
      }
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status")
    } finally {
      setWorkingId(null)
    }
  }

  const handleGrantSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!token || !grantModal.tenant) return

    const amount = Number(creditAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a positive credit amount")
      return
    }

    setWorkingId(grantModal.tenant.id)
    try {
      await grantCredits(token, grantModal.tenant.id, amount)
      await load()
      setGrantModal({ open: false, tenant: null })
      setCreditAmount("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to grant credits")
    } finally {
      setWorkingId(null)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!token || !deleteModal.tenant) return
    setWorkingId(deleteModal.tenant.id)
    try {
      await deleteTenant(token, deleteModal.tenant.id)
      await load()
      setDeleteModal({ open: false, tenant: null })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete store")
    } finally {
      setWorkingId(null)
    }
  }

  const columns = useMemo<Column<Tenant>[]>(
    () => [
      {
        key: "store",
        header: "Store",
        render: (row) => (
          <div>
            <p className="font-medium text-grey-90">{row.name}</p>
            <p className="text-xs text-grey-50">{row.slug}.mautomate.ai</p>
          </div>
        ),
      },
      {
        key: "package",
        header: "Package",
        render: (row) => (
          <span className="text-grey-70">{humanizePackage(row.package)}</span>
        ),
      },
      {
        key: "status",
        header: "Status",
        render: (row) => <StatusBadge status={row.status} />,
      },
      {
        key: "credits",
        header: "Credits",
        className: "text-right",
        render: (row) => (
          <span className="tabular-nums text-grey-90">
            {row.credit_balance?.toLocaleString() ?? "0"}
          </span>
        ),
      },
    ],
    []
  )

  const actionBtn =
    "inline-flex items-center gap-1.5 rounded-base border px-2.5 py-1.5 text-xs font-medium transition-all outline-none focus-visible:ring-2 focus-visible:ring-grey-90/20 disabled:cursor-not-allowed disabled:opacity-50"

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={load}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-base border border-grey-20 bg-white px-3 py-2 text-sm font-medium text-grey-70 transition-all hover:bg-grey-10 hover:border-grey-30 hover:text-grey-90 disabled:opacity-50"
      >
        <ArrowPath className={cn("h-4 w-4", loading && "animate-spin")} />
        Refresh
      </button>
      <button
        onClick={logout}
        className="inline-flex items-center gap-2 rounded-base border border-grey-20 bg-white px-3 py-2 text-sm font-medium text-grey-70 transition-all hover:bg-grey-10 hover:border-grey-30 hover:text-grey-90"
      >
        <ArrowRightOnRectangle className="h-4 w-4" />
        Sign out
      </button>
    </div>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description="mAutomate control plane — manage tenants and platform health."
        action={headerActions}
      />

      {error && (
        <div className="rounded-large border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
          <div className="flex items-start gap-3">
            <ExclamationCircle className="mt-0.5 h-5 w-5 shrink-0" />
            {error}
          </div>
        </div>
      )}

      <div className="rounded-large border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 shadow-sm">
        <div className="flex items-start gap-3">
          <ExclamationCircle className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
          <p>
            Projected figures. Billing & metering not wired yet — revenue is
            modelled from tiers, not real payments.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          label="Stores"
          value={loading ? <SkeletonValue /> : metrics?.tenants_total ?? 0}
          icon={BuildingStorefront}
          trend={loading ? undefined : `${metrics?.by_status.live ?? 0} live`}
          tone="brand"
        />
        <KpiCard
          label="MRR (proj.)"
          value={loading ? <SkeletonValue /> : formatUsd(metrics?.mrr_usd ?? 0)}
          icon={Cash}
          tone="green"
        />
        <KpiCard
          label="Revenue (proj.)"
          value={
            loading ? <SkeletonValue /> : formatUsd(metrics?.revenue_total_usd ?? 0)
          }
          icon={ReceiptPercent}
          tone="green"
        />
        <KpiCard
          label="Credits used"
          value={
            loading ? <SkeletonValue /> : formatUsd(metrics?.credits_spent ?? 0)
          }
          icon={CreditCard}
          tone="grey"
        />
        <KpiCard
          label="Outstanding"
          value={
            loading ? <SkeletonValue /> : formatUsd(metrics?.credits_outstanding ?? 0)
          }
          icon={ExclamationCircle}
          tone="grey"
        />
      </div>

      <div className="rounded-large border border-grey-20 bg-white p-5 shadow-borders-base">
        <h3 className="mb-4 font-semibold text-grey-90">Stores</h3>
        <DataTable
          columns={columns}
          rows={tenants}
          searchKeys={searchKeys}
          isLoading={loading}
          emptyIcon={BuildingStorefront}
          emptyTitle="No stores yet"
          emptyDescription="Tenant stores will appear here once they have been provisioned."
          rowActions={(row) => [
            <button
              key={`status-${row.id}`}
              onClick={() => toggleStatus(row)}
              disabled={workingId === row.id}
              className={cn(
                actionBtn,
                "border-grey-20 bg-white text-grey-70 hover:bg-grey-10 hover:border-grey-30 hover:text-grey-90"
              )}
            >
              {row.status?.toLowerCase() === "suspended" ? "Resume" : "Suspend"}
            </button>,
            <button
              key={`credits-${row.id}`}
              onClick={() => {
                setGrantModal({ open: true, tenant: row })
                setCreditAmount("")
              }}
              disabled={workingId === row.id}
              className={cn(
                actionBtn,
                "border-grey-20 bg-white text-grey-70 hover:bg-grey-10 hover:border-grey-30 hover:text-grey-90"
              )}
            >
              <Plus className="h-3.5 w-3.5" />
              Credits
            </button>,
            <a
              key={`view-${row.id}`}
              href={storeUrl(row.slug)}
              target="_blank"
              rel="noreferrer"
              aria-label={`View ${row.name} store`}
              className={cn(
                actionBtn,
                "border-grey-20 bg-white text-grey-70 hover:bg-grey-10 hover:border-grey-30 hover:text-grey-90"
              )}
            >
              <ArrowUpRightOnBox className="h-3.5 w-3.5" />
            </a>,
            <button
              key={`delete-${row.id}`}
              onClick={() => setDeleteModal({ open: true, tenant: row })}
              disabled={workingId === row.id}
              aria-label={`Delete ${row.name}`}
              className={cn(
                actionBtn,
                "border-red-200 bg-white text-red-600 hover:bg-red-50 hover:border-red-300"
              )}
            >
              <Trash className="h-3.5 w-3.5" />
            </button>,
          ]}
        />
      </div>

      <Modal
        open={grantModal.open}
        onClose={() => setGrantModal({ open: false, tenant: null })}
        title="Grant credits"
        description={
          grantModal.tenant
            ? `Add credits to ${grantModal.tenant.name}.`
            : undefined
        }
        size="sm"
      >
        <form onSubmit={handleGrantSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="credit-amount"
              className="mb-1.5 block text-sm font-medium text-grey-70"
            >
              Amount (USD)
            </label>
            <input
              id="credit-amount"
              type="number"
              min="0.01"
              step="0.01"
              required
              value={creditAmount}
              onChange={(e) => setCreditAmount(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-base border border-grey-30 bg-white px-3 py-2.5 text-sm text-grey-90 placeholder:text-grey-40 transition-colors focus:border-grey-90 focus:outline-none focus:ring-2 focus:ring-grey-90/20"
            />
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setGrantModal({ open: false, tenant: null })}
              className="rounded-base border border-grey-20 bg-white px-4 py-2 text-sm font-medium text-grey-70 transition-all hover:bg-grey-10 hover:border-grey-30"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={workingId === grantModal.tenant?.id}
              className="rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-grey-80 disabled:opacity-50"
            >
              Grant
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, tenant: null })}
        title="Delete store"
        description={
          deleteModal.tenant
            ? `Are you sure you want to delete ${deleteModal.tenant.name}? This action cannot be undone.`
            : undefined
        }
        size="sm"
      >
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => setDeleteModal({ open: false, tenant: null })}
            className="rounded-base border border-grey-20 bg-white px-4 py-2 text-sm font-medium text-grey-70 transition-all hover:bg-grey-10 hover:border-grey-30"
          >
            Cancel
          </button>
          <button
            onClick={handleDeleteConfirm}
            disabled={workingId === deleteModal.tenant?.id}
            className="rounded-base bg-red-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-red-700 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </Modal>
    </div>
  )
}
