"use client"

import React, { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeftMini,
  CalendarMini,
  ChartPie,
  ExclamationCircle,
  PencilSquare,
  Plus,
  ReceiptPercent,
  Trash,
} from "@medusajs/icons"
import { EmptyState } from "@components/merchant-admin/empty-state"
import { ActionMenu } from "@components/merchant-admin/action-menu"
import { Modal } from "@components/merchant-admin/modal"
import { DataTable, Column } from "@components/merchant-admin/data-table"
import { TwoColumnLayout } from "@components/merchant-admin/two-column-layout"
import { FormField, Input } from "@components/merchant-admin/form-field"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  getCampaign,
  updateCampaign,
  deleteCampaign,
  addPromotionsToCampaign,
  removePromotionsFromCampaign,
  listPromotions,
  CampaignDetail,
  PromotionListItem,
  ApiError,
} from "../../../../lib/merchant-admin/api"
import { formatMoney } from "@lib/merchant-admin/utils"
import { cn } from "@lib/util/cn"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type CampaignStatus = "active" | "expired" | "scheduled"

function campaignStatus(campaign: CampaignDetail): CampaignStatus {
  const now = new Date()
  if (campaign.ends_at && new Date(campaign.ends_at) < now) {
    return "expired"
  }
  if (campaign.starts_at && new Date(campaign.starts_at) > now) {
    return "scheduled"
  }
  return "active"
}

const CAMPAIGN_STATUS_META: Record<CampaignStatus, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-emerald-50 text-emerald-800" },
  expired: { label: "Expired", className: "bg-rose-50 text-rose-800" },
  scheduled: { label: "Scheduled", className: "bg-amber-50 text-amber-800" },
}

function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  const meta = CAMPAIGN_STATUS_META[status]
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        meta.className
      )}
    >
      {meta.label}
    </span>
  )
}

const PROMO_STATUS_META: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-grey-10 text-grey-70" },
  active: { label: "Active", className: "bg-emerald-50 text-emerald-800" },
  inactive: { label: "Inactive", className: "bg-rose-50 text-rose-800" },
}

function PromotionStatusBadge({ status }: { status?: string | null }) {
  const meta = PROMO_STATUS_META[(status || "").toLowerCase()] || {
    label: status || "-",
    className: "bg-grey-10 text-grey-70",
  }
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        meta.className
      )}
    >
      {meta.label}
    </span>
  )
}

function currencyName(code?: string | null): string {
  if (!code) return ""
  try {
    const dn = new Intl.DisplayNames(undefined, { type: "currency" })
    return dn.of(code.toUpperCase()) || code.toUpperCase()
  } catch {
    return code.toUpperCase()
  }
}

function formatDateTime(iso?: string | null): string {
  if (!iso) return "-"
  const d = new Date(iso)
  if (isNaN(d.getTime())) return "-"
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function toLocalInput(iso?: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromLocalInput(value: string): string | null {
  if (!value) return null
  const d = new Date(value)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

function promotionValue(
  promo: PromotionListItem,
  fallbackCurrency?: string | null
): string {
  if (promo.value == null || promo.value_type == null) return "-"
  if (promo.value_type === "percentage") return `${promo.value}%`
  const currency = promo.currency_code || fallbackCurrency || "usd"
  return formatMoney(promo.value, currency)
}

function Card({
  title,
  action,
  children,
  bodyClassName,
}: {
  title?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
  bodyClassName?: string
}) {
  return (
    <div className="rounded-large border border-grey-20 bg-white shadow-borders-base">
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b border-grey-10 px-5 py-4">
          {typeof title === "string" ? (
            <h3 className="text-base font-semibold text-grey-90">{title}</h3>
          ) : (
            title
          )}
          {action}
        </div>
      )}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </div>
  )
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 items-center gap-4 py-2.5 text-sm">
      <dt className="text-grey-50">{label}</dt>
      <dd className="text-grey-90">{children}</dd>
    </div>
  )
}

type EditForm = {
  name: string
  description: string
  identifier: string
  starts_at: string
  ends_at: string
}

const secondaryBtn =
  "inline-flex items-center rounded-base border border-grey-30 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10 disabled:cursor-not-allowed disabled:opacity-50"
const primaryBtn =
  "inline-flex items-center rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:cursor-not-allowed disabled:opacity-50"
const smallBtn =
  "inline-flex items-center gap-1.5 rounded-base border border-grey-30 bg-white px-3 py-1.5 text-sm font-medium text-grey-90 hover:bg-grey-10 disabled:cursor-not-allowed disabled:opacity-50"

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CampaignDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { token, logout } = useMerchantAuth()
  const id = params.id as string

  const [campaign, setCampaign] = useState<CampaignDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [showJson, setShowJson] = useState(false)

  // Edit campaign drawer
  const [editOpen, setEditOpen] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [form, setForm] = useState<EditForm>({
    name: "",
    description: "",
    identifier: "",
    starts_at: "",
    ends_at: "",
  })

  // Edit budget modal
  const [budgetOpen, setBudgetOpen] = useState(false)
  const [budgetLimit, setBudgetLimit] = useState("")
  const [budgetError, setBudgetError] = useState<string | null>(null)

  // Add promotions modal
  const [addOpen, setAddOpen] = useState(false)
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [addSearch, setAddSearch] = useState("")
  const [allPromotions, setAllPromotions] = useState<PromotionListItem[]>([])
  const [addSel, setAddSel] = useState<Set<string>>(new Set())

  function showMessage(type: "success" | "error", text: string) {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 4000)
  }

  async function load() {
    if (!token || !id) return
    setLoading(true)
    setError(null)
    try {
      const res = await getCampaign(token, id)
      setCampaign(res.campaign)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      setError(err instanceof Error ? err.message : "Failed to load campaign")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, id])

  async function run(key: string, fn: () => Promise<any>, okMsg: string) {
    if (!token) return false
    setBusy(key)
    try {
      await fn()
      showMessage("success", okMsg)
      await load()
      return true
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      showMessage("error", err instanceof Error ? err.message : "Action failed")
      return false
    } finally {
      setBusy(null)
    }
  }

  // ---- edit campaign ----
  function openEdit() {
    if (!campaign) return
    setForm({
      name: campaign.name || "",
      description: campaign.description || "",
      identifier: campaign.campaign_identifier_display || "",
      starts_at: toLocalInput(campaign.starts_at),
      ends_at: toLocalInput(campaign.ends_at),
    })
    setEditError(null)
    setEditOpen(true)
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!token || !campaign) return
    setEditError(null)
    if (!form.name.trim()) {
      setEditError("Name is required.")
      return
    }
    const startsAt = fromLocalInput(form.starts_at)
    const endsAt = fromLocalInput(form.ends_at)
    if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) {
      setEditError("End date must be after the start date.")
      return
    }
    const ok = await run(
      "save-campaign",
      () =>
        updateCampaign(token, campaign.id, {
          name: form.name.trim(),
          description: form.description.trim() || null,
          identifier: form.identifier.trim() || undefined,
          starts_at: startsAt,
          ends_at: endsAt,
        }),
      `Campaign '${form.name.trim()}' was successfully updated.`
    )
    if (ok) setEditOpen(false)
  }

  // ---- delete campaign ----
  async function handleDelete() {
    if (!token || !campaign) return
    if (
      !confirm(
        `You are about to delete the campaign '${campaign.name}'. This action cannot be undone.`
      )
    ) {
      return
    }
    setBusy("delete-campaign")
    try {
      await deleteCampaign(token, campaign.id)
      router.push("/dashboard/campaigns")
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      showMessage("error", err instanceof Error ? err.message : "Failed to delete campaign")
      setBusy(null)
    }
  }

  // ---- edit budget ----
  function openBudget() {
    if (!campaign?.budget) return
    setBudgetLimit(campaign.budget.limit != null ? String(campaign.budget.limit) : "")
    setBudgetError(null)
    setBudgetOpen(true)
  }

  async function saveBudget(e: React.FormEvent) {
    e.preventDefault()
    if (!token || !campaign) return
    setBudgetError(null)
    let limit: number | null = null
    if (budgetLimit.trim() !== "") {
      limit = Number(budgetLimit)
      if (!Number.isFinite(limit) || limit < 0) {
        setBudgetError("Limit must be a number of 0 or more.")
        return
      }
    }
    const ok = await run(
      "save-budget",
      () => updateCampaign(token, campaign.id, { budget: { limit } }),
      `Campaign '${campaign.name}' was successfully updated.`
    )
    if (ok) setBudgetOpen(false)
  }

  // ---- remove promotion ----
  async function handleRemovePromotion(promo: PromotionListItem) {
    if (!token || !campaign) return
    if (
      !confirm(
        "You are about to remove 1 promotion(s) from the campaign. This action cannot be undone."
      )
    ) {
      return
    }
    await run(
      `remove-promo-${promo.id}`,
      () => removePromotionsFromCampaign(token, campaign.id, [promo.id]),
      "Successfully removed 1 promotion(s) from campaign"
    )
  }

  // ---- add promotions ----
  async function openAdd() {
    if (!token || !campaign) return
    setAddSel(new Set())
    setAddSearch("")
    setAddError(null)
    setAddOpen(true)
    setAddLoading(true)
    try {
      const res = await listPromotions(token, { limit: 100 })
      setAllPromotions(res.promotions || [])
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      setAddError(err instanceof Error ? err.message : "Failed to load promotions")
    } finally {
      setAddLoading(false)
    }
  }

  const existingIds = useMemo(
    () => new Set((campaign?.promotions || []).map((p) => p.id)),
    [campaign]
  )

  const addCandidates = useMemo(() => {
    const term = addSearch.trim().toLowerCase()
    return allPromotions
      .filter((p) => !existingIds.has(p.id) && p.campaign?.id !== campaign?.id)
      .filter((p) => !term || (p.display_code || "").toLowerCase().includes(term))
  }, [allPromotions, existingIds, addSearch, campaign])

  function addDisabledReason(promo: PromotionListItem): string | null {
    if (promo.campaign && promo.campaign.id !== campaign?.id) {
      return `This promotion has already been added to a different campaign (${promo.campaign.name}).`
    }
    if (
      campaign?.budget?.type === "spend" &&
      campaign.budget.currency_code &&
      promo.currency_code &&
      promo.currency_code !== campaign.budget.currency_code
    ) {
      return "Currency of the promotion and campaign doesn't match"
    }
    return null
  }

  function toggleAddSel(promoId: string) {
    setAddSel((s) => {
      const next = new Set(s)
      if (next.has(promoId)) {
        next.delete(promoId)
      } else {
        next.add(promoId)
      }
      return next
    })
  }

  async function saveAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!token || !campaign) return
    if (addSel.size === 0) {
      setAddError("Select at least one promotion.")
      return
    }
    setAddError(null)
    const ids = Array.from(addSel)
    const ok = await run(
      "add-promos",
      () => addPromotionsToCampaign(token, campaign.id, ids),
      `Successfully added ${ids.length} promotion(s) to campaign`
    )
    if (ok) setAddOpen(false)
  }

  // ---- render ----
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-5 w-40 animate-pulse rounded-base bg-grey-10" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className="h-48 animate-pulse rounded-large border border-grey-20 bg-grey-10" />
            <div className="h-40 animate-pulse rounded-large border border-grey-20 bg-grey-10" />
            <div className="h-64 animate-pulse rounded-large border border-grey-20 bg-grey-10" />
          </div>
          <div className="space-y-6">
            <div className="h-40 animate-pulse rounded-large border border-grey-20 bg-grey-10" />
            <div className="h-16 animate-pulse rounded-large border border-grey-20 bg-grey-10" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !campaign) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => router.push("/dashboard/campaigns")}
          className="inline-flex items-center gap-1 text-sm font-medium text-grey-60 hover:text-grey-90"
        >
          <ArrowLeftMini className="h-4 w-4" />
          Back to campaigns
        </button>
        <EmptyState
          icon={ChartPie}
          title="Campaign not found"
          description={error || "This campaign does not exist or you do not have access to it."}
        />
      </div>
    )
  }

  const status = campaignStatus(campaign)
  const budget = campaign.budget
  const isSpend = budget?.type === "spend"
  const budgetCurrency = budget?.currency_code || null
  const used = budget?.used ?? 0
  const limit = budget?.limit ?? null
  const progressPct =
    limit != null && limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : null

  const formatBudgetAmount = (amount: number) =>
    isSpend && budgetCurrency ? formatMoney(amount, budgetCurrency) : String(amount)

  const promoColumns: Column<PromotionListItem>[] = [
    {
      key: "display_code",
      header: "Code",
      render: (p) => (
        <div className="min-w-0">
          <span className="font-medium text-grey-90">{p.display_code || "-"}</span>
          {p.is_automatic && (
            <span className="ml-2 rounded-full bg-grey-10 px-1.5 py-0.5 text-[10px] font-medium text-grey-50">
              Automatic
            </span>
          )}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (p) => <PromotionStatusBadge status={p.status} />,
    },
    {
      key: "value",
      header: "Value",
      render: (p) => (
        <span className="text-grey-70">{promotionValue(p, budgetCurrency)}</span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <button
        onClick={() => router.push("/dashboard/campaigns")}
        className="inline-flex items-center gap-1 text-sm font-medium text-grey-60 hover:text-grey-90"
      >
        <ArrowLeftMini className="h-4 w-4" />
        Back to campaigns
      </button>

      {message && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-base px-4 py-3 text-sm",
            message.type === "success" && "bg-emerald-50 text-emerald-800",
            message.type === "error" && "bg-rose-50 text-rose-800"
          )}
        >
          {message.type === "error" && <ExclamationCircle className="h-4 w-4" />}
          {message.text}
        </div>
      )}

      <TwoColumnLayout
        sidebar={
          <>
            {/* Dates */}
            <Card
              title="Dates"
              action={
                <ActionMenu
                  items={[{ label: "Edit", icon: PencilSquare, onClick: openEdit }]}
                />
              }
              bodyClassName="py-2"
            >
              <dl className="divide-y divide-grey-10">
                <DetailRow label="Start date">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarMini className="h-4 w-4 shrink-0 text-grey-40" />
                    {formatDateTime(campaign.starts_at)}
                  </span>
                </DetailRow>
                <DetailRow label="End date">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarMini className="h-4 w-4 shrink-0 text-grey-40" />
                    {formatDateTime(campaign.ends_at)}
                  </span>
                </DetailRow>
              </dl>
            </Card>

            {/* JSON */}
            <Card bodyClassName="p-0">
              <button
                type="button"
                onClick={() => setShowJson((s) => !s)}
                className="flex w-full items-center justify-between px-5 py-4 text-sm font-medium text-grey-70 hover:text-grey-90"
              >
                Raw campaign data (JSON)
                <span className="text-grey-40">{showJson ? "Hide" : "Show"}</span>
              </button>
              {showJson && (
                <pre className="max-h-96 overflow-auto border-t border-grey-10 bg-grey-10 px-5 py-4 text-xs text-grey-70">
                  {JSON.stringify(campaign, null, 2)}
                </pre>
              )}
            </Card>
          </>
        }
      >
        {/* General */}
        <Card
          title={
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-grey-90">{campaign.name}</h1>
              <CampaignStatusBadge status={status} />
            </div>
          }
          action={
            <ActionMenu
              items={[
                { label: "Edit", icon: PencilSquare, onClick: openEdit },
                {
                  label: "Delete",
                  icon: Trash,
                  destructive: true,
                  onClick: handleDelete,
                },
              ]}
            />
          }
          bodyClassName="py-2"
        >
          <dl className="divide-y divide-grey-10">
            <DetailRow label="Identifier">
              {campaign.campaign_identifier_display || "-"}
            </DetailRow>
            <DetailRow label="Description">{campaign.description || "-"}</DetailRow>
            {isSpend && budgetCurrency && (
              <DetailRow label="Currency">
                <span className="inline-flex items-center gap-2">
                  <span className="rounded-base bg-grey-10 px-1.5 py-0.5 text-xs font-medium uppercase text-grey-70">
                    {budgetCurrency}
                  </span>
                  <span className="text-grey-50">{currencyName(budgetCurrency)}</span>
                </span>
              </DetailRow>
            )}
          </dl>
        </Card>

        {/* Budget */}
        <Card
          title={
            <div className="flex items-center gap-2">
              <ChartPie className="h-4 w-4 text-grey-50" />
              <h3 className="text-base font-semibold text-grey-90">Budget</h3>
            </div>
          }
          action={
            budget ? (
              <ActionMenu
                items={[{ label: "Edit", icon: PencilSquare, onClick: openBudget }]}
              />
            ) : undefined
          }
          bodyClassName="py-2"
        >
          {budget ? (
            <>
              <dl className="divide-y divide-grey-10">
                <DetailRow label="Type">{isSpend ? "Spend" : "Usage"}</DetailRow>
                <DetailRow label="Limit">
                  {limit != null ? formatBudgetAmount(limit) : "No limit"}
                </DetailRow>
                <DetailRow label={isSpend ? "Budget spent" : "Budget used"}>
                  {formatBudgetAmount(used)}
                </DetailRow>
              </dl>
              {progressPct != null && (
                <div className="mt-2 pb-3">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-grey-10">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        progressPct >= 100 ? "bg-rose-500" : "bg-grey-90"
                      )}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-grey-50">
                    {formatBudgetAmount(used)} of {formatBudgetAmount(limit!)} ({progressPct}%)
                  </p>
                </div>
              )}
            </>
          ) : (
            <p className="py-2 text-sm text-grey-50">This campaign has no budget.</p>
          )}
        </Card>

        {/* Promotions */}
        <Card
          title="Promotions"
          action={
            <button type="button" onClick={openAdd} className={smallBtn}>
              <Plus className="h-4 w-4" />
              Add
            </button>
          }
        >
          <DataTable
            columns={promoColumns}
            rows={campaign.promotions || []}
            searchKeys={["display_code"]}
            pageSize={10}
            onRowClick={(p) => router.push(`/dashboard/promotions/${p.id}`)}
            rowActions={(p) => (
              <span onClick={(e) => e.stopPropagation()}>
                <ActionMenu
                  items={[
                    {
                      label: "Remove",
                      icon: Trash,
                      destructive: true,
                      onClick: () => handleRemovePromotion(p),
                    },
                  ]}
                />
              </span>
            )}
            emptyIcon={ReceiptPercent}
            emptyTitle="No promotions"
            emptyDescription="There are no promotions in the campaign."
            emptyAction={
              <button type="button" onClick={openAdd} className={smallBtn}>
                <Plus className="h-4 w-4" />
                Add
              </button>
            }
          />
        </Card>
      </TwoColumnLayout>

      {/* Edit Campaign drawer */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Campaign"
        description="Edit the details of the campaign."
        size="sm"
      >
        <form onSubmit={saveEdit} className="space-y-4">
          <FormField label="Name" htmlFor="campaign-name">
            <Input
              id="campaign-name"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="Summer sale"
            />
          </FormField>
          <FormField label="Description" htmlFor="campaign-description" hint="Optional">
            <Input
              id="campaign-description"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Optional"
            />
          </FormField>
          <FormField label="Identifier" htmlFor="campaign-identifier">
            <Input
              id="campaign-identifier"
              value={form.identifier}
              onChange={(e) => setForm((p) => ({ ...p, identifier: e.target.value }))}
              placeholder="summer-sale"
            />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Start date" htmlFor="campaign-starts">
              <Input
                id="campaign-starts"
                type="datetime-local"
                value={form.starts_at}
                onChange={(e) => setForm((p) => ({ ...p, starts_at: e.target.value }))}
              />
            </FormField>
            <FormField label="End date" htmlFor="campaign-ends">
              <Input
                id="campaign-ends"
                type="datetime-local"
                value={form.ends_at}
                onChange={(e) => setForm((p) => ({ ...p, ends_at: e.target.value }))}
              />
            </FormField>
          </div>
          {editError && <p className="text-xs text-red-600">{editError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setEditOpen(false)} className={secondaryBtn}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy === "save-campaign" || !form.name.trim()}
              className={primaryBtn}
            >
              {busy === "save-campaign" ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Campaign Budget modal */}
      <Modal
        open={budgetOpen}
        onClose={() => setBudgetOpen(false)}
        title="Edit Campaign Budget"
        description="Budget type and currency cannot be changed after creation."
        size="sm"
      >
        <form onSubmit={saveBudget} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Type" htmlFor="budget-type">
              <Input id="budget-type" value={isSpend ? "Spend" : "Usage"} disabled />
            </FormField>
            {isSpend && (
              <FormField label="Currency" htmlFor="budget-currency">
                <Input
                  id="budget-currency"
                  value={(budgetCurrency || "").toUpperCase()}
                  disabled
                />
              </FormField>
            )}
          </div>
          <FormField
            label="Limit"
            htmlFor="budget-limit"
            hint={
              isSpend && budgetCurrency
                ? `In ${budgetCurrency.toUpperCase()} (major units). Leave empty for no limit.`
                : "Number of uses. Leave empty for no limit."
            }
            error={budgetError || undefined}
          >
            <Input
              id="budget-limit"
              type="number"
              min={0}
              step={isSpend ? "0.01" : "1"}
              value={budgetLimit}
              onChange={(e) => setBudgetLimit(e.target.value)}
              placeholder="No limit"
            />
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setBudgetOpen(false)} className={secondaryBtn}>
              Cancel
            </button>
            <button type="submit" disabled={busy === "save-budget"} className={primaryBtn}>
              {busy === "save-budget" ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add promotions modal */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add Promotions"
        description="Select the promotions to add to the campaign."
        size="md"
      >
        <form onSubmit={saveAdd} className="space-y-4">
          <Input
            placeholder="Search promotions..."
            value={addSearch}
            onChange={(e) => setAddSearch(e.target.value)}
            autoFocus
          />
          {addLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-9 animate-pulse rounded-base bg-grey-10" />
              ))}
            </div>
          ) : allPromotions.length === 0 ? (
            <div className="rounded-base border border-dashed border-grey-20 p-6 text-center">
              <ReceiptPercent className="mx-auto h-6 w-6 text-grey-40" />
              <p className="mt-2 text-sm text-grey-50">Create a promotion first.</p>
            </div>
          ) : addCandidates.length === 0 ? (
            <p className="rounded-base border border-dashed border-grey-20 p-6 text-center text-sm text-grey-50">
              {addSearch.trim()
                ? "No promotions match your search."
                : "All promotions are already in this campaign."}
            </p>
          ) : (
            <div className="max-h-72 space-y-0.5 overflow-y-auto rounded-base border border-grey-20 p-1">
              {addCandidates.map((p) => {
                const reason = addDisabledReason(p)
                return (
                  <label
                    key={p.id}
                    className={cn(
                      "flex items-start gap-3 rounded-base px-2 py-2 text-sm",
                      reason ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-grey-10"
                    )}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={addSel.has(p.id)}
                      disabled={!!reason}
                      onChange={() => toggleAddSel(p.id)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-medium text-grey-90">
                          {p.display_code || "-"}
                        </span>
                        <PromotionStatusBadge status={p.status} />
                      </span>
                      <span className="mt-0.5 block text-xs text-grey-50">
                        {promotionValue(p, budgetCurrency)}
                        {p.is_automatic ? " · Automatic" : " · Code"}
                      </span>
                      {reason && (
                        <span className="mt-0.5 block text-xs text-amber-700">{reason}</span>
                      )}
                    </span>
                  </label>
                )
              })}
            </div>
          )}
          {addError && (
            <p className="flex items-center gap-1.5 text-xs text-red-600">
              <ExclamationCircle className="h-4 w-4" />
              {addError}
            </p>
          )}
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-grey-50">{addSel.size} selected</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setAddOpen(false)} className={secondaryBtn}>
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy === "add-promos" || addLoading}
                className={primaryBtn}
              >
                {busy === "add-promos" ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  )
}
