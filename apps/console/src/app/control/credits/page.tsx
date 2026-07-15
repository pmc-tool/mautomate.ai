"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArrowPath,
  BuildingStorefront,
  CreditCard,
  CurrencyDollar,
  ExclamationCircle,
  Plus,
} from "@medusajs/icons"
import { useControlAuth } from "@/lib/auth"
import { type Tenant, type Metrics } from "@/lib/api"
import {
  getPlatformMetrics,
  grantTenantCredits,
  listPlatformTenants,
} from "@/lib/api/credits"
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

function SkeletonValue() {
  return <div className="h-7 w-24 rounded bg-grey-10 animate-pulse" />
}

const searchKeys: (keyof Tenant)[] = ["name", "slug", "package", "status"]

export default function CreditsPage() {
  const { token } = useControlAuth()

  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [workingId, setWorkingId] = useState<string | null>(null)

  const [grantSource, setGrantSource] = useState<"grant" | "topup" | "plan">("grant")
  const [grantExpiryDays, setGrantExpiryDays] = useState("")
  const [grantReason, setGrantReason] = useState("")
  const [grantModal, setGrantModal] = useState<{
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
        getPlatformMetrics(token),
        listPlatformTenants(token),
      ])
      setMetrics(metricsRes.metrics)
      setTenants(tenantsRes.tenants)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load credits data")
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    load()
  }, [load])

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
      await grantTenantCredits(token, grantModal.tenant.id, amount, {
        source: grantSource,
        expires_in_days:
          grantSource === "topup" ? 0 : Number(grantExpiryDays) || 0,
        reason: grantReason || undefined,
      })
      await load()
      setGrantModal({ open: false, tenant: null })
      setCreditAmount("")
      setGrantSource("grant")
      setGrantExpiryDays("")
      setGrantReason("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to grant credits")
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
        key: "credit_balance",
        header: "Credit balance",
        className: "text-right",
        render: (row) => (
          <span className="tabular-nums text-grey-90">
            {Number(row.credit_balance ?? 0).toLocaleString()} cr
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
    </div>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Credits & Economy"
        description="Track platform credit grants, spend and outstanding balances across stores."
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Credits granted"
          value={loading ? <SkeletonValue /> : formatUsd(metrics?.credits_granted ?? 0)}
          icon={CurrencyDollar}
          tone="brand"
        />
        <KpiCard
          label="Credits spent"
          value={loading ? <SkeletonValue /> : formatUsd(metrics?.credits_spent ?? 0)}
          icon={CreditCard}
          tone="green"
        />
        <KpiCard
          label="Outstanding credits"
          value={loading ? <SkeletonValue /> : formatUsd(metrics?.credits_outstanding ?? 0)}
          icon={ExclamationCircle}
          tone="grey"
        />
        <KpiCard
          label="Total stores"
          value={loading ? <SkeletonValue /> : metrics?.tenants_total ?? 0}
          icon={BuildingStorefront}
          trend={loading ? undefined : `${tenants.length} loaded`}
          tone="grey"
        />
      </div>

      <div className="rounded-large border border-grey-20 bg-white p-5 shadow-borders-base">
        <h3 className="mb-4 font-semibold text-grey-90">Store credit balances</h3>
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
              key={`grant-${row.id}`}
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
              Grant credits
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
              Amount (credits)
            </label>
            <input
              id="credit-amount"
              type="number"
              min="1"
              step="1"
              required
              value={creditAmount}
              onChange={(e) => setCreditAmount(e.target.value)}
              placeholder="1000"
              className="w-full rounded-base border border-grey-30 bg-white px-3 py-2.5 text-sm text-grey-90 placeholder:text-grey-40 transition-colors focus:border-grey-90 focus:outline-none focus:ring-2 focus:ring-grey-90/20"
            />
            {Number(creditAmount) > 0 && (
              <p className="mt-1 text-xs text-grey-50">
                ≈ {formatUsd(Number(creditAmount) * 0.01)} of value at list rates
              </p>
            )}
          </div>

          {/* Source decides whether these credits can EVER expire. */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-grey-70">
              Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { k: "grant", t: "Goodwill", d: "Never expires" },
                  { k: "plan", t: "Plan allowance", d: "Expires" },
                  { k: "topup", t: "Manual top-up", d: "Purchased" },
                ] as const
              ).map((o) => (
                <button
                  key={o.k}
                  type="button"
                  onClick={() => setGrantSource(o.k)}
                  className={cn(
                    "rounded-base border px-2 py-2 text-left transition",
                    grantSource === o.k
                      ? "border-grey-90 bg-grey-90/5"
                      : "border-grey-20 hover:bg-grey-10"
                  )}
                >
                  <span className="block text-sm font-medium text-grey-90">{o.t}</span>
                  <span className="block text-xs text-grey-50">{o.d}</span>
                </button>
              ))}
            </div>
          </div>

          {grantSource !== "topup" && (
            <div>
              <label
                htmlFor="grant-expiry"
                className="mb-1.5 block text-sm font-medium text-grey-70"
              >
                Expires in (days)
              </label>
              <input
                id="grant-expiry"
                type="number"
                min="0"
                step="1"
                value={grantExpiryDays}
                onChange={(e) => setGrantExpiryDays(e.target.value)}
                placeholder="Leave blank = never expires"
                className="w-full rounded-base border border-grey-30 bg-white px-3 py-2.5 text-sm text-grey-90 placeholder:text-grey-40 transition-colors focus:border-grey-90 focus:outline-none focus:ring-2 focus:ring-grey-90/20"
              />
            </div>
          )}

          {grantSource === "topup" && (
            <p className="rounded-base border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
              Purchased credits never expire — that guarantee is enforced in the ledger.
            </p>
          )}

          <div>
            <label
              htmlFor="grant-reason"
              className="mb-1.5 block text-sm font-medium text-grey-70"
            >
              Reason (audit log)
            </label>
            <input
              id="grant-reason"
              type="text"
              value={grantReason}
              onChange={(e) => setGrantReason(e.target.value)}
              placeholder="e.g. compensation for outage"
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
    </div>
  )
}
