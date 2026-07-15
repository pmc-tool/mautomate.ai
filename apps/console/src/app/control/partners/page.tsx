"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArrowPath,
  ExclamationCircle,
  PencilSquare,
  Plus,
  Trash,
  UsersSolid,
} from "@medusajs/icons"
import { useControlAuth } from "@/lib/auth"
import {
  createPartner,
  deletePartner,
  listPartners,
  updatePartner,
  type Partner,
  type PartnerTier,
  type PartnerStatus,
  type PartnerInput,
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

  useEffect(() => {
    load()
  }, [load])

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
      </div>

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
