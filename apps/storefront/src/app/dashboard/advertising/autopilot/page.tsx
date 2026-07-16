"use client"

import React, { useCallback, useEffect, useState } from "react"
import {
  CheckCircleSolid,
  ExclamationCircle,
  Robot,
  Spinner,
} from "@medusajs/icons"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  AdsAutopilot,
  AdsCampaignRow,
  createAdsRule,
  deleteAdsRule,
  getAdsAutopilot,
  listAdsCampaigns,
  runAdsAutopilotNow,
  toggleAdsRule,
  updateAdsAutopilot,
} from "@lib/merchant-admin/api"
import { PageHeader } from "@components/merchant-admin/page-header"
import { SectionCard } from "@components/merchant-admin/section-card"
import { cn } from "@lib/util/cn"

/**
 * Advertising — Autopilot. The automated media buyer with its guardrails on
 * display: it can pause and it can alert, never raise budgets or delete; the
 * monthly cap is the hard stop above every rule; every action it takes shows
 * up here and on the campaign timeline with the numbers that triggered it.
 */

const METRIC_LABEL: Record<string, string> = {
  spend: "Spend",
  cpa: "Cost per purchase",
  ctr: "CTR (%)",
  clicks: "Clicks",
  conversions: "Purchases",
}

export default function AutopilotPage() {
  const { token } = useMerchantAuth()
  const [data, setData] = useState<AdsAutopilot | null>(null)
  const [campaigns, setCampaigns] = useState<AdsCampaignRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [capDraft, setCapDraft] = useState("")
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null)

  // Rule builder
  const [rName, setRName] = useState("")
  const [rMetric, setRMetric] = useState<"spend" | "cpa" | "ctr" | "clicks" | "conversions">("cpa")
  const [rOp, setROp] = useState<"gt" | "lt">("gt")
  const [rValue, setRValue] = useState("20")
  const [rWindow, setRWindow] = useState("3")
  const [rMinSpend, setRMinSpend] = useState("10")
  const [rAction, setRAction] = useState<"pause_campaign" | "notify">("pause_campaign")
  const [rCampaign, setRCampaign] = useState<string>("")

  const load = useCallback(async () => {
    if (!token) return
    try {
      const [ap, camps] = await Promise.all([
        getAdsAutopilot(token),
        listAdsCampaigns(token).catch(() => ({ campaigns: [], count: 0, limit: 0, offset: 0 })),
      ])
      setData(ap)
      setCampaigns(camps.campaigns)
      setCapDraft(ap.settings.monthly_cap != null ? String(ap.settings.monthly_cap) : "")
    } catch (e: any) {
      setNotice({ kind: "error", text: e?.message ?? "Could not load autopilot." })
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  const saveSettings = useCallback(
    async (patch: { enabled?: boolean; monthly_cap?: number | null }) => {
      if (!token || busy) return
      setBusy("settings")
      setNotice(null)
      try {
        await updateAdsAutopilot(token, patch)
        await load()
      } catch (e: any) {
        setNotice({ kind: "error", text: e?.message ?? "Could not save." })
      } finally {
        setBusy(null)
      }
    },
    [token, busy, load]
  )

  const runNow = useCallback(async () => {
    if (!token || busy) return
    setBusy("run")
    setNotice(null)
    try {
      const { summary } = await runAdsAutopilotNow(token)
      setNotice({
        kind: "success",
        text: !summary.enabled
          ? "Autopilot is switched off — turn it on first."
          : summary.cap_hit
            ? `Monthly cap reached (${summary.month_spend.toFixed(2)} spent) — active campaigns were paused.`
            : summary.fired.length
              ? `Check complete: ${summary.fired.map((f) => f.reason).join(" · ")}`
              : `Check complete — ${summary.checked} campaign-rule pair${summary.checked === 1 ? "" : "s"} evaluated, nothing needed action.`,
      })
      await load()
    } catch (e: any) {
      setNotice({ kind: "error", text: e?.message ?? "The check failed." })
    } finally {
      setBusy(null)
    }
  }, [token, busy, load])

  const addRule = useCallback(async () => {
    if (!token || busy) return
    setBusy("rule")
    setNotice(null)
    try {
      await createAdsRule(token, {
        name:
          rName.trim() ||
          `${METRIC_LABEL[rMetric]} ${rOp === "gt" ? ">" : "<"} ${rValue} over ${rWindow}d`,
        metric: rMetric,
        op: rOp,
        value: Number(rValue),
        window_days: Number(rWindow),
        min_spend: Number(rMinSpend),
        action: rAction,
        campaign_id: rCampaign || null,
      })
      setRName("")
      await load()
    } catch (e: any) {
      setNotice({ kind: "error", text: e?.message ?? "Could not create the rule." })
    } finally {
      setBusy(null)
    }
  }, [token, busy, rName, rMetric, rOp, rValue, rWindow, rMinSpend, rAction, rCampaign, load])

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-16 text-grey-50">
        <Spinner className="animate-spin" /> Loading…
      </div>
    )
  }

  const settings = data?.settings

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="Autopilot"
          description="Watches your campaigns on the numbers the platform reports. It can pause and it can alert — it never raises budgets and never deletes anything."
        />
        <button
          onClick={runNow}
          disabled={busy != null}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-grey-20 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-5 disabled:opacity-50"
        >
          {busy === "run" ? <Spinner className="animate-spin" /> : <Robot />}
          Run a check now · free
        </button>
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

      <SectionCard
        title="Status & spending cap"
        description="The scheduled watch costs 3 credits per active day. The cap is the hard stop: month-to-date spend reaching it pauses every campaign, before any rule runs."
      >
        <div className="flex flex-wrap items-end gap-6">
          <div>
            <span className="text-xs font-medium text-grey-70">Autopilot</span>
            <div className="mt-1">
              <button
                onClick={() => saveSettings({ enabled: !settings?.enabled })}
                disabled={busy != null}
                className={cn(
                  "rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50",
                  settings?.enabled
                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                    : "border border-grey-20 bg-white text-grey-90 hover:bg-grey-5"
                )}
              >
                {settings?.enabled ? "On — watching" : "Off — turn on"}
              </button>
            </div>
          </div>
          <label className="block">
            <span className="text-xs font-medium text-grey-70">
              Monthly spend cap <span className="font-normal text-grey-50">(ad account currency; empty = no cap)</span>
            </span>
            <div className="mt-1 flex items-center gap-2">
              <input
                value={capDraft}
                onChange={(e) => setCapDraft(e.target.value)}
                inputMode="decimal"
                placeholder="e.g. 300"
                className="w-36 rounded-md border border-grey-20 px-3 py-2 text-sm tabular-nums"
              />
              <button
                onClick={() =>
                  saveSettings({
                    monthly_cap: capDraft.trim() === "" ? null : Number(capDraft),
                  })
                }
                disabled={busy != null}
                className="rounded-md bg-grey-90 px-3 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:opacity-50"
              >
                Save cap
              </button>
            </div>
          </label>
        </div>
      </SectionCard>

      <SectionCard
        title="Rules"
        description='Condition → action. Example: "Cost per purchase above 20 over 3 days (after at least 10 spent) → pause the campaign."'
      >
        <div className="grid grid-cols-2 gap-3 rounded-lg border border-grey-20 bg-grey-5 p-3 sm:grid-cols-4 lg:grid-cols-8">
          <label className="col-span-2 block">
            <span className="text-[11px] font-medium text-grey-60">Name (optional)</span>
            <input value={rName} onChange={(e) => setRName(e.target.value)} placeholder="auto" className="mt-0.5 w-full rounded-md border border-grey-20 px-2 py-1.5 text-sm" />
          </label>
          <label className="block">
            <span className="text-[11px] font-medium text-grey-60">Metric</span>
            <select value={rMetric} onChange={(e) => setRMetric(e.target.value as any)} className="mt-0.5 w-full rounded-md border border-grey-20 bg-white px-2 py-1.5 text-sm">
              {Object.entries(METRIC_LABEL).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[11px] font-medium text-grey-60">Is</span>
            <select value={rOp} onChange={(e) => setROp(e.target.value as any)} className="mt-0.5 w-full rounded-md border border-grey-20 bg-white px-2 py-1.5 text-sm">
              <option value="gt">above</option>
              <option value="lt">below</option>
            </select>
          </label>
          <label className="block">
            <span className="text-[11px] font-medium text-grey-60">Value</span>
            <input value={rValue} onChange={(e) => setRValue(e.target.value)} inputMode="decimal" className="mt-0.5 w-full rounded-md border border-grey-20 px-2 py-1.5 text-sm tabular-nums" />
          </label>
          <label className="block">
            <span className="text-[11px] font-medium text-grey-60">Over (days)</span>
            <input value={rWindow} onChange={(e) => setRWindow(e.target.value)} inputMode="numeric" className="mt-0.5 w-full rounded-md border border-grey-20 px-2 py-1.5 text-sm tabular-nums" />
          </label>
          <label className="block">
            <span className="text-[11px] font-medium text-grey-60">Min spend</span>
            <input value={rMinSpend} onChange={(e) => setRMinSpend(e.target.value)} inputMode="decimal" className="mt-0.5 w-full rounded-md border border-grey-20 px-2 py-1.5 text-sm tabular-nums" />
          </label>
          <label className="block">
            <span className="text-[11px] font-medium text-grey-60">Then</span>
            <select value={rAction} onChange={(e) => setRAction(e.target.value as any)} className="mt-0.5 w-full rounded-md border border-grey-20 bg-white px-2 py-1.5 text-sm">
              <option value="pause_campaign">Pause it</option>
              <option value="notify">Alert only</option>
            </select>
          </label>
          <label className="col-span-2 block sm:col-span-3 lg:col-span-6">
            <span className="text-[11px] font-medium text-grey-60">Applies to</span>
            <select value={rCampaign} onChange={(e) => setRCampaign(e.target.value)} className="mt-0.5 w-full rounded-md border border-grey-20 bg-white px-2 py-1.5 text-sm">
              <option value="">Every active campaign</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <div className="col-span-2 flex items-end justify-end">
            <button
              onClick={addRule}
              disabled={busy != null || !Number.isFinite(Number(rValue))}
              className="rounded-md bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:opacity-50"
            >
              {busy === "rule" ? <Spinner className="animate-spin" /> : "Add rule"}
            </button>
          </div>
        </div>

        {(data?.rules ?? []).length === 0 ? (
          <p className="mt-4 text-sm text-grey-50">
            No rules yet. Add one above — the classic starter is cost per
            purchase above your break-even, over 3 days, pause it.
          </p>
        ) : (
          <div className="mt-4 divide-y divide-grey-10">
            {data!.rules.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <div className="min-w-0 text-sm">
                  <span className="font-medium text-grey-90">{r.name}</span>{" "}
                  <span className="text-grey-50">
                    — {METRIC_LABEL[r.metric]} {r.op === "gt" ? ">" : "<"} {r.value} over {r.window_days}d
                    {r.min_spend ? `, after ${r.min_spend} spent` : ""} →{" "}
                    {r.action === "pause_campaign" ? "pause" : "alert"}
                    {r.campaign_id ? "" : " (all campaigns)"}
                  </span>
                  {r.last_fired_at && (
                    <span className="block text-xs text-grey-40">
                      last fired {new Date(r.last_fired_at).toLocaleString()}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      if (!token) return
                      await toggleAdsRule(token, r.id, !r.enabled).catch(() => null)
                      await load()
                    }}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-medium",
                      r.enabled ? "bg-emerald-50 text-emerald-700" : "bg-grey-10 text-grey-50"
                    )}
                  >
                    {r.enabled ? "On" : "Off"}
                  </button>
                  <button
                    onClick={async () => {
                      if (!token) return
                      await deleteAdsRule(token, r.id).catch(() => null)
                      await load()
                    }}
                    className="text-xs text-grey-40 underline hover:text-rose-600"
                  >
                    delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="What autopilot did"
        description="Every automated action, with the numbers that triggered it. The same entries appear on each campaign's timeline."
      >
        {(data?.activity ?? []).length === 0 ? (
          <p className="text-sm text-grey-50">Nothing yet — it acts only when a rule or the cap actually trips.</p>
        ) : (
          <ol className="space-y-2.5">
            {data!.activity.map((a) => (
              <li key={a.id} className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-grey-10 text-grey-60">
                  <Robot className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0">
                  <div className="text-sm text-grey-90">{a.reason ?? a.action}</div>
                  <div className="text-xs text-grey-50">{new Date(a.at).toLocaleString()}</div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </SectionCard>
    </div>
  )
}
