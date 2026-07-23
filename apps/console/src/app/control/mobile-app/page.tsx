"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArrowPath,
  ArrowUpRightOnBox,
  CheckCircle,
  CurrencyDollar,
  Phone,
  ExclamationCircle,
  InboxSolid,
} from "@medusajs/icons"
import { useControlAuth } from "@/lib/auth"
import {
  getMobileAppOrder,
  listMobileAppOrders,
  MOBILE_APP_STATUSES,
  setMobileAppDownload,
  setMobileAppStatus,
  type MobileAppKind,
  type MobileAppOrder,
  type MobileAppOrderDetail,
} from "@/lib/api/mobile-app"
import { DataTable, type Column } from "@/components/data-table"
import { KpiCard } from "@/components/kpi-card"
import { Modal } from "@/components/modal"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { cn } from "@/lib/utils"

const usd = (n: number | null | undefined) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(Number(n) || 0)

function formatDate(value: string | null | undefined): string {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

type StatusFilter = "all" | string
type KindFilter = "all" | MobileAppKind

const kindFilters: { value: KindFilter; label: string }[] = [
  { value: "all", label: "All kinds" },
  { value: "build", label: "Build" },
  { value: "publish", label: "Publish" },
]

const searchKeys: (keyof MobileAppOrder)[] = ["store_name", "tenant_id", "id"]

function KindBadge({ kind }: { kind: MobileAppKind }) {
  const isPublish = kind === "publish"
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-base px-2 py-1 text-xs font-medium ring-1 ring-inset",
        isPublish
          ? "bg-violet-50 text-violet-800 ring-violet-200"
          : "bg-sky-50 text-sky-800 ring-sky-200"
      )}
    >
      {isPublish ? "Publish" : "Build"}
    </span>
  )
}

function PaidCell({ order }: { order: MobileAppOrder }) {
  const paid = Number(order.amount_paid_usd) || 0
  if (paid > 0) {
    return (
      <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700">
        <CheckCircle className="h-3.5 w-3.5" />
        {usd(paid)}
      </span>
    )
  }
  return <span className="text-grey-40">Not paid</span>
}

export default function MobileAppPage() {
  const { token } = useControlAuth()

  const [orders, setOrders] = useState<MobileAppOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [kindFilter, setKindFilter] = useState<KindFilter>("all")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")

  // Detail drawer state
  const [detailOpen, setDetailOpen] = useState(false)
  const [detail, setDetail] = useState<MobileAppOrderDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  // Fulfil form state
  const [downloadUrl, setDownloadUrl] = useState("")
  const [statusDraft, setStatusDraft] = useState("")
  const [saving, setSaving] = useState<null | "download" | "status">(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const res = await listMobileAppOrders(token, {
        status: statusFilter === "all" ? undefined : statusFilter,
        kind: kindFilter === "all" ? undefined : kindFilter,
      })
      setOrders(res.orders)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load orders")
    } finally {
      setLoading(false)
    }
  }, [token, statusFilter, kindFilter])

  useEffect(() => {
    load()
  }, [load])

  const openDetail = useCallback(
    async (order: MobileAppOrder) => {
      if (!token) return
      setDetailOpen(true)
      setDetail(null)
      setDetailError(null)
      setNotice(null)
      setDetailLoading(true)
      try {
        const res = await getMobileAppOrder(token, order.id)
        setDetail(res.order)
        setDownloadUrl(res.order.download_url ?? "")
        setStatusDraft(res.order.status)
      } catch (err) {
        // Degrade gracefully: fall back to the row we already have.
        setDetail({
          ...order,
          stripe_event_id: null,
          meta: null,
          updated_at: order.created_at,
        })
        setDownloadUrl(order.download_url ?? "")
        setStatusDraft(order.status)
        setDetailError(
          err instanceof Error ? err.message : "Could not load full order detail"
        )
      } finally {
        setDetailLoading(false)
      }
    },
    [token]
  )

  const closeDetail = () => {
    setDetailOpen(false)
    setDetail(null)
    setDetailError(null)
    setNotice(null)
    setDownloadUrl("")
    setStatusDraft("")
  }

  const handleAttachDownload = async () => {
    if (!token || !detail) return
    setSaving("download")
    setNotice(null)
    setDetailError(null)
    try {
      const res = await setMobileAppDownload(token, detail.id, downloadUrl.trim())
      setDetail({ ...detail, download_url: res.download_url, status: res.status })
      setStatusDraft(res.status)
      setNotice("Download attached" + (detail.kind === "build" ? " and marked ready." : "."))
      await load()
    } catch (err) {
      setDetailError(
        err instanceof Error ? err.message : "Failed to attach download URL"
      )
    } finally {
      setSaving(null)
    }
  }

  const handleSetStatus = async () => {
    if (!token || !detail) return
    setSaving("status")
    setNotice(null)
    setDetailError(null)
    try {
      const res = await setMobileAppStatus(token, detail.id, statusDraft)
      setDetail({ ...detail, status: res.status })
      setNotice("Status updated.")
      await load()
    } catch (err) {
      setDetailError(
        err instanceof Error ? err.message : "Failed to update status"
      )
    } finally {
      setSaving(null)
    }
  }

  const statusOptions = useMemo(() => {
    const set = new Set<string>()
    orders.forEach((o) => set.add(o.status))
    return Array.from(set).sort()
  }, [orders])

  const kpis = useMemo(() => {
    const paidRevenue = orders.reduce(
      (sum, o) => sum + (Number(o.amount_paid_usd) || 0),
      0
    )
    const actionable = orders.filter((o) =>
      ["queued", "building", "paid", "in_progress"].includes(o.status)
    ).length
    return { total: orders.length, paidRevenue, actionable }
  }, [orders])

  const columns = useMemo<Column<MobileAppOrder>[]>(
    () => [
      {
        key: "store_name",
        header: "Store",
        render: (row) => (
          <div className="min-w-0">
            <p className="font-medium text-grey-90">{row.store_name}</p>
            <p className="truncate text-xs text-grey-40">{row.tenant_id ?? "—"}</p>
          </div>
        ),
      },
      {
        key: "kind",
        header: "Kind",
        render: (row) => <KindBadge kind={row.kind} />,
      },
      {
        key: "tier",
        header: "Tier",
        render: (row) => (
          <span className="capitalize text-grey-70">{row.tier ?? "—"}</span>
        ),
      },
      {
        key: "amount_paid_usd",
        header: "Paid",
        render: (row) => <PaidCell order={row} />,
      },
      {
        key: "status",
        header: "Status",
        render: (row) => <StatusBadge status={row.status} />,
      },
      {
        key: "created_at",
        header: "Created",
        render: (row) => (
          <span className="text-grey-60">{formatDate(row.created_at)}</span>
        ),
      },
    ],
    []
  )

  const fulfilStatuses = detail
    ? MOBILE_APP_STATUSES[detail.kind as MobileAppKind] ?? []
    : []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mobile App Orders"
        description="Fulfilment queue for white-label shopper-app build and paid publish orders."
        action={
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-base border border-grey-20 bg-white px-3 py-2 text-sm font-medium text-grey-70 transition-all hover:bg-grey-10 hover:border-grey-30 hover:text-grey-90 disabled:opacity-50"
          >
            <ArrowPath className={cn("h-4 w-4", loading && "animate-spin")} />
            Refresh
          </button>
        }
      />

      {error && (
        <div className="rounded-large border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
          <div className="flex items-start gap-3">
            <ExclamationCircle className="mt-0.5 h-5 w-5 shrink-0" />
            {error}
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          label="Total orders"
          value={kpis.total}
          icon={Phone}
          tone="grey"
        />
        <KpiCard
          label="Revenue collected"
          value={usd(kpis.paidRevenue)}
          icon={CurrencyDollar}
          tone="green"
        />
        <KpiCard
          label="Needs action"
          value={kpis.actionable}
          icon={InboxSolid}
          tone="brand"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-large border border-grey-20 bg-white p-1 shadow-borders-base w-fit">
          {kindFilters.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setKindFilter(filter.value)}
              className={cn(
                "rounded-base px-4 py-1.5 text-sm font-medium transition-all outline-none focus-visible:ring-2 focus-visible:ring-grey-90/20",
                kindFilter === filter.value
                  ? "bg-grey-90 text-white"
                  : "text-grey-70 hover:bg-grey-10 hover:text-grey-90"
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="appearance-none rounded-base border border-grey-20 bg-white px-3 py-2 text-sm text-grey-90 transition-colors focus:border-grey-90 focus:outline-none focus:ring-2 focus:ring-grey-90/20"
        >
          <option value="all">All statuses</option>
          {statusOptions.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-large border border-grey-20 bg-white p-5 shadow-borders-base">
        <DataTable
          columns={columns}
          rows={orders}
          searchKeys={searchKeys}
          isLoading={loading}
          emptyIcon={Phone}
          emptyTitle="No mobile app orders"
          emptyDescription="Build and publish orders from merchants will appear here."
          rowActions={(row) => [
            <button
              key={`view-${row.id}`}
              onClick={() => openDetail(row)}
              className="inline-flex items-center gap-1.5 rounded-base border border-grey-20 bg-white px-2.5 py-1.5 text-xs font-medium text-grey-70 transition-all outline-none hover:bg-grey-10 hover:border-grey-30 hover:text-grey-90 focus-visible:ring-2 focus-visible:ring-grey-90/20"
            >
              Manage
            </button>,
          ]}
        />
      </div>

      <Modal
        open={detailOpen}
        onClose={closeDetail}
        title={detail ? detail.store_name : "Order"}
        description={
          detail
            ? `${detail.kind === "publish" ? "Publish" : "Build"} order · ${detail.id}`
            : undefined
        }
        size="lg"
      >
        {detailLoading && !detail ? (
          <div className="space-y-3">
            <div className="h-4 w-1/3 animate-pulse rounded bg-grey-10" />
            <div className="h-24 w-full animate-pulse rounded bg-grey-10" />
            <div className="h-24 w-full animate-pulse rounded bg-grey-10" />
          </div>
        ) : detail ? (
          <div className="space-y-6">
            {detailError && (
              <div className="rounded-base border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {detailError}
              </div>
            )}
            {notice && (
              <div className="rounded-base border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                {notice}
              </div>
            )}

            {/* Branding */}
            <section>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-grey-40">
                Branding
              </h3>
              <div className="flex items-center gap-4 rounded-large border border-grey-20 bg-grey-5 p-4">
                <div
                  className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-large border border-grey-20 bg-white"
                  style={{
                    borderColor: detail.config_snapshot?.accent ?? undefined,
                  }}
                >
                  {detail.config_snapshot?.icon_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={detail.config_snapshot.icon_url}
                      alt="App icon"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Phone className="h-6 w-6 text-grey-40" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-grey-90">
                    {detail.config_snapshot?.app_name ?? "Untitled app"}
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-xs text-grey-50">
                    <span
                      className="inline-block h-3 w-3 rounded-full border border-grey-20"
                      style={{
                        backgroundColor:
                          detail.config_snapshot?.accent ?? "transparent",
                      }}
                    />
                    {detail.config_snapshot?.accent ?? "No accent color"}
                  </div>
                </div>
              </div>
            </section>

            {/* Money trail */}
            <section>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-grey-40">
                Money trail
              </h3>
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="rounded-base border border-grey-20 bg-white p-3">
                  <dt className="text-xs text-grey-50">Regular price</dt>
                  <dd className="mt-1 text-sm font-semibold text-grey-90">
                    {usd(detail.regular_price_usd)}
                  </dd>
                </div>
                <div className="rounded-base border border-grey-20 bg-white p-3">
                  <dt className="text-xs text-grey-50">Expected</dt>
                  <dd className="mt-1 text-sm font-semibold text-grey-90">
                    {usd(detail.expected_amount_usd)}
                  </dd>
                </div>
                <div
                  className={cn(
                    "rounded-base border p-3",
                    Number(detail.amount_paid_usd) > 0
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-grey-20 bg-white"
                  )}
                >
                  <dt className="text-xs text-grey-50">Paid</dt>
                  <dd
                    className={cn(
                      "mt-1 text-sm font-semibold",
                      Number(detail.amount_paid_usd) > 0
                        ? "text-emerald-700"
                        : "text-grey-40"
                    )}
                  >
                    {Number(detail.amount_paid_usd) > 0
                      ? usd(detail.amount_paid_usd)
                      : "Not paid"}
                  </dd>
                </div>
              </dl>
              <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-grey-50">
                <span>
                  Tier:{" "}
                  <span className="capitalize text-grey-70">
                    {detail.tier ?? "—"}
                  </span>
                </span>
                <span>
                  Current status: <StatusBadge status={detail.status} />
                </span>
                <span>Created: {formatDateTime(detail.created_at)}</span>
                {detail.stripe_event_id && (
                  <span>Stripe event: {detail.stripe_event_id}</span>
                )}
              </div>
            </section>

            {/* Fulfil */}
            <section>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-grey-40">
                Fulfilment
              </h3>
              <div className="space-y-4 rounded-large border border-grey-20 bg-grey-5 p-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-grey-70">
                    Download URL
                  </label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      type="url"
                      value={downloadUrl}
                      onChange={(e) => setDownloadUrl(e.target.value)}
                      placeholder="https://…/app-release.apk"
                      className="w-full rounded-base border border-grey-20 bg-white px-3 py-2 text-sm text-grey-90 placeholder:text-grey-40 transition-colors focus:border-grey-90 focus:outline-none focus:ring-2 focus:ring-grey-90/20"
                    />
                    <button
                      onClick={handleAttachDownload}
                      disabled={saving !== null || !downloadUrl.trim()}
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-grey-80 focus:outline-none focus:ring-2 focus:ring-grey-90/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {saving === "download" ? "Saving…" : "Attach & mark ready"}
                    </button>
                  </div>
                  {detail.download_url && (
                    <a
                      href={detail.download_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-sky-700 hover:underline"
                    >
                      <ArrowUpRightOnBox className="h-3.5 w-3.5" />
                      Current artifact
                    </a>
                  )}
                  {detail.kind === "build" && (
                    <p className="mt-1.5 text-xs text-grey-50">
                      Attaching a build artifact advances the order to{" "}
                      <span className="font-medium">ready</span> and reveals the
                      merchant&apos;s Download button.
                    </p>
                  )}
                </div>

                <div className="border-t border-grey-20 pt-4">
                  <label className="mb-1.5 block text-sm font-medium text-grey-70">
                    Advance status
                  </label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <select
                      value={statusDraft}
                      onChange={(e) => setStatusDraft(e.target.value)}
                      className="w-full appearance-none rounded-base border border-grey-20 bg-white px-3 py-2 text-sm text-grey-90 transition-colors focus:border-grey-90 focus:outline-none focus:ring-2 focus:ring-grey-90/20 sm:max-w-xs"
                    >
                      {fulfilStatuses.map((s) => (
                        <option key={s} value={s}>
                          {s.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={handleSetStatus}
                      disabled={saving !== null || statusDraft === detail.status}
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-base border border-grey-20 bg-white px-4 py-2 text-sm font-medium text-grey-70 transition-all hover:bg-grey-10 hover:border-grey-30 hover:text-grey-90 focus:outline-none focus:ring-2 focus:ring-grey-90/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {saving === "status" ? "Saving…" : "Update status"}
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <div className="flex justify-end">
              <button
                onClick={closeDetail}
                className="rounded-base border border-grey-20 bg-white px-4 py-2 text-sm font-medium text-grey-70 transition-all hover:bg-grey-10 hover:border-grey-30"
              >
                Close
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
