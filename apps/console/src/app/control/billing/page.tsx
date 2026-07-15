"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArrowPath,
  ArrowRightOnRectangle,
  CreditCard,
  CurrencyDollar,
  ExclamationCircle,
  ReceiptPercent,
  Wrench,
  Trash,
  Bolt,
} from "@medusajs/icons"
import { useControlAuth } from "@/lib/auth"
import {
  getBilling,
  setIntegrationKey,
  clearIntegrationKey,
  testIntegrationKey,
  type BillingResponse,
  type PaymentGateway,
} from "@/lib/api/billing"
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

type PackageRevenueRow = {
  key: string
  package: string
  revenue: number
}

function flattenPackageRevenue(byPackage: Record<string, number> | null | undefined): PackageRevenueRow[] {
  if (!byPackage) return []
  return Object.entries(byPackage).map(([key, revenue]) => ({
    key,
    package: humanizePackage(key),
    revenue: Number(revenue) || 0,
  }))
}

export default function BillingPage() {
  const { token, logout } = useControlAuth()

  const [billing, setBilling] = useState<BillingResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [working, setWorking] = useState(false)
  const [testing, setTesting] = useState(false)

  const [configModal, setConfigModal] = useState<{
    open: boolean
    gateway: PaymentGateway | null
  }>({ open: false, gateway: null })

  const [stripeSecret, setStripeSecret] = useState("")
  const [stripeWebhook, setStripeWebhook] = useState("")
  const [sslcommerzStoreId, setSslcommerzStoreId] = useState("")
  const [sslcommerzPassword, setSslcommerzPassword] = useState("")

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const res = await getBilling(token)
      setBilling(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load billing data")
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  const openConfigModal = (gateway: PaymentGateway) => {
    setConfigModal({ open: true, gateway })
    setStripeSecret("")
    setStripeWebhook("")
    setSslcommerzStoreId("")
    setSslcommerzPassword("")
    setError(null)
  }

  const handleSaveConfig = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!token || !configModal.gateway) return

    setWorking(true)
    setError(null)
    try {
      if (configModal.gateway.name === "stripe") {
        if (stripeSecret.trim()) {
          await setIntegrationKey(token, "STRIPE_SECRET_KEY", stripeSecret.trim())
        }
        if (stripeWebhook.trim()) {
          await setIntegrationKey(token, "STRIPE_WEBHOOK_SECRET", stripeWebhook.trim())
        }
      } else {
        if (sslcommerzStoreId.trim()) {
          await setIntegrationKey(token, "SSLCOMMERZ_STORE_ID", sslcommerzStoreId.trim())
        }
        if (sslcommerzPassword.trim()) {
          await setIntegrationKey(token, "SSLCOMMERZ_STORE_PASSWD", sslcommerzPassword.trim())
        }
      }
      await load()
      setConfigModal({ open: false, gateway: null })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save gateway credentials")
    } finally {
      setWorking(false)
    }
  }

  const handleClearConfig = async () => {
    if (!token || !configModal.gateway) return
    setWorking(true)
    setError(null)
    try {
      if (configModal.gateway.name === "stripe") {
        await clearIntegrationKey(token, "STRIPE_SECRET_KEY")
        await clearIntegrationKey(token, "STRIPE_WEBHOOK_SECRET")
      } else {
        await clearIntegrationKey(token, "SSLCOMMERZ_STORE_ID")
        await clearIntegrationKey(token, "SSLCOMMERZ_STORE_PASSWD")
      }
      await load()
      setConfigModal({ open: false, gateway: null })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear gateway credentials")
    } finally {
      setWorking(false)
    }
  }

  const handleTest = async () => {
    if (!token || configModal.gateway?.name !== "stripe") return
    setTesting(true)
    setError(null)
    try {
      const res = await testIntegrationKey(token, "STRIPE_SECRET_KEY")
      if (res.ok) {
        setError(null)
        alert(res.message || "Stripe credentials are valid")
      } else {
        setError(res.message || "Stripe test failed")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to test Stripe credentials")
    } finally {
      setTesting(false)
    }
  }

  const actionBtn =
    "inline-flex items-center gap-1.5 rounded-base border px-2.5 py-1.5 text-xs font-medium transition-all outline-none focus-visible:ring-2 focus-visible:ring-grey-90/20 disabled:cursor-not-allowed disabled:opacity-50"

  const gatewayColumns = useMemo<Column<PaymentGateway>[]>(
    () => [
      {
        key: "name",
        header: "Gateway",
        render: (row) => <span className="font-medium text-grey-90 capitalize">{row.name}</span>,
      },
      {
        key: "region",
        header: "Region",
        render: (row) => (
          <span className="text-grey-70">{row.serves_bd ? "Bangladesh" : "Global"}</span>
        ),
      },
      {
        key: "configured",
        header: "Status",
        render: (row) => (
          <StatusBadge status={row.configured ? "configured" : "not_configured"} />
        ),
      },
    ],
    []
  )

  const packageColumns = useMemo<Column<PackageRevenueRow>[]>(
    () => [
      {
        key: "package",
        header: "Package",
        render: (row) => <span className="font-medium text-grey-90">{row.package}</span>,
      },
      {
        key: "revenue",
        header: "Revenue",
        className: "text-right",
        render: (row) => (
          <span className="tabular-nums text-grey-90">{formatUsd(row.revenue)}</span>
        ),
      },
    ],
    []
  )

  const packageRows = useMemo(
    () => flattenPackageRevenue(billing?.by_package),
    [billing?.by_package]
  )

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
        title="Billing & Finance"
        description="Platform revenue, payment gateways, and package breakdowns."
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

      {billing?.wired === false && (
        <div className="rounded-large border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 shadow-sm">
          <div className="flex items-start gap-3">
            <ExclamationCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <p>
              Real payment processing is not yet wired. Figures shown are projected or
              modelled until live gateways are connected.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          label="MRR"
          value={loading ? <SkeletonValue /> : formatUsd(billing?.mrr_usd ?? 0)}
          icon={CurrencyDollar}
          tone="green"
        />
        <KpiCard
          label="Top-up revenue"
          value={loading ? <SkeletonValue /> : formatUsd(billing?.topup_revenue_usd ?? 0)}
          icon={CreditCard}
          tone="brand"
        />
        <KpiCard
          label="Total revenue"
          value={loading ? <SkeletonValue /> : formatUsd(billing?.revenue_total_usd ?? 0)}
          icon={ReceiptPercent}
          tone="green"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-large border border-grey-20 bg-white p-5 shadow-borders-base">
          <h3 className="mb-4 font-semibold text-grey-90">Payment gateways</h3>
          <DataTable
            columns={gatewayColumns}
            rows={billing?.gateways ?? []}
            searchKeys={["name"]}
            isLoading={loading}
            emptyIcon={CreditCard}
            emptyTitle="No gateways"
            emptyDescription="Configured payment gateways will appear here once available."
            rowActions={(row) => [
              <button
                key={`config-${row.name}`}
                onClick={() => openConfigModal(row)}
                className={cn(
                  actionBtn,
                  "border-grey-20 bg-white text-grey-70 hover:bg-grey-10 hover:border-grey-30 hover:text-grey-90"
                )}
              >
                <Wrench className="h-3.5 w-3.5" />
                Configure
              </button>,
            ]}
          />
        </div>

        <div className="rounded-large border border-grey-20 bg-white p-5 shadow-borders-base">
          <h3 className="mb-4 font-semibold text-grey-90">Revenue by package</h3>
          <DataTable
            columns={packageColumns}
            rows={packageRows}
            searchKeys={["package"]}
            isLoading={loading}
            emptyIcon={CurrencyDollar}
            emptyTitle="No package revenue"
            emptyDescription="Package revenue breakdowns will appear here once billing data is available."
          />
        </div>
      </div>

      <Modal
        open={configModal.open}
        onClose={() => setConfigModal({ open: false, gateway: null })}
        title={`Configure ${configModal.gateway?.name ?? "gateway"}`}
        description={
          configModal.gateway
            ? `Set the API credentials for ${configModal.gateway.name}. Empty fields are left unchanged.`
            : undefined
        }
        size="md"
      >
        <form onSubmit={handleSaveConfig} className="space-y-4">
          {configModal.gateway?.name === "stripe" ? (
            <>
              <div>
                <label
                  htmlFor="stripe-secret"
                  className="mb-1.5 block text-sm font-medium text-grey-70"
                >
                  Stripe secret key
                </label>
                <input
                  id="stripe-secret"
                  type="password"
                  value={stripeSecret}
                  onChange={(e) => setStripeSecret(e.target.value)}
                  placeholder="sk_live_..."
                  className="w-full rounded-base border border-grey-30 bg-white px-3 py-2.5 text-sm text-grey-90 placeholder:text-grey-40 transition-colors focus:border-grey-90 focus:outline-none focus:ring-2 focus:ring-grey-90/20"
                />
              </div>
              <div>
                <label
                  htmlFor="stripe-webhook"
                  className="mb-1.5 block text-sm font-medium text-grey-70"
                >
                  Stripe webhook secret
                </label>
                <input
                  id="stripe-webhook"
                  type="password"
                  value={stripeWebhook}
                  onChange={(e) => setStripeWebhook(e.target.value)}
                  placeholder="whsec_..."
                  className="w-full rounded-base border border-grey-30 bg-white px-3 py-2.5 text-sm text-grey-90 placeholder:text-grey-40 transition-colors focus:border-grey-90 focus:outline-none focus:ring-2 focus:ring-grey-90/20"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label
                  htmlFor="sslcommerz-store-id"
                  className="mb-1.5 block text-sm font-medium text-grey-70"
                >
                  SSLCommerz store ID
                </label>
                <input
                  id="sslcommerz-store-id"
                  type="text"
                  value={sslcommerzStoreId}
                  onChange={(e) => setSslcommerzStoreId(e.target.value)}
                  placeholder="yourstore..."
                  className="w-full rounded-base border border-grey-30 bg-white px-3 py-2.5 text-sm text-grey-90 placeholder:text-grey-40 transition-colors focus:border-grey-90 focus:outline-none focus:ring-2 focus:ring-grey-90/20"
                />
              </div>
              <div>
                <label
                  htmlFor="sslcommerz-password"
                  className="mb-1.5 block text-sm font-medium text-grey-70"
                >
                  SSLCommerz store password
                </label>
                <input
                  id="sslcommerz-password"
                  type="password"
                  value={sslcommerzPassword}
                  onChange={(e) => setSslcommerzPassword(e.target.value)}
                  placeholder="..."
                  className="w-full rounded-base border border-grey-30 bg-white px-3 py-2.5 text-sm text-grey-90 placeholder:text-grey-40 transition-colors focus:border-grey-90 focus:outline-none focus:ring-2 focus:ring-grey-90/20"
                />
              </div>
            </>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2">
            {configModal.gateway?.name === "stripe" && (
              <button
                type="button"
                onClick={handleTest}
                disabled={testing || working}
                className="inline-flex items-center gap-2 rounded-base border border-grey-20 bg-white px-4 py-2 text-sm font-medium text-grey-70 transition-all hover:bg-grey-10 hover:border-grey-30 disabled:opacity-50"
              >
                <Bolt className={cn("h-4 w-4", testing && "animate-pulse")} />
                {testing ? "Testing..." : "Test"}
              </button>
            )}
            <button
              type="button"
              onClick={handleClearConfig}
              disabled={working}
              className="inline-flex items-center gap-2 rounded-base border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 transition-all hover:bg-red-50 hover:border-red-300 disabled:opacity-50"
            >
              <Trash className="h-4 w-4" />
              Clear
            </button>
            <button
              type="button"
              onClick={() => setConfigModal({ open: false, gateway: null })}
              className="rounded-base border border-grey-20 bg-white px-4 py-2 text-sm font-medium text-grey-70 transition-all hover:bg-grey-10 hover:border-grey-30"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={working}
              className="rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-grey-80 disabled:opacity-50"
            >
              {working ? "Saving..." : "Save credentials"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
