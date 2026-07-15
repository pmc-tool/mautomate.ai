"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowPath,
  BuildingStorefront,
  CheckCircle,
  ComputerDesktop,
  CreditCard,
  ExclamationCircle,
  Eye,
  Plus,
  Trash,
  Users,
} from "@medusajs/icons"
import { useControlAuth } from "@/lib/auth"
import {
  createMerchantLogin,
  deleteStore,
  getStore,
  grantCredits,
  impersonateStore,
  listMerchantLogins,
  listStores,
  provisionStore,
  resumeStore,
  setStorePlan,
  suspendStore,
  type MerchantLogin,
  type Store,
  type StoreDetail,
  type StoreDomain,
  type StoreWallet,
} from "@/lib/api/stores"
import { getPricing, type Package } from "@/lib/api/packages"
import { DataTable, type Column } from "@/components/data-table"
import { Modal } from "@/components/modal"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { cn } from "@/lib/utils"

function humanizePackage(pkg?: string | null): string {
  if (!pkg) return "Default"
  return pkg.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
}

function storeUrl(slug?: string | null): string {
  if (!slug) return "—"
  return `https://${slug}.mautomate.ai`
}

function formatDate(value?: string | null): string {
  if (!value) return "—"
  return new Date(value).toLocaleString()
}

function formatNumber(value: unknown): string {
  const n = Number(value)
  return Number.isFinite(n) ? n.toLocaleString() : "0"
}

function formatCurrency(value: unknown): string {
  const n = Number(value)
  return Number.isFinite(n) ? `$${n.toFixed(2)}` : "$0.00"
}

const searchKeys: (keyof Store)[] = ["name", "slug"]

export default function StoresPage() {
  const { token } = useControlAuth()

  const [stores, setStores] = useState<Store[]>([])
  const [packages, setPackages] = useState<Package[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [workingId, setWorkingId] = useState<string | null>(null)

  const [provisionOpen, setProvisionOpen] = useState(false)
  const [provisionSlug, setProvisionSlug] = useState("")
  const [provisionName, setProvisionName] = useState("")
  const [provisionAdminEmail, setProvisionAdminEmail] = useState("")
  const [provisionAdminPassword, setProvisionAdminPassword] = useState("")
  const [provisionOwnerName, setProvisionOwnerName] = useState("")
  const [provisionTrialCredits, setProvisionTrialCredits] = useState("")
  const [provisionPackage, setProvisionPackage] = useState("")
  const [provisionResult, setProvisionResult] = useState<{ password: string } | null>(null)

  const [detailModal, setDetailModal] = useState<{
    open: boolean
    store: Store | null
    detail: StoreDetail | null
    domains: StoreDomain[]
    wallet: StoreWallet
    usage_by_action: Record<string, number>
    audit: unknown[]
    logins: MerchantLogin[]
    loading: boolean
  }>({
    open: false,
    store: null,
    detail: null,
    domains: [],
    wallet: null,
    usage_by_action: {},
    audit: [],
    logins: [],
    loading: false,
  })

  const [merchantEmail, setMerchantEmail] = useState("")
  const [merchantPassword, setMerchantPassword] = useState("")
  const [merchantName, setMerchantName] = useState("")
  const [merchantLoading, setMerchantLoading] = useState(false)

  const [creditModal, setCreditModal] = useState<{
    open: boolean
    store: Store | null
  }>({ open: false, store: null })
  const [creditAmount, setCreditAmount] = useState("")

  const [planModal, setPlanModal] = useState<{
    open: boolean
    store: Store | null
  }>({ open: false, store: null })
  const [planKey, setPlanKey] = useState("")
  const [planGrant, setPlanGrant] = useState(false)

  const [deleteModal, setDeleteModal] = useState<{
    open: boolean
    store: Store | null
  }>({ open: false, store: null })

  const detailAbortRef = useRef<AbortController | null>(null)

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const res = await listStores(token)
      setStores(res.tenants)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load stores")
    } finally {
      setLoading(false)
    }
  }, [token])

  const loadPackages = useCallback(async () => {
    if (!token) return
    try {
      const res = await getPricing(token)
      const tiers = res.tiers || []
      setPackages(tiers)
      if (tiers.length > 0 && !provisionPackage) {
        setProvisionPackage(tiers[0].key)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load packages")
    }
  }, [token, provisionPackage])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (provisionOpen) {
      setProvisionResult(null)
      loadPackages()
    }
  }, [provisionOpen, loadPackages])

  const resetDetailAbort = () => {
    if (detailAbortRef.current) {
      detailAbortRef.current.abort()
      detailAbortRef.current = null
    }
  }

  const openDetail = async (store: Store) => {
    if (!token) return
    resetDetailAbort()
    const controller = new AbortController()
    detailAbortRef.current = controller
    setDetailModal({
      open: true,
      store,
      detail: null,
      domains: [],
      wallet: null,
      usage_by_action: {},
      audit: [],
      logins: [],
      loading: true,
    })
    try {
      const [detailRes, loginsRes] = await Promise.all([
        getStore(token, store.id, controller.signal),
        listMerchantLogins(token, store.id, controller.signal),
      ])
      if (controller.signal.aborted) return
      setDetailModal({
        open: true,
        store,
        detail: detailRes.tenant,
        domains: detailRes.domains ?? [],
        wallet: detailRes.wallet ?? null,
        usage_by_action: detailRes.usage_by_action ?? {},
        audit: detailRes.audit ?? [],
        logins: loginsRes.logins ?? [],
        loading: false,
      })
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return
      setError(err instanceof Error ? err.message : "Failed to load store details")
      setDetailModal((m) => ({ ...m, loading: false }))
    }
  }

  const closeDetail = () => {
    resetDetailAbort()
    setDetailModal({
      open: false,
      store: null,
      detail: null,
      domains: [],
      wallet: null,
      usage_by_action: {},
      audit: [],
      logins: [],
      loading: false,
    })
  }

  useEffect(() => {
    return () => {
      resetDetailAbort()
    }
  }, [])

  const handleToggleStatus = async (store: Store) => {
    if (!token) return
    setWorkingId(store.id)
    try {
      if (store.status?.toLowerCase() === "suspended") {
        await resumeStore(token, store.id)
      } else {
        await suspendStore(token, store.id)
      }
      await load()
      if (detailModal.store?.id === store.id) {
        resetDetailAbort()
        const controller = new AbortController()
        detailAbortRef.current = controller
        try {
          const [detailRes, loginsRes] = await Promise.all([
            getStore(token, store.id, controller.signal),
            listMerchantLogins(token, store.id, controller.signal),
          ])
          if (controller.signal.aborted) return
          setDetailModal((m) => ({
            ...m,
            store: detailRes.tenant,
            detail: detailRes.tenant,
            domains: detailRes.domains ?? [],
            wallet: detailRes.wallet ?? null,
            usage_by_action: detailRes.usage_by_action ?? {},
            audit: detailRes.audit ?? [],
            logins: loginsRes.logins ?? [],
            loading: false,
          }))
        } catch (err) {
          if (err instanceof Error && err.name === "AbortError") return
          setError(err instanceof Error ? err.message : "Failed to refresh store details")
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status")
    } finally {
      setWorkingId(null)
    }
  }

  const handleProvision = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!token) return
    const slug = provisionSlug.trim()
    if (!slug) return
    setWorkingId("provision")
    setProvisionResult(null)
    try {
      const res = await provisionStore(token, {
        slug,
        name: provisionName.trim() || undefined,
        admin_email: provisionAdminEmail.trim() || undefined,
        admin_password: provisionAdminPassword.trim() || undefined,
        owner_name: provisionOwnerName.trim() || undefined,
        trial_credits: provisionTrialCredits
          ? Number(provisionTrialCredits)
          : undefined,
        package: provisionPackage || undefined,
      })
      await load()
      setProvisionResult({ password: res.merchant.password })
      setProvisionSlug("")
      setProvisionName("")
      setProvisionAdminEmail("")
      setProvisionAdminPassword("")
      setProvisionOwnerName("")
      setProvisionTrialCredits("")
      setProvisionPackage(packages[0]?.key ?? "")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to provision store")
    } finally {
      setWorkingId(null)
    }
  }

  const handleGrantCredits = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!token || !creditModal.store) return
    const amount = Number(creditAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a positive credit amount")
      return
    }
    setWorkingId(creditModal.store.id)
    try {
      await grantCredits(token, creditModal.store.id, amount)
      await load()
      setCreditModal({ open: false, store: null })
      setCreditAmount("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to grant credits")
    } finally {
      setWorkingId(null)
    }
  }

  const handleChangePlan = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!token || !planModal.store) return
    const key = planKey.trim()
    if (!key) {
      setError("Select a plan")
      return
    }
    setWorkingId(planModal.store.id)
    try {
      await setStorePlan(token, planModal.store.id, key, planGrant)
      await load()
      setPlanModal({ open: false, store: null })
      setPlanGrant(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change plan")
    } finally {
      setWorkingId(null)
    }
  }

  const handleDelete = async () => {
    if (!token || !deleteModal.store) return
    setWorkingId(deleteModal.store.id)
    try {
      await deleteStore(token, deleteModal.store.id)
      await load()
      setDeleteModal({ open: false, store: null })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete store")
    } finally {
      setWorkingId(null)
    }
  }

  const handleImpersonate = async (store: Store) => {
    if (!token) return
    setWorkingId(store.id)
    try {
      const res = await impersonateStore(token, store.id)
      const base = res.store_url || res.backend_url || store.admin_url || storeUrl(store.slug)
      const url = res.token ? `${base}#imp=${encodeURIComponent(res.token)}` : base
      window.open(url, "_blank", "noopener,noreferrer")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to impersonate")
    } finally {
      setWorkingId(null)
    }
  }

  const handleCreateMerchant = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!token || !detailModal.store) return
    const email = merchantEmail.trim()
    const password = merchantPassword.trim()
    if (!email || !password) return
    if (password.length < 8) {
      setError("Password must be at least 8 characters")
      return
    }
    setMerchantLoading(true)
    try {
      await createMerchantLogin(token, detailModal.store.id, {
        email,
        password,
        name: merchantName.trim() || undefined,
      })
      const loginsRes = await listMerchantLogins(token, detailModal.store.id)
      setDetailModal((m) => ({ ...m, logins: loginsRes.logins }))
      setMerchantEmail("")
      setMerchantPassword("")
      setMerchantName("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create merchant login")
    } finally {
      setMerchantLoading(false)
    }
  }

  const columns = useMemo<Column<Store>[]>(
    () => [
      {
        key: "store",
        header: "Store",
        render: (row) => (
          <div>
            <p className="font-medium text-grey-90">{row.name}</p>
            <p className="text-xs text-grey-50">
              {row.subdomain ?? row.slug}.mautomate.ai
            </p>
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
        render: (row) => <StatusBadge status={row.status ?? ""} />,
      },
      {
        key: "credits",
        header: "Credits",
        className: "text-right",
        render: (row) => (
          <span className="tabular-nums text-grey-90">
            {formatNumber(row.credit_balance)}
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
        onClick={() => setProvisionOpen(true)}
        className="inline-flex items-center gap-2 rounded-base bg-grey-90 px-3 py-2 text-sm font-medium text-white transition-all hover:bg-grey-80 focus:outline-none focus:ring-2 focus:ring-grey-90/20"
      >
        <Plus className="h-4 w-4" />
        Provision store
      </button>
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
        title="Stores"
        description="Provision, monitor and manage tenant stores."
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

      <div className="rounded-large border border-grey-20 bg-white p-5 shadow-borders-base">
        <DataTable
          columns={columns}
          rows={stores}
          searchKeys={searchKeys}
          isLoading={loading}
          emptyIcon={BuildingStorefront}
          emptyTitle="No stores yet"
          emptyDescription="Tenant stores will appear here once they have been provisioned."
          rowActions={(row) => [
            <button
              key={`view-${row.id}`}
              onClick={() => openDetail(row)}
              disabled={workingId === row.id}
              className={cn(
                actionBtn,
                "border-grey-20 bg-white text-grey-70 hover:bg-grey-10 hover:border-grey-30 hover:text-grey-90"
              )}
              title="View details"
            >
              <Eye className="h-3.5 w-3.5" />
              Detail
            </button>,
            <button
              key={`status-${row.id}`}
              onClick={() => handleToggleStatus(row)}
              disabled={workingId === row.id}
              className={cn(
                actionBtn,
                row.status?.toLowerCase() === "suspended"
                  ? "border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300"
                  : "border-amber-200 bg-white text-amber-700 hover:bg-amber-50 hover:border-amber-300"
              )}
            >
              {row.status?.toLowerCase() === "suspended" ? (
                <>
                  <CheckCircle className="h-3.5 w-3.5" /> Resume
                </>
              ) : (
                <>
                  <ExclamationCircle className="h-3.5 w-3.5" /> Suspend
                </>
              )}
            </button>,
            <button
              key={`credits-${row.id}`}
              onClick={() => {
                setCreditModal({ open: true, store: row })
                setCreditAmount("")
              }}
              disabled={workingId === row.id}
              className={cn(
                actionBtn,
                "border-grey-20 bg-white text-grey-70 hover:bg-grey-10 hover:border-grey-30 hover:text-grey-90"
              )}
            >
              <CreditCard className="h-3.5 w-3.5" />
              Credits
            </button>,
            <button
              key={`plan-${row.id}`}
              onClick={() => {
                setPlanModal({ open: true, store: row })
                setPlanKey(row.package ?? "")
                setPlanGrant(false)
                loadPackages()
              }}
              disabled={workingId === row.id}
              className={cn(
                actionBtn,
                "border-grey-20 bg-white text-grey-70 hover:bg-grey-10 hover:border-grey-30 hover:text-grey-90"
              )}
              title="Change plan"
            >
              <CreditCard className="h-3.5 w-3.5" />
              Plan
            </button>,
            <button
              key={`impersonate-${row.id}`}
              onClick={() => handleImpersonate(row)}
              disabled={workingId === row.id}
              className={cn(
                actionBtn,
                "border-grey-20 bg-white text-grey-70 hover:bg-grey-10 hover:border-grey-30 hover:text-grey-90"
              )}
              title="Impersonate"
            >
              <ComputerDesktop className="h-3.5 w-3.5" />
              Impersonate
            </button>,
            <button
              key={`delete-${row.id}`}
              onClick={() => setDeleteModal({ open: true, store: row })}
              disabled={workingId === row.id}
              className={cn(
                actionBtn,
                "border-red-200 bg-white text-red-600 hover:bg-red-50 hover:border-red-300"
              )}
              title="Delete store"
            >
              <Trash className="h-3.5 w-3.5" />
            </button>,
          ]}
        />
      </div>

      {/* Provision modal */}
      <Modal
        open={provisionOpen}
        onClose={() => {
          setProvisionOpen(false)
          setProvisionResult(null)
        }}
        title="Provision store"
        description="Create a new tenant store and send login credentials."
        size="md"
      >
        {provisionResult ? (
          <div className="space-y-4">
            <div className="rounded-large border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              <p className="font-medium">Store provisioned successfully.</p>
              <p className="mt-1">
                Generated merchant password:{" "}
                <code className="rounded bg-white px-1.5 py-0.5 font-mono text-emerald-900">
                  {provisionResult.password}
                </code>
              </p>
              <p className="mt-2 text-xs text-emerald-700">
                Copy this password now — it will not be shown again.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setProvisionOpen(false)
                  setProvisionResult(null)
                }}
                className="rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-grey-80"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleProvision} className="space-y-4">
            <div>
              <label
                htmlFor="store-slug"
                className="mb-1.5 block text-sm font-medium text-grey-70"
              >
                Slug <span className="text-red-500">*</span>
              </label>
              <input
                id="store-slug"
                type="text"
                required
                value={provisionSlug}
                onChange={(e) => setProvisionSlug(e.target.value)}
                placeholder="acme-inc"
                className="w-full rounded-base border border-grey-30 bg-white px-3 py-2.5 text-sm text-grey-90 placeholder:text-grey-40 transition-colors focus:border-grey-90 focus:outline-none focus:ring-2 focus:ring-grey-90/20"
              />
            </div>
            <div>
              <label
                htmlFor="store-name"
                className="mb-1.5 block text-sm font-medium text-grey-70"
              >
                Store name
              </label>
              <input
                id="store-name"
                type="text"
                value={provisionName}
                onChange={(e) => setProvisionName(e.target.value)}
                placeholder="Acme Inc."
                className="w-full rounded-base border border-grey-30 bg-white px-3 py-2.5 text-sm text-grey-90 placeholder:text-grey-40 transition-colors focus:border-grey-90 focus:outline-none focus:ring-2 focus:ring-grey-90/20"
              />
            </div>
            <div>
              <label
                htmlFor="store-admin-email"
                className="mb-1.5 block text-sm font-medium text-grey-70"
              >
                Admin email
              </label>
              <input
                id="store-admin-email"
                type="email"
                value={provisionAdminEmail}
                onChange={(e) => setProvisionAdminEmail(e.target.value)}
                placeholder="admin@example.com"
                className="w-full rounded-base border border-grey-30 bg-white px-3 py-2.5 text-sm text-grey-90 placeholder:text-grey-40 transition-colors focus:border-grey-90 focus:outline-none focus:ring-2 focus:ring-grey-90/20"
              />
            </div>
            <div>
              <label
                htmlFor="store-admin-password"
                className="mb-1.5 block text-sm font-medium text-grey-70"
              >
                Admin password
              </label>
              <input
                id="store-admin-password"
                type="password"
                value={provisionAdminPassword}
                onChange={(e) => setProvisionAdminPassword(e.target.value)}
                placeholder="Leave blank to generate"
                className="w-full rounded-base border border-grey-30 bg-white px-3 py-2.5 text-sm text-grey-90 placeholder:text-grey-40 transition-colors focus:border-grey-90 focus:outline-none focus:ring-2 focus:ring-grey-90/20"
              />
            </div>
            <div>
              <label
                htmlFor="store-owner-name"
                className="mb-1.5 block text-sm font-medium text-grey-70"
              >
                Owner name
              </label>
              <input
                id="store-owner-name"
                type="text"
                value={provisionOwnerName}
                onChange={(e) => setProvisionOwnerName(e.target.value)}
                placeholder="Jane Doe"
                className="w-full rounded-base border border-grey-30 bg-white px-3 py-2.5 text-sm text-grey-90 placeholder:text-grey-40 transition-colors focus:border-grey-90 focus:outline-none focus:ring-2 focus:ring-grey-90/20"
              />
            </div>
            <div>
              <label
                htmlFor="store-trial-credits"
                className="mb-1.5 block text-sm font-medium text-grey-70"
              >
                Trial credits
              </label>
              <input
                id="store-trial-credits"
                type="number"
                min="0"
                step="0.01"
                value={provisionTrialCredits}
                onChange={(e) => setProvisionTrialCredits(e.target.value)}
                placeholder="0"
                className="w-full rounded-base border border-grey-30 bg-white px-3 py-2.5 text-sm text-grey-90 placeholder:text-grey-40 transition-colors focus:border-grey-90 focus:outline-none focus:ring-2 focus:ring-grey-90/20"
              />
            </div>
            <div>
              <label
                htmlFor="store-package"
                className="mb-1.5 block text-sm font-medium text-grey-70"
              >
                Package
              </label>
              <select
                id="store-package"
                value={provisionPackage}
                onChange={(e) => setProvisionPackage(e.target.value)}
                className="w-full rounded-base border border-grey-30 bg-white px-3 py-2.5 text-sm text-grey-90 transition-colors focus:border-grey-90 focus:outline-none focus:ring-2 focus:ring-grey-90/20"
              >
                {packages.length === 0 && <option value="">Default</option>}
                {packages.map((pkg) => (
                  <option key={pkg.key} value={pkg.key}>
                    {humanizePackage(pkg.key)} (${pkg.price_usd}/mo)
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setProvisionOpen(false)
                  setProvisionResult(null)
                }}
                className="rounded-base border border-grey-20 bg-white px-4 py-2 text-sm font-medium text-grey-70 transition-all hover:bg-grey-10 hover:border-grey-30"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={workingId === "provision"}
                className="rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-grey-80 disabled:opacity-50"
              >
                Provision
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Detail modal */}
      <Modal
        open={detailModal.open}
        onClose={closeDetail}
        title={detailModal.store?.name ?? "Store details"}
        description={detailModal.store ? storeUrl(detailModal.store.slug) : undefined}
        size="lg"
      >
        {detailModal.loading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="h-32 animate-pulse rounded-large bg-grey-10" />
              <div className="h-32 animate-pulse rounded-large bg-grey-10" />
            </div>
            <div className="h-40 animate-pulse rounded-large bg-grey-10" />
          </div>
        ) : detailModal.detail ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-large border border-grey-20 bg-grey-5 p-4">
                <h4 className="mb-3 text-sm font-semibold text-grey-70 uppercase tracking-wider">
                  Overview
                </h4>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-grey-50">Slug</dt>
                    <dd className="font-medium text-grey-90">{detailModal.detail.slug}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-grey-50">Package</dt>
                    <dd className="font-medium text-grey-90">
                      {humanizePackage(detailModal.detail.package)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-grey-50">Status</dt>
                    <dd>
                      <StatusBadge status={detailModal.detail.status ?? ""} />
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-grey-50">Credits</dt>
                    <dd className="font-medium text-grey-90">
                      {formatNumber(
                        detailModal.wallet?.credit_balance ?? detailModal.detail.credit_balance
                      )}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-large border border-grey-20 bg-grey-5 p-4">
                <h4 className="mb-3 text-sm font-semibold text-grey-70 uppercase tracking-wider">
                  Subscription
                </h4>
                {detailModal.detail.subscription ? (
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-grey-50">Plan</dt>
                      <dd className="font-medium text-grey-90">
                        {humanizePackage(detailModal.detail.subscription.package_key)}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-grey-50">Price</dt>
                      <dd className="font-medium text-grey-90">
                        {formatCurrency(detailModal.detail.subscription.price_usd)}/mo
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-grey-50">Cycle</dt>
                      <dd className="font-medium text-grey-90">
                        {detailModal.detail.subscription.billing_cycle}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-grey-50">Next billing</dt>
                      <dd className="font-medium text-grey-90">
                        {formatDate(detailModal.detail.subscription.next_billing_at)}
                      </dd>
                    </div>
                  </dl>
                ) : (
                  <p className="text-sm text-grey-50">No subscription data available.</p>
                )}
              </div>
            </div>

            {Object.keys(detailModal.usage_by_action ?? {}).length > 0 && (
              <div className="rounded-large border border-grey-20 bg-grey-5 p-4">
                <h4 className="mb-3 text-sm font-semibold text-grey-70 uppercase tracking-wider">
                  Usage
                </h4>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {Object.entries(detailModal.usage_by_action ?? {}).map(([key, value]) => (
                    <div key={key}>
                      <p className="text-xs text-grey-50">{humanizePackage(key)}</p>
                      <p className="text-lg font-semibold text-grey-90">{formatNumber(value)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-large border border-grey-20 bg-grey-5 p-4">
              <h4 className="mb-3 text-sm font-semibold text-grey-70 uppercase tracking-wider">
                Domains
              </h4>
              {detailModal.domains && detailModal.domains.length > 0 ? (
                <div className="space-y-2">
                  {detailModal.domains.map((domain) => (
                    <div
                      key={domain.id}
                      className="flex items-center justify-between rounded-base border border-grey-20 bg-white px-3 py-2 text-sm"
                    >
                      <span className="font-medium text-grey-90">{domain.domain}</span>
                      <div className="flex items-center gap-2">
                        {domain.is_primary && (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200">
                            Primary
                          </span>
                        )}
                        <StatusBadge status={domain.ssl_status ?? ""} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-grey-50">No domains configured.</p>
              )}
            </div>

            <div className="rounded-large border border-grey-20 bg-grey-5 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-sm font-semibold text-grey-70 uppercase tracking-wider">
                  Merchant logins
                </h4>
                <span className="text-xs text-grey-50">{(detailModal.logins ?? []).length} total</span>
              </div>

              <form onSubmit={handleCreateMerchant} className="mb-4 grid gap-2 sm:grid-cols-3">
                <input
                  type="email"
                  required
                  value={merchantEmail}
                  onChange={(e) => setMerchantEmail(e.target.value)}
                  placeholder="merchant@example.com"
                  className="rounded-base border border-grey-30 bg-white px-3 py-2 text-sm text-grey-90 placeholder:text-grey-40 transition-colors focus:border-grey-90 focus:outline-none focus:ring-2 focus:ring-grey-90/20"
                />
                <input
                  type="password"
                  required
                  minLength={8}
                  value={merchantPassword}
                  onChange={(e) => setMerchantPassword(e.target.value)}
                  placeholder="Password (min 8 chars)"
                  className="rounded-base border border-grey-30 bg-white px-3 py-2 text-sm text-grey-90 placeholder:text-grey-40 transition-colors focus:border-grey-90 focus:outline-none focus:ring-2 focus:ring-grey-90/20"
                />
                <input
                  type="text"
                  value={merchantName}
                  onChange={(e) => setMerchantName(e.target.value)}
                  placeholder="Name (optional)"
                  className="rounded-base border border-grey-30 bg-white px-3 py-2 text-sm text-grey-90 placeholder:text-grey-40 transition-colors focus:border-grey-90 focus:outline-none focus:ring-2 focus:ring-grey-90/20"
                />
                <button
                  type="submit"
                  disabled={merchantLoading}
                  className="inline-flex items-center gap-1.5 rounded-base bg-grey-90 px-3 py-2 text-sm font-medium text-white transition-all hover:bg-grey-80 disabled:opacity-50 sm:col-span-3 sm:w-fit"
                >
                  <Plus className="h-4 w-4" />
                  Add
                </button>
              </form>

              {(detailModal.logins ?? []).length > 0 ? (
                <div className="overflow-hidden rounded-base border border-grey-20 bg-white">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-grey-10 text-grey-70">
                      <tr>
                        <th className="px-3 py-2 font-medium">Email</th>
                        <th className="px-3 py-2 font-medium">Name</th>
                        <th className="px-3 py-2 font-medium">Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-grey-10">
                      {(detailModal.logins ?? []).map((login) => (
                        <tr key={login.id}>
                          <td className="px-3 py-2 text-grey-90">{login.email}</td>
                          <td className="px-3 py-2 text-grey-90">{login.name ?? "—"}</td>
                          <td className="px-3 py-2 text-grey-50">{formatDate(login.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-grey-50">No merchant logins yet.</p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() =>
                  detailModal.detail && handleToggleStatus(detailModal.detail)
                }
                className={cn(
                  actionBtn,
                  detailModal.detail?.status?.toLowerCase() === "suspended"
                    ? "border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300"
                    : "border-amber-200 bg-white text-amber-700 hover:bg-amber-50 hover:border-amber-300"
                )}
              >
                {detailModal.detail?.status?.toLowerCase() === "suspended" ? (
                  <>
                    <CheckCircle className="h-3.5 w-3.5" /> Resume
                  </>
                ) : (
                  <>
                    <ExclamationCircle className="h-3.5 w-3.5" /> Suspend
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setDetailModal((m) => ({ ...m, open: false }))
                  setCreditModal({ open: true, store: detailModal.detail })
                  setCreditAmount("")
                }}
                className={cn(
                  actionBtn,
                  "border-grey-20 bg-white text-grey-70 hover:bg-grey-10 hover:border-grey-30 hover:text-grey-90"
                )}
              >
                <CreditCard className="h-3.5 w-3.5" /> Credits
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-grey-50">Unable to load store details.</p>
        )}
      </Modal>

      {/* Credits modal */}
      <Modal
        open={creditModal.open}
        onClose={() => setCreditModal({ open: false, store: null })}
        title="Grant credits"
        description={creditModal.store ? `Add credits to ${creditModal.store.name}.` : undefined}
        size="sm"
      >
        <form onSubmit={handleGrantCredits} className="space-y-4">
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
              onClick={() => setCreditModal({ open: false, store: null })}
              className="rounded-base border border-grey-20 bg-white px-4 py-2 text-sm font-medium text-grey-70 transition-all hover:bg-grey-10 hover:border-grey-30"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={workingId === creditModal.store?.id}
              className="rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-grey-80 disabled:opacity-50"
            >
              Grant
            </button>
          </div>
        </form>
      </Modal>

      {/* Plan modal */}
      <Modal
        open={planModal.open}
        onClose={() => setPlanModal({ open: false, store: null })}
        title="Change plan"
        description={
          planModal.store
            ? `Change the subscription plan for ${planModal.store.name}.`
            : undefined
        }
        size="sm"
      >
        <form onSubmit={handleChangePlan} className="space-y-4">
          <div>
            <label
              htmlFor="plan-key"
              className="mb-1.5 block text-sm font-medium text-grey-70"
            >
              Plan
            </label>
            <select
              id="plan-key"
              value={planKey}
              onChange={(e) => setPlanKey(e.target.value)}
              className="w-full rounded-base border border-grey-30 bg-white px-3 py-2.5 text-sm text-grey-90 transition-colors focus:border-grey-90 focus:outline-none focus:ring-2 focus:ring-grey-90/20"
            >
              {packages.length === 0 && (
                <option value={planKey}>{humanizePackage(planKey)}</option>
              )}
              {packages.map((pkg) => (
                <option key={pkg.key} value={pkg.key}>
                  {humanizePackage(pkg.key)} (${pkg.price_usd}/mo)
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-grey-70">
            <input
              type="checkbox"
              checked={planGrant}
              onChange={(e) => setPlanGrant(e.target.checked)}
              className="h-4 w-4 rounded border-grey-30"
            />
            Also grant this plan&apos;s included credits now
          </label>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setPlanModal({ open: false, store: null })}
              className="rounded-base border border-grey-20 bg-white px-4 py-2 text-sm font-medium text-grey-70 transition-all hover:bg-grey-10 hover:border-grey-30"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={workingId === planModal.store?.id}
              className="rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-grey-80 disabled:opacity-50"
            >
              Change plan
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete modal */}
      <Modal
        open={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, store: null })}
        title="Delete store"
        description={
          deleteModal.store
            ? `Are you sure you want to delete ${deleteModal.store.name}? This action cannot be undone.`
            : undefined
        }
        size="sm"
      >
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => setDeleteModal({ open: false, store: null })}
            className="rounded-base border border-grey-20 bg-white px-4 py-2 text-sm font-medium text-grey-70 transition-all hover:bg-grey-10 hover:border-grey-30"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={workingId === deleteModal.store?.id}
            className="rounded-base bg-red-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-red-700 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </Modal>
    </div>
  )
}
