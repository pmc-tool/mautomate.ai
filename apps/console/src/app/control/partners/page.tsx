"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArrowPath,
  Buildings,
  Check,
  CogSixTooth,
  CurrencyDollar,
  ExclamationCircle,
  PencilSquare,
  Plus,
  SquareTwoStack,
  Trash,
  UsersSolid,
} from "@medusajs/icons"
import { useControlAuth } from "@/lib/auth"
import { ApiError } from "@/lib/api"
import {
  attachPartnerReferral,
  createPartner,
  deletePartner,
  getPartnerOverview,
  listPartners,
  listPayoutRequests,
  setPartnerCredentials,
  settlePartnerPayout,
  updatePartner,
  type Partner,
  type PartnerTier,
  type PartnerStatus,
  type PartnerInput,
  type PartnerOverviewResponse,
  type PartnerCredentialsResponse,
  type PartnerReferral,
  type PartnerCommission,
  type PartnerPayout,
  type PartnerPayoutRequest,
} from "@/lib/api/partners"
import { DataTable, type Column } from "@/components/data-table"
import { KpiCard } from "@/components/kpi-card"
import { Modal } from "@/components/modal"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { cn } from "@/lib/utils"

const tierOptions: { value: PartnerTier; label: string }[] = [
  { value: "bronze", label: "Bronze" },
  { value: "silver", label: "Silver" },
  { value: "gold", label: "Gold" },
]

const statusOptions = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
]

const searchKeys: (keyof Partner)[] = ["name", "company", "email", "referral_code"]

function formatCommission(value: number | null | undefined): string {
  return `${safeNumber(value)}%`
}

function safeNumber(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function formatCents(value: number | null | undefined): string {
  return `$${(safeNumber(value) / 100).toFixed(2)}`
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString()
}

function tierBadge(tier: PartnerTier | null | undefined) {
  const validTier: PartnerTier = tier === "bronze" || tier === "silver" || tier === "gold" ? tier : "bronze"
  const classes: Record<PartnerTier, string> = {
    bronze: "bg-amber-700/10 text-amber-800 ring-amber-700/20",
    silver: "bg-slate-100 text-slate-700 ring-slate-200",
    gold: "bg-amber-50 text-amber-700 ring-amber-200",
  }
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium capitalize ring-1 ring-inset",
        classes[validTier]
      )}
    >
      {validTier}
    </span>
  )
}

function nullText(value: string | null): string {
  return value ?? "—"
}

type PartnerForm = PartnerInput & { status?: PartnerStatus }

const emptyPartner: PartnerForm = {
  name: "",
  email: "",
  company: "",
  tier: "bronze",
  commission_pct: 10,
  referral_code: "",
  status: "active",
}

export default function PartnersPage() {
  const { token } = useControlAuth()

  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [workingId, setWorkingId] = useState<string | null>(null)

  const [editorOpen, setEditorOpen] = useState(false)
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null)
  const [form, setForm] = useState<PartnerForm>(emptyPartner)

  const [deleteModal, setDeleteModal] = useState<{ open: boolean; partner: Partner | null }>({
    open: false,
    partner: null,
  })

  const [manageOpen, setManageOpen] = useState(false)
  const [managePartner, setManagePartner] = useState<Partner | null>(null)
  const [overview, setOverview] = useState<PartnerOverviewResponse | null>(null)
  const [overviewLoading, setOverviewLoading] = useState(false)
  const [manageError, setManageError] = useState<string | null>(null)

  const [credentials, setCredentials] = useState<PartnerCredentialsResponse | null>(null)
  const [credentialsError, setCredentialsError] = useState<string | null>(null)
  const [credentialsWorking, setCredentialsWorking] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const [attachSlug, setAttachSlug] = useState("")
  const [attachError, setAttachError] = useState<string | null>(null)
  const [attachWorking, setAttachWorking] = useState(false)

  const [payoutWorkingId, setPayoutWorkingId] = useState<string | null>(null)
  const [payoutError, setPayoutError] = useState<string | null>(null)

  const [payoutRequests, setPayoutRequests] = useState<PartnerPayoutRequest[]>([])
  const [requestsError, setRequestsError] = useState<string | null>(null)
  const [requestWorkingId, setRequestWorkingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const res = await listPartners(token)
      setPartners(res.partners)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load partners")
    } finally {
      setLoading(false)
    }
  }, [token])

  const loadRequests = useCallback(async () => {
    if (!token) return
    setRequestsError(null)
    try {
      const res = await listPayoutRequests(token)
      setPayoutRequests(res.requests)
    } catch (err) {
      setRequestsError(err instanceof Error ? err.message : "Failed to load payout requests")
    }
  }, [token])

  useEffect(() => {
    load()
    loadRequests()
  }, [load, loadRequests])

  const loadOverview = useCallback(
    async (partnerId: string) => {
      if (!token) return
      setOverviewLoading(true)
      setManageError(null)
      try {
        const res = await getPartnerOverview(token, partnerId)
        setOverview(res)
      } catch (err) {
        setManageError(err instanceof Error ? err.message : "Failed to load partner overview")
      } finally {
        setOverviewLoading(false)
      }
    },
    [token]
  )

  const openCreate = () => {
    setEditingPartner(null)
    setForm(emptyPartner)
    setEditorOpen(true)
  }

  const openEdit = (partner: Partner) => {
    setEditingPartner(partner)
    setForm({
      name: partner.name,
      email: partner.email ?? "",
      company: partner.company ?? "",
      tier: partner.tier,
      commission_pct: partner.commission_pct,
      referral_code: partner.referral_code ?? "",
    })
    setEditorOpen(true)
  }

  const openManage = (partner: Partner) => {
    setManagePartner(partner)
    setOverview(null)
    setManageError(null)
    setCredentials(null)
    setCredentialsError(null)
    setCopiedField(null)
    setAttachSlug("")
    setAttachError(null)
    setPayoutError(null)
    setManageOpen(true)
    loadOverview(partner.id)
  }

  const closeManage = () => {
    setManageOpen(false)
    setManagePartner(null)
    setOverview(null)
    setCredentials(null)
    setCredentialsError(null)
    setAttachError(null)
    setPayoutError(null)
  }

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!token) return
    if (!form.name.trim()) {
      setError("Partner name is required")
      return
    }
    setWorkingId(editingPartner?.id ?? "create")
    try {
      const payload: PartnerInput = {
        ...form,
        name: form.name.trim(),
        email: form.email?.trim() || undefined,
        company: form.company?.trim() || undefined,
        referral_code: form.referral_code?.trim() || undefined,
      }
      if (editingPartner) {
        await updatePartner(token, editingPartner.id, {
          tier: payload.tier,
          status: form.status as PartnerStatus | undefined,
          commission_pct: payload.commission_pct,
          company: payload.company,
          email: payload.email,
        })
      } else {
        await createPartner(token, payload)
      }
      await load()
      setEditorOpen(false)
      setForm(emptyPartner)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save partner")
    } finally {
      setWorkingId(null)
    }
  }

  const handleDelete = async () => {
    if (!token || !deleteModal.partner) return
    setWorkingId(deleteModal.partner.id)
    try {
      await deletePartner(token, deleteModal.partner.id)
      await load()
      setDeleteModal({ open: false, partner: null })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete partner")
    } finally {
      setWorkingId(null)
    }
  }

  const handleCreateCredentials = async () => {
    if (!token || !managePartner) return
    setCredentialsWorking(true)
    setCredentialsError(null)
    try {
      const res = await setPartnerCredentials(token, managePartner.id)
      setCredentials(res)
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setCredentialsError("A login already exists for this partner's email.")
      } else {
        setCredentialsError(err instanceof Error ? err.message : "Failed to create login")
      }
    } finally {
      setCredentialsWorking(false)
    }
  }

  const handleCopy = async (value: string, field: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    } catch {
      setCredentialsError("Failed to copy to clipboard")
    }
  }

  const handleAttachReferral = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!token || !managePartner || !attachSlug.trim()) return
    setAttachWorking(true)
    setAttachError(null)
    try {
      await attachPartnerReferral(token, managePartner.id, { slug: attachSlug.trim() })
      setAttachSlug("")
      await loadOverview(managePartner.id)
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setAttachError("No store found with that slug.")
      } else if (err instanceof ApiError && err.status === 409) {
        setAttachError("That store is already attributed to a partner.")
      } else {
        setAttachError(err instanceof Error ? err.message : "Failed to attach store")
      }
    } finally {
      setAttachWorking(false)
    }
  }

  const handleSettlePayout = async (payoutId: string, status: "paid" | "rejected") => {
    if (!token || !managePartner) return
    setPayoutWorkingId(payoutId)
    setPayoutError(null)
    try {
      await settlePartnerPayout(token, managePartner.id, payoutId, { status })
      await loadOverview(managePartner.id)
      await loadRequests()
    } catch (err) {
      setPayoutError(err instanceof Error ? err.message : "Failed to update payout")
    } finally {
      setPayoutWorkingId(null)
    }
  }

  const handleSettleRequest = async (
    request: PartnerPayoutRequest,
    status: "paid" | "rejected"
  ) => {
    if (!token) return
    setRequestWorkingId(request.id)
    setRequestsError(null)
    try {
      await settlePartnerPayout(token, request.partner_id, request.id, { status })
      await loadRequests()
      if (manageOpen && managePartner) {
        await loadOverview(managePartner.id)
      }
    } catch (err) {
      setRequestsError(err instanceof Error ? err.message : "Failed to update payout")
    } finally {
      setRequestWorkingId(null)
    }
  }

  const activeCount = useMemo(
    () => partners.filter((p) => p.status === "active").length,
    [partners]
  )

  const columns = useMemo<Column<Partner>[]>(
    () => [
      {
        key: "name",
        header: "Name",
        render: (row) => (
          <div>
            <p className="font-medium text-grey-90">{row.name}</p>
          </div>
        ),
      },
      {
        key: "company",
        header: "Company",
        render: (row) => <span className="text-grey-70">{nullText(row.company)}</span>,
      },
      {
        key: "email",
        header: "Email",
        render: (row) => <span className="text-grey-70">{nullText(row.email)}</span>,
      },
      {
        key: "tier",
        header: "Tier",
        render: (row) => tierBadge(row.tier),
      },
      {
        key: "commission_pct",
        header: "Commission %",
        render: (row) => <span className="text-grey-70">{formatCommission(row.commission_pct)}</span>,
      },
      {
        key: "status",
        header: "Status",
        render: (row) => <StatusBadge status={row.status} />,
      },
      {
        key: "referral_code",
        header: "Referral code",
        render: (row) => (
          <span className="font-mono text-xs text-grey-60">{nullText(row.referral_code)}</span>
        ),
      },
    ],
    []
  )

  const referralColumns = useMemo<Column<PartnerReferral>[]>(
    () => [
      {
        key: "store",
        header: "Store",
        render: (row) =>
          row.store ? (
            <div>
              <p className="font-medium text-grey-90">{row.store.name}</p>
              <p className="font-mono text-xs text-grey-50">{row.store.slug}</p>
            </div>
          ) : (
            <span className="font-mono text-xs text-grey-60">{row.tenant_id}</span>
          ),
      },
      {
        key: "status",
        header: "Status",
        render: (row) =>
          row.store ? <StatusBadge status={row.store.status} /> : <span className="text-grey-50">—</span>,
      },
      {
        key: "package",
        header: "Package",
        render: (row) => (
          <span className="capitalize text-grey-70">{row.store ? row.store.package : "—"}</span>
        ),
      },
      {
        key: "referred_at",
        header: "Referred",
        render: (row) => <span className="text-grey-70">{formatDate(row.referred_at)}</span>,
      },
    ],
    []
  )

  const payoutColumns = useMemo<Column<PartnerPayout>[]>(
    () => [
      {
        key: "created_at",
        header: "Date",
        render: (row) => <span className="text-grey-70">{formatDate(row.created_at)}</span>,
      },
      {
        key: "amount_cents",
        header: "Amount",
        render: (row) => (
          <span className="font-medium text-grey-90">{formatCents(row.amount_cents)}</span>
        ),
      },
      {
        key: "status",
        header: "Status",
        render: (row) => <StatusBadge status={row.status} />,
      },
      {
        key: "method",
        header: "Method",
        render: (row) => <span className="text-grey-70">{nullText(row.method)}</span>,
      },
    ],
    []
  )

  const commissionColumns = useMemo<Column<PartnerCommission>[]>(
    () => [
      {
        key: "created_at",
        header: "Date",
        render: (row) => <span className="text-grey-70">{formatDate(row.created_at)}</span>,
      },
      {
        key: "source",
        header: "Source",
        render: (row) => <span className="capitalize text-grey-70">{row.source}</span>,
      },
      {
        key: "base_cents",
        header: "Base x Pct",
        render: (row) => (
          <span className="text-grey-70">
            {formatCents(row.base_cents)} x {safeNumber(row.pct)}%
          </span>
        ),
      },
      {
        key: "amount_cents",
        header: "Amount",
        render: (row) => (
          <span className="font-medium text-grey-90">{formatCents(row.amount_cents)}</span>
        ),
      },
      {
        key: "status",
        header: "Status",
        render: (row) => <StatusBadge status={row.status} />,
      },
    ],
    []
  )

  const requestColumns = useMemo<Column<PartnerPayoutRequest>[]>(
    () => [
      {
        key: "partner_name",
        header: "Partner",
        render: (row) => (
          <div>
            <p className="font-medium text-grey-90">{row.partner_name}</p>
            <p className="text-xs text-grey-50">{nullText(row.partner_email)}</p>
          </div>
        ),
      },
      {
        key: "amount_cents",
        header: "Amount",
        render: (row) => (
          <span className="font-medium text-grey-90">{formatCents(row.amount_cents)}</span>
        ),
      },
      {
        key: "method",
        header: "Method",
        render: (row) => {
          const parts = (row.method ?? "")
            .split(" | ")
            .map((part) => part.trim())
            .filter(Boolean)
          if (!parts.length) {
            return <span className="text-grey-50">—</span>
          }
          return (
            <div className="space-y-0.5">
              {parts.map((part, idx) => (
                <p
                  key={idx}
                  className={cn("text-xs", idx === 0 ? "font-medium text-grey-90" : "text-grey-60")}
                >
                  {part}
                </p>
              ))}
            </div>
          )
        },
      },
      {
        key: "created_at",
        header: "Requested",
        render: (row) => <span className="text-grey-70">{formatDate(row.created_at)}</span>,
      },
    ],
    []
  )

  const actionBtn =
    "inline-flex items-center gap-1.5 rounded-base border px-2.5 py-1.5 text-xs font-medium transition-all outline-none focus-visible:ring-2 focus-visible:ring-grey-90/20 disabled:cursor-not-allowed disabled:opacity-50"

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={openCreate}
        className="inline-flex items-center gap-2 rounded-base bg-grey-90 px-3 py-2 text-sm font-medium text-white transition-all hover:bg-grey-80 focus:outline-none focus:ring-2 focus:ring-grey-90/20"
      >
        <Plus className="h-4 w-4" />
        Add partner
      </button>
      <button
        onClick={() => {
          load()
          loadRequests()
        }}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-base border border-grey-20 bg-white px-3 py-2 text-sm font-medium text-grey-70 transition-all hover:bg-grey-10 hover:border-grey-30 hover:text-grey-90 disabled:opacity-50"
      >
        <ArrowPath className={cn("h-4 w-4", loading && "animate-spin")} />
        Refresh
      </button>
    </div>
  )

  const copyBtn =
    "inline-flex items-center gap-1.5 rounded-base border border-grey-20 bg-white px-2 py-1 text-xs font-medium text-grey-70 transition-all hover:bg-grey-10 hover:border-grey-30 hover:text-grey-90"

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform / Partners"
        description="Manage reseller and referral partner accounts."
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Active partners" value={activeCount} icon={UsersSolid} tone="green" />
        <KpiCard label="Total partners" value={partners.length} icon={UsersSolid} tone="grey" />
        <KpiCard
          label="Open payout requests"
          value={payoutRequests.length}
          icon={CurrencyDollar}
          tone="brand"
        />
      </div>

      {payoutRequests.length > 0 && (
        <div className="rounded-large border border-grey-20 bg-white p-5 shadow-borders-base">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-grey-90">Payout requests</h3>
            <span className="inline-flex items-center rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-medium text-cyan-700 ring-1 ring-inset ring-cyan-200">
              {payoutRequests.length} open
            </span>
          </div>
          <p className="mt-1 text-sm text-grey-50">
            Open payout requests across all partners, awaiting settlement.
          </p>
          {requestsError && (
            <div className="mt-4 rounded-large border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
              <div className="flex items-start gap-3">
                <ExclamationCircle className="mt-0.5 h-5 w-5 shrink-0" />
                {requestsError}
              </div>
            </div>
          )}
          <div className="mt-4">
            <DataTable
              columns={requestColumns}
              rows={payoutRequests}
              pageSize={5}
              rowActions={(row) => [
                <button
                  key={`request-pay-${row.id}`}
                  onClick={() => handleSettleRequest(row, "paid")}
                  disabled={requestWorkingId === row.id}
                  className={cn(
                    actionBtn,
                    "border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300"
                  )}
                >
                  Mark paid
                </button>,
                <button
                  key={`request-reject-${row.id}`}
                  onClick={() => handleSettleRequest(row, "rejected")}
                  disabled={requestWorkingId === row.id}
                  className={cn(
                    actionBtn,
                    "border-red-200 bg-white text-red-600 hover:bg-red-50 hover:border-red-300"
                  )}
                >
                  Reject
                </button>,
              ]}
            />
          </div>
        </div>
      )}

      <div className="rounded-large border border-grey-20 bg-white p-5 shadow-borders-base">
        <DataTable
          columns={columns}
          rows={partners}
          searchKeys={searchKeys}
          filterKey="status"
          filterOptions={statusOptions}
          isLoading={loading}
          emptyIcon={UsersSolid}
          emptyTitle="No partners yet"
          emptyDescription="Add your first partner to start tracking referrals and commissions."
          rowActions={(row) => [
            <button
              key={`manage-${row.id}`}
              onClick={() => openManage(row)}
              disabled={workingId === row.id}
              className={cn(
                actionBtn,
                "border-grey-20 bg-white text-grey-70 hover:bg-grey-10 hover:border-grey-30 hover:text-grey-90"
              )}
            >
              <CogSixTooth className="h-3.5 w-3.5" />
              Manage
            </button>,
            <button
              key={`edit-${row.id}`}
              onClick={() => openEdit(row)}
              disabled={workingId === row.id}
              className={cn(
                actionBtn,
                "border-grey-20 bg-white text-grey-70 hover:bg-grey-10 hover:border-grey-30 hover:text-grey-90"
              )}
            >
              <PencilSquare className="h-3.5 w-3.5" />
              Edit
            </button>,
            <button
              key={`delete-${row.id}`}
              onClick={() => setDeleteModal({ open: true, partner: row })}
              disabled={workingId === row.id}
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
        open={manageOpen}
        onClose={closeManage}
        title={managePartner ? `Manage ${managePartner.name}` : "Manage partner"}
        description="Referrals, commissions, payouts, and partner panel access."
        size="xl"
      >
        <div className="max-h-[70vh] space-y-6 overflow-y-auto pr-1">
          {manageError && (
            <div className="rounded-large border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
              <div className="flex items-start gap-3">
                <ExclamationCircle className="mt-0.5 h-5 w-5 shrink-0" />
                {manageError}
              </div>
            </div>
          )}

          {overviewLoading && !overview ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="h-24 animate-pulse rounded-large border border-grey-20 bg-grey-10"
                  />
                ))}
              </div>
              <div className="h-40 animate-pulse rounded-large border border-grey-20 bg-grey-10" />
            </div>
          ) : overview ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <KpiCard
                  label="Lifetime commission"
                  value={formatCents(overview.totals.lifetime_cents)}
                  icon={CurrencyDollar}
                  tone="grey"
                />
                <KpiCard
                  label="Pending commission"
                  value={formatCents(overview.totals.pending_cents)}
                  icon={CurrencyDollar}
                  tone="brand"
                />
                <KpiCard
                  label="Paid out"
                  value={formatCents(overview.totals.paid_cents)}
                  icon={CurrencyDollar}
                  tone="green"
                />
                <KpiCard
                  label="Referred stores"
                  value={overview.referrals.length}
                  icon={Buildings}
                  tone="grey"
                />
              </div>

              <div className="rounded-large border border-grey-20 bg-white p-5 shadow-borders-base">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-grey-90">Partner login</h3>
                    <p className="mt-1 text-sm text-grey-50">
                      Create the partner&apos;s account for the partner panel at /partners.
                    </p>
                  </div>
                  <button
                    onClick={handleCreateCredentials}
                    disabled={credentialsWorking || !!credentials}
                    className="inline-flex shrink-0 items-center gap-2 rounded-base bg-grey-90 px-3 py-2 text-sm font-medium text-white transition-all hover:bg-grey-80 disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" />
                    {credentialsWorking ? "Creating..." : "Create login"}
                  </button>
                </div>
                {credentialsError && (
                  <p className="mt-3 text-sm text-red-600">{credentialsError}</p>
                )}
                {credentials && (
                  <div className="mt-4 space-y-3 rounded-base border border-amber-200 bg-amber-50 p-4">
                    <p className="text-sm font-medium text-amber-800">
                      Save this password now. It will not be shown again.
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium text-grey-50">Email</span>
                      <span className="font-mono text-sm text-grey-90">{credentials.email}</span>
                      <button
                        onClick={() => handleCopy(credentials.email, "email")}
                        className={copyBtn}
                      >
                        {copiedField === "email" ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <SquareTwoStack className="h-3.5 w-3.5" />
                        )}
                        {copiedField === "email" ? "Copied" : "Copy"}
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium text-grey-50">Password</span>
                      <span className="font-mono text-sm text-grey-90">{credentials.password}</span>
                      <button
                        onClick={() => handleCopy(credentials.password, "password")}
                        className={copyBtn}
                      >
                        {copiedField === "password" ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <SquareTwoStack className="h-3.5 w-3.5" />
                        )}
                        {copiedField === "password" ? "Copied" : "Copy"}
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium text-grey-50">Panel URL</span>
                      <span className="font-mono text-sm text-grey-90">{credentials.panel_url}</span>
                      <button
                        onClick={() => handleCopy(credentials.panel_url, "panel_url")}
                        className={copyBtn}
                      >
                        {copiedField === "panel_url" ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <SquareTwoStack className="h-3.5 w-3.5" />
                        )}
                        {copiedField === "panel_url" ? "Copied" : "Copy"}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-large border border-grey-20 bg-white p-5 shadow-borders-base">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <h3 className="text-sm font-semibold text-grey-90">Referred stores</h3>
                  <form onSubmit={handleAttachReferral} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={attachSlug}
                      onChange={(e) => setAttachSlug(e.target.value)}
                      placeholder="store-slug"
                      className="w-44 rounded-base border border-grey-30 bg-white px-3 py-2 text-sm text-grey-90 placeholder:text-grey-40 transition-colors focus:border-grey-90 focus:outline-none focus:ring-2 focus:ring-grey-90/20"
                    />
                    <button
                      type="submit"
                      disabled={attachWorking || !attachSlug.trim()}
                      className="shrink-0 rounded-base border border-grey-20 bg-white px-3 py-2 text-sm font-medium text-grey-70 transition-all hover:bg-grey-10 hover:border-grey-30 hover:text-grey-90 disabled:opacity-50"
                    >
                      {attachWorking ? "Attaching..." : "Attach store by slug"}
                    </button>
                  </form>
                </div>
                {attachError && <p className="mt-3 text-sm text-red-600">{attachError}</p>}
                <div className="mt-4">
                  <DataTable
                    columns={referralColumns}
                    rows={overview.referrals}
                    emptyIcon={Buildings}
                    emptyTitle="No referred stores"
                    emptyDescription="Stores signed up through this partner will appear here."
                    pageSize={5}
                  />
                </div>
              </div>

              <div className="rounded-large border border-grey-20 bg-white p-5 shadow-borders-base">
                <h3 className="text-sm font-semibold text-grey-90">Payouts</h3>
                {payoutError && <p className="mt-3 text-sm text-red-600">{payoutError}</p>}
                <div className="mt-4">
                  <DataTable
                    columns={payoutColumns}
                    rows={overview.payouts}
                    emptyIcon={CurrencyDollar}
                    emptyTitle="No payouts"
                    emptyDescription="Payout requests from this partner will appear here."
                    pageSize={5}
                    rowActions={(row) =>
                      row.status === "requested"
                        ? [
                            <button
                              key={`pay-${row.id}`}
                              onClick={() => handleSettlePayout(row.id, "paid")}
                              disabled={payoutWorkingId === row.id}
                              className={cn(
                                actionBtn,
                                "border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300"
                              )}
                            >
                              Mark paid
                            </button>,
                            <button
                              key={`reject-${row.id}`}
                              onClick={() => handleSettlePayout(row.id, "rejected")}
                              disabled={payoutWorkingId === row.id}
                              className={cn(
                                actionBtn,
                                "border-red-200 bg-white text-red-600 hover:bg-red-50 hover:border-red-300"
                              )}
                            >
                              Reject
                            </button>,
                          ]
                        : null
                    }
                  />
                </div>
              </div>

              <div className="rounded-large border border-grey-20 bg-white p-5 shadow-borders-base">
                <h3 className="text-sm font-semibold text-grey-90">Recent commissions</h3>
                <div className="mt-4">
                  <DataTable
                    columns={commissionColumns}
                    rows={overview.commissions}
                    emptyIcon={CurrencyDollar}
                    emptyTitle="No commissions"
                    emptyDescription="Commissions earned by this partner will appear here."
                    pageSize={5}
                  />
                </div>
              </div>
            </>
          ) : null}
        </div>
      </Modal>

      <Modal
        open={editorOpen}
        onClose={() => {
          setEditorOpen(false)
          setForm(emptyPartner)
        }}
        title={editingPartner ? "Edit partner" : "Add partner"}
        size="md"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label htmlFor="partner-name" className="mb-1.5 block text-sm font-medium text-grey-70">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              id="partner-name"
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Partner name"
              className="w-full rounded-base border border-grey-30 bg-white px-3 py-2.5 text-sm text-grey-90 placeholder:text-grey-40 transition-colors focus:border-grey-90 focus:outline-none focus:ring-2 focus:ring-grey-90/20"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="partner-email"
                className="mb-1.5 block text-sm font-medium text-grey-70"
              >
                Email
              </label>
              <input
                id="partner-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="partner@example.com"
                className="w-full rounded-base border border-grey-30 bg-white px-3 py-2.5 text-sm text-grey-90 placeholder:text-grey-40 transition-colors focus:border-grey-90 focus:outline-none focus:ring-2 focus:ring-grey-90/20"
              />
            </div>
            <div>
              <label
                htmlFor="partner-company"
                className="mb-1.5 block text-sm font-medium text-grey-70"
              >
                Company
              </label>
              <input
                id="partner-company"
                type="text"
                value={form.company}
                onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                placeholder="Company name"
                className="w-full rounded-base border border-grey-30 bg-white px-3 py-2.5 text-sm text-grey-90 placeholder:text-grey-40 transition-colors focus:border-grey-90 focus:outline-none focus:ring-2 focus:ring-grey-90/20"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="partner-tier"
                className="mb-1.5 block text-sm font-medium text-grey-70"
              >
                Tier
              </label>
              <select
                id="partner-tier"
                value={form.tier}
                onChange={(e) => setForm((f) => ({ ...f, tier: e.target.value as PartnerTier }))}
                className="w-full rounded-base border border-grey-30 bg-white px-3 py-2.5 text-sm text-grey-90 transition-colors focus:border-grey-90 focus:outline-none focus:ring-2 focus:ring-grey-90/20"
              >
                {tierOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="partner-commission"
                className="mb-1.5 block text-sm font-medium text-grey-70"
              >
                Commission %
              </label>
              <input
                id="partner-commission"
                type="number"
                min={0}
                max={100}
                step={0.01}
                required
                value={form.commission_pct}
                onChange={(e) =>
                  setForm((f) => ({ ...f, commission_pct: parseFloat(e.target.value) || 0 }))
                }
                className="w-full rounded-base border border-grey-30 bg-white px-3 py-2.5 text-sm text-grey-90 placeholder:text-grey-40 transition-colors focus:border-grey-90 focus:outline-none focus:ring-2 focus:ring-grey-90/20"
              />
            </div>
          </div>
          <div>
            <label
              htmlFor="partner-referral-code"
              className="mb-1.5 block text-sm font-medium text-grey-70"
            >
              Referral code
            </label>
            <input
              id="partner-referral-code"
              type="text"
              value={form.referral_code}
              onChange={(e) => setForm((f) => ({ ...f, referral_code: e.target.value }))}
              placeholder="e.g. PARTNER2024"
              className="w-full rounded-base border border-grey-30 bg-white px-3 py-2.5 text-sm text-grey-90 placeholder:text-grey-40 transition-colors focus:border-grey-90 focus:outline-none focus:ring-2 focus:ring-grey-90/20"
            />
          </div>
          {editingPartner && (
            <div>
              <label
                htmlFor="partner-status"
                className="mb-1.5 block text-sm font-medium text-grey-70"
              >
                Status
              </label>
              <select
                id="partner-status"
                value={form.status ?? editingPartner.status}
                onChange={(e) =>
                  setForm((f) => ({ ...f, status: e.target.value as PartnerStatus }))
                }
                className="w-full rounded-base border border-grey-30 bg-white px-3 py-2.5 text-sm text-grey-90 transition-colors focus:border-grey-90 focus:outline-none focus:ring-2 focus:ring-grey-90/20"
              >
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setEditorOpen(false)
                setForm(emptyPartner)
              }}
              className="rounded-base border border-grey-20 bg-white px-4 py-2 text-sm font-medium text-grey-70 transition-all hover:bg-grey-10 hover:border-grey-30"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={workingId === (editingPartner?.id ?? "create")}
              className="rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-grey-80 disabled:opacity-50"
            >
              {editingPartner ? "Save changes" : "Add partner"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, partner: null })}
        title="Delete partner"
        description={
          deleteModal.partner
            ? `Delete "${deleteModal.partner.name}"? This cannot be undone.`
            : undefined
        }
        size="sm"
      >
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => setDeleteModal({ open: false, partner: null })}
            className="rounded-base border border-grey-20 bg-white px-4 py-2 text-sm font-medium text-grey-70 transition-all hover:bg-grey-10 hover:border-grey-30"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={workingId === deleteModal.partner?.id}
            className="rounded-base bg-red-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-red-700 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </Modal>
    </div>
  )
}
