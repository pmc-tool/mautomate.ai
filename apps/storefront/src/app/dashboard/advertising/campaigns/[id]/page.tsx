"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import { useParams, useSearchParams } from "next/navigation"
import Link from "next/link"
import {
  ArrowUturnLeft,
  CheckCircleSolid,
  ExclamationCircle,
  Robot,
  Sparkles,
  Spinner,
  User as UserIcon,
} from "@medusajs/icons"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  AdsCampaignDetail,
  getAdsCampaignDetail,
  setAdsCampaignBudget,
  setAdsCampaignStatus,
} from "@lib/merchant-admin/api"
import { PageHeader } from "@components/merchant-admin/page-header"
import { SectionCard } from "@components/merchant-admin/section-card"
import { cn } from "@lib/util/cn"

/**
 * Advertising — campaign detail. The status control (Launch / Pause), budget
 * edit, 30-day performance, the ad previews, and the action timeline: every
 * change to this campaign — by you, by the AI, later by the autopilot — with
 * who did it and why.
 */

const fmtMoney = (v: number, currency: string | null): string => {
  const cur = currency ?? "USD"
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: cur,
      maximumFractionDigits: 2,
    }).format(v)
  } catch {
    return `${v.toFixed(2)} ${cur}`
  }
}

const STATUS_TONES: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700",
  paused: "bg-amber-50 text-amber-700",
  draft: "bg-grey-10 text-grey-70",
  error: "bg-rose-50 text-rose-700",
  archived: "bg-grey-10 text-grey-50",
}

const ACTOR_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  merchant: UserIcon,
  ai: Sparkles,
  autopilot: Robot,
  system: Robot,
}

export default function CampaignDetailPage() {
  const { token } = useMerchantAuth()
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const id = params?.id

  const [detail, setDetail] = useState<AdsCampaignDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [budgetDraft, setBudgetDraft] = useState<string | null>(null)
  const [notice, setNotice] = useState<{
    kind: "success" | "error"
    text: string
  } | null>(null)

  useEffect(() => {
    if (searchParams?.get("created")) {
      setNotice({
        kind: "success",
        text: "Campaign created — it is PAUSED. Review everything below, then press Launch when you are ready to spend.",
      })
    }
  }, [searchParams])

  const load = useCallback(async () => {
    if (!token || !id) return
    try {
      setDetail(await getAdsCampaignDetail(token, id))
    } catch (e: any) {
      setNotice({
        kind: "error",
        text: e?.message ?? "Could not load the campaign.",
      })
    } finally {
      setLoading(false)
    }
  }, [token, id])

  useEffect(() => {
    load()
  }, [load])

  const campaign = detail?.campaign

  const toggleStatus = useCallback(async () => {
    if (!token || !id || !campaign || busy) return
    const next = campaign.status === "active" ? "paused" : "active"
    if (
      next === "active" &&
      !window.confirm(
        `Launch "${campaign.name}"? It starts spending up to ${fmtMoney(
          campaign.daily_budget ?? 0,
          campaign.currency
        )} per day, billed to your ad account.`
      )
    ) {
      return
    }
    setBusy("status")
    setNotice(null)
    try {
      await setAdsCampaignStatus(token, id, next)
      setNotice({
        kind: "success",
        text: next === "active" ? "Campaign is live." : "Campaign paused.",
      })
      await load()
    } catch (e: any) {
      setNotice({ kind: "error", text: e?.message ?? "Status change failed." })
    } finally {
      setBusy(null)
    }
  }, [token, id, campaign, busy, load])

  const saveBudget = useCallback(async () => {
    if (!token || !id || budgetDraft == null || busy) return
    setBusy("budget")
    setNotice(null)
    try {
      await setAdsCampaignBudget(token, id, Number(budgetDraft))
      setBudgetDraft(null)
      await load()
    } catch (e: any) {
      setNotice({ kind: "error", text: e?.message ?? "Budget change failed." })
    } finally {
      setBusy(null)
    }
  }, [token, id, budgetDraft, busy, load])

  const maxDailySpend = useMemo(
    () => Math.max(...(detail?.daily ?? []).map((d) => d.spend), 0.01),
    [detail?.daily]
  )

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-16 text-grey-50">
        <Spinner className="animate-spin" /> Loading campaign…
      </div>
    )
  }
  if (!campaign) {
    return (
      <div className="py-16 text-center text-sm text-grey-50">
        Campaign not found.{" "}
        <Link href="/dashboard/advertising" className="underline">
          Back to Advertising
        </Link>
      </div>
    )
  }

  const tone = STATUS_TONES[campaign.status] ?? "bg-grey-10 text-grey-70"

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/dashboard/advertising"
            className="inline-flex items-center gap-1 text-xs text-grey-50 hover:text-grey-90"
          >
            <ArrowUturnLeft className="h-3.5 w-3.5" /> Advertising
          </Link>
          <PageHeader
            title={campaign.name}
            description={`${campaign.platform} · ${campaign.objective ?? ""} · created ${new Date(campaign.created_at).toLocaleDateString()}`}
          />
        </div>
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium capitalize",
              tone
            )}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
            {campaign.status}
          </span>
          {campaign.external_id && campaign.status !== "error" && (
            <button
              onClick={toggleStatus}
              disabled={busy === "status"}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50",
                campaign.status === "active"
                  ? "border border-grey-20 bg-white text-grey-90 hover:bg-grey-5"
                  : "bg-emerald-600 text-white hover:bg-emerald-700"
              )}
            >
              {busy === "status" ? <Spinner className="animate-spin" /> : null}
              {campaign.status === "active" ? "Pause" : "Launch"}
            </button>
          )}
        </div>
      </div>

      {notice && (
        <div
          className={cn(
            "flex items-start gap-2 rounded-base border p-4 text-sm",
            notice.kind === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-700"
          )}
        >
          {notice.kind === "success" ? (
            <CheckCircleSolid className="mt-0.5 shrink-0" />
          ) : (
            <ExclamationCircle className="mt-0.5 shrink-0" />
          )}
          <span>{notice.text}</span>
        </div>
      )}

      {campaign.error && (
        <div className="rounded-base border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          The platform rejected this campaign: {campaign.error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <div className="rounded-lg border border-grey-20 bg-white p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-grey-50">
            Daily budget
          </div>
          {budgetDraft == null ? (
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-semibold tabular-nums text-grey-90">
                {campaign.daily_budget != null
                  ? fmtMoney(campaign.daily_budget, campaign.currency)
                  : "—"}
              </span>
              {campaign.external_id && (
                <button
                  onClick={() =>
                    setBudgetDraft(String(campaign.daily_budget ?? ""))
                  }
                  className="text-xs text-grey-50 underline hover:text-grey-90"
                >
                  edit
                </button>
              )}
            </div>
          ) : (
            <div className="mt-1 flex items-center gap-1.5">
              <input
                value={budgetDraft}
                onChange={(e) => setBudgetDraft(e.target.value)}
                inputMode="decimal"
                className="w-20 rounded-md border border-grey-20 px-2 py-1 text-sm tabular-nums"
              />
              <button
                onClick={saveBudget}
                disabled={busy === "budget"}
                className="rounded-md bg-grey-90 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
              >
                {busy === "budget" ? "…" : "Save"}
              </button>
              <button
                onClick={() => setBudgetDraft(null)}
                className="text-xs text-grey-50"
              >
                cancel
              </button>
            </div>
          )}
        </div>
        {(
          [
            ["Spend (30d)", fmtMoney(detail!.totals.spend, campaign.currency)],
            ["Impressions", String(detail!.totals.impressions)],
            ["Clicks", String(detail!.totals.clicks)],
            ["Purchases", String(detail!.totals.conversions)],
            [
              "ROAS",
              detail!.totals.roas != null
                ? `${detail!.totals.roas.toFixed(2)}x`
                : "—",
            ],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="rounded-lg border border-grey-20 bg-white p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-grey-50">
              {label}
            </div>
            <div className="mt-1 text-2xl font-semibold tabular-nums text-grey-90">
              {value}
            </div>
          </div>
        ))}
      </div>

      {(detail?.daily ?? []).length > 0 && (
        <SectionCard title="Daily spend" description="Last 30 days.">
          <div className="flex h-24 items-end gap-[3px]">
            {detail!.daily.map((d) => (
              <div
                key={d.date}
                title={`${d.date}: ${fmtMoney(d.spend, campaign.currency)} · ${d.clicks} clicks · ${d.conversions} purchases`}
                className="min-w-[6px] flex-1 rounded-t-sm bg-grey-30 hover:bg-grey-50"
                style={{
                  height: `${Math.max((d.spend / maxDailySpend) * 100, d.spend > 0 ? 4 : 1)}%`,
                }}
              />
            ))}
          </div>
        </SectionCard>
      )}

      {(detail?.ads ?? []).length > 0 && (
        <SectionCard title="Ads" description="What people see.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {detail!.ads.map((ad) => (
              <div
                key={ad.id}
                className="overflow-hidden rounded-lg border border-grey-20 bg-white"
              >
                {ad.creative?.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={ad.creative.image_url}
                    alt=""
                    className="h-36 w-full object-cover"
                  />
                ) : (
                  <div className="flex h-36 items-center justify-center bg-grey-10 text-xs text-grey-40">
                    no image
                  </div>
                )}
                <div className="p-3">
                  <div className="text-sm font-semibold text-grey-90">
                    {ad.creative?.headline ?? ad.name}
                  </div>
                  <div className="mt-0.5 line-clamp-2 text-xs text-grey-60">
                    {ad.creative?.primary_text ?? ""}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      <SectionCard
        title="Activity"
        description="Every change to this campaign — by you, and later by the AI and autopilot — with the reason."
      >
        {(detail?.timeline ?? []).length === 0 ? (
          <div className="text-sm text-grey-50">No activity yet.</div>
        ) : (
          <ol className="space-y-3">
            {detail!.timeline.map((t) => {
              const Icon = ACTOR_ICON[t.actor] ?? UserIcon
              return (
                <li key={t.id} className="flex gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-grey-10 text-grey-60">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm text-grey-90">
                      {t.reason ?? t.action}
                    </div>
                    <div className="text-xs text-grey-50">
                      <span className="capitalize">{t.actor}</span> ·{" "}
                      {new Date(t.at).toLocaleString()}
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </SectionCard>
    </div>
  )
}
