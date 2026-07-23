"use client"

import React, { useCallback, useEffect, useState } from "react"
import {
  CheckCircleSolid,
  ExclamationCircle,
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
import { cn } from "@lib/util/cn"

/**
 * Advertising — Autopilot, presented as a watch console. One dark panel
 * answers the three questions a merchant comes here with — is the watch
 * armed, what will it do, what has it done — and the rules read as the
 * sentences they actually are. Ink is for action, ember is for state.
 */

const METRIC_SENTENCE: Record<string, string> = {
  spend: "spend",
  cpa: "cost per purchase",
  ctr: "CTR",
  clicks: "clicks",
  conversions: "purchases",
}

const METRIC_LABEL: Record<string, string> = {
  spend: "Spend",
  cpa: "Cost per purchase",
  ctr: "CTR (%)",
  clicks: "Clicks",
  conversions: "Purchases",
}

const fmt = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })

const metricValue = (metric: string, value: number) =>
  metric === "ctr" ? `${fmt(value)}%` : fmt(value)

/** Value chips inside a rule sentence. */
const Tok = ({ children, act = false }: { children: React.ReactNode; act?: boolean }) => (
  <span
    className={cn(
      "inline-block whitespace-nowrap rounded px-2 py-px font-semibold tabular-nums",
      act ? "bg-[#FEF1EA] text-[#B44A12]" : "bg-grey-5 text-grey-90"
    )}
  >
    {children}
  </span>
)

/** Inline editable tokens for the sentence composer. */
const tokenField =
  "border-0 border-b border-dashed border-grey-30 bg-transparent font-semibold text-grey-90 focus:outline-none focus:border-solid focus:border-[#F26522] focus:bg-[#FEF1EA]"

export default function AutopilotPage() {
  const { token } = useMerchantAuth()
  const [data, setData] = useState<AdsAutopilot | null>(null)
  const [campaigns, setCampaigns] = useState<AdsCampaignRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [capDraft, setCapDraft] = useState("")
  const [capEditing, setCapEditing] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null)

  // Rule composer
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

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(t)
  }, [])

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

  const saveCap = useCallback(async () => {
    await saveSettings({ monthly_cap: capDraft.trim() === "" ? null : Number(capDraft) })
    setCapEditing(false)
  }, [saveSettings, capDraft])

  const runNow = useCallback(async () => {
    if (!token || busy) return
    setBusy("run")
    setNotice(null)
    try {
      const { summary } = await runAdsAutopilotNow(token)
      setNotice({
        kind: "success",
        text: !summary.enabled
          ? "Autopilot is standing down — arm it first."
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
  const armed = Boolean(settings?.enabled)
  const cap = settings?.monthly_cap ?? null
  const spend = data?.month_spend ?? null
  const rules = data?.rules ?? []
  const activity = data?.activity ?? []
  const activeCount = campaigns.filter(
    (c) => String(c.status).toUpperCase() === "ACTIVE"
  ).length
  const capPct =
    cap != null && spend != null ? Math.min(100, (spend / cap) * 100) : 0

  const campaignName = (id: string | null) =>
    id ? campaigns.find((c) => c.id === id)?.name ?? "one campaign" : "every active campaign"

  const dotFor = (action: string) =>
    action.includes("cap")
      ? "bg-rose-600"
      : action.includes("pause")
        ? "bg-[#F26522]"
        : "bg-grey-30"

  return (
    <div className="space-y-8">
      <PageHeader
        title="Autopilot"
        description="Watches your campaigns on the numbers the platform reports. It can pause and it can alert — nothing more."
      />

      {notice && (
        <div
          className={cn(
            "flex items-start gap-2 rounded-md border px-4 py-3 text-[13px]",
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

      {/* The watch console */}
      <section className="overflow-hidden rounded-[10px] bg-gradient-to-b from-[#171C24] to-[#0F1319] text-white shadow-[0_6px_24px_-8px_rgba(15,19,25,0.4)]">
        <div className="grid items-center gap-7 p-7 md:grid-cols-[1.15fr_1fr_auto]">
          {/* Status */}
          <div className="flex items-center gap-4">
            <span className="relative flex h-11 w-11 shrink-0 items-center justify-center" aria-hidden="true">
              {armed && (
                <span className="absolute inline-flex h-full w-full rounded-full border border-[#F26522] opacity-60 [animation-duration:2.6s] animate-ping motion-reduce:hidden" />
              )}
              <span
                className={cn(
                  "h-3 w-3 rounded-full transition-all duration-300",
                  armed
                    ? "bg-[#F26522] shadow-[0_0_12px_2px_rgba(242,101,34,0.35)]"
                    : "bg-[#3A4350]"
                )}
              />
            </span>
            <div>
              <p className={cn("text-lg font-semibold leading-tight", armed ? "text-white" : "text-white/55")}>
                {armed ? "Armed" : "Standing by"}
              </p>
              <p className="mt-0.5 text-xs text-white/55">
                {armed ? (
                  <>
                    Watching{" "}
                    <b className="font-medium text-white">
                      {activeCount} active campaign{activeCount === 1 ? "" : "s"}
                    </b>{" "}
                    · checks run hourly
                  </>
                ) : rules.length ? (
                  "Rules are written, but nothing is watching them yet."
                ) : (
                  "Write a rule below, then arm it."
                )}
              </p>
            </div>
          </div>

          {/* Spend vs the hard stop */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-white/50">
              Month-to-date spend
            </p>
            <div className="mt-1 flex items-baseline gap-2 tabular-nums">
              <span className="text-[22px] font-semibold leading-none">
                {spend != null ? fmt(spend) : "—"}
              </span>
              {cap != null && (
                <span className="text-xs text-white/55">of {fmt(cap)} cap</span>
              )}
            </div>
            {cap != null && (
              <div className="relative mt-2.5 h-1 rounded-full bg-white/10">
                <span
                  className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#8A919C] to-[#C3C9D1] transition-[width] duration-1000 ease-out"
                  style={{ width: mounted ? `${capPct}%` : "0%" }}
                />
                <span className="absolute -inset-y-1 right-0 w-0.5 rounded-full bg-[#F26522]" />
              </div>
            )}
            {capEditing ? (
              <div className="mt-2.5 flex items-center gap-2">
                <input
                  value={capDraft}
                  onChange={(e) => setCapDraft(e.target.value)}
                  inputMode="decimal"
                  placeholder="e.g. 300"
                  autoFocus
                  className="w-28 rounded-md border border-white/20 bg-white/10 px-2.5 py-1.5 text-sm tabular-nums text-white placeholder-white/40 focus:border-[#F26522] focus:outline-none"
                />
                <button
                  onClick={saveCap}
                  disabled={busy != null}
                  className="rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-[#0F1319] hover:bg-grey-10 disabled:opacity-50"
                >
                  Save cap
                </button>
                <button
                  onClick={() => setCapEditing(false)}
                  className="text-xs text-white/55 hover:text-white"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <p className="mt-2 text-[11px] leading-relaxed text-white/50">
                {cap != null ? (
                  <>
                    The cap is the{" "}
                    <b className="font-medium text-[#F26522]">hard stop</b> — reaching it
                    pauses every campaign, before any rule runs.{" "}
                    <button
                      onClick={() => setCapEditing(true)}
                      className="underline underline-offset-2 hover:text-white"
                    >
                      Change
                    </button>
                  </>
                ) : (
                  <>
                    No cap set — autopilot has no hard stop.{" "}
                    <button
                      onClick={() => setCapEditing(true)}
                      className="underline underline-offset-2 hover:text-white"
                    >
                      Add one
                    </button>
                  </>
                )}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex min-w-[190px] flex-col gap-2.5">
            <button
              onClick={() => saveSettings({ enabled: !armed })}
              disabled={busy != null}
              className={cn(
                "rounded-md px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50",
                armed
                  ? "border border-white/15 text-white hover:border-white/30"
                  : "bg-white text-[#0F1319] hover:bg-grey-10"
              )}
            >
              {busy === "settings" ? (
                <Spinner className="mx-auto animate-spin" />
              ) : armed ? (
                "Stand down"
              ) : (
                "Arm autopilot"
              )}
            </button>
            <button
              onClick={runNow}
              disabled={busy != null}
              className="rounded-md border border-white/15 px-4 py-2 text-sm font-medium text-white/70 transition-colors hover:border-white/30 hover:text-white disabled:opacity-50"
            >
              {busy === "run" ? <Spinner className="mx-auto animate-spin" /> : "Run a check now — free"}
            </button>
            <p className="text-center text-[11px] text-white/45">
              3 credits per active day, only while armed
            </p>
          </div>
        </div>

        {/* What it can and cannot do */}
        <div className="flex flex-wrap items-center gap-x-8 gap-y-1 border-t border-white/10 px-7 py-3 text-xs text-white/55">
          <span className="flex items-center gap-2 py-0.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
            Can pause a campaign
          </span>
          <span className="flex items-center gap-2 py-0.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M10.3 21a2 2 0 003.4 0" />
            </svg>
            Can alert you with the numbers
          </span>
          <span className="flex items-center gap-2 py-0.5 text-white">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#F26522" strokeWidth="2">
              <path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z" />
            </svg>
            Never raises budgets. Never deletes anything.
          </span>
        </div>
      </section>

      {/* Rules */}
      <section>
        <div className="mb-3 flex items-baseline gap-2.5">
          <h2 className="text-sm font-semibold text-grey-90">Rules</h2>
          <span className="text-[11px] tabular-nums text-grey-40">{rules.length}</span>
          <span className="ml-auto text-xs text-grey-40">Checked every hour while armed</span>
        </div>

        {rules.length > 0 && (
          <div className="divide-y divide-grey-10 rounded-[10px] border border-grey-20 bg-white shadow-sm">
            {rules.map((r) => (
              <article
                key={r.id}
                className={cn("px-5 py-4", !r.enabled && "opacity-55")}
              >
                <p className="text-sm leading-[2] text-grey-90">
                  If <Tok>{METRIC_SENTENCE[r.metric]}</Tok> stays{" "}
                  <Tok>
                    {r.op === "gt" ? "above" : "below"} {metricValue(r.metric, r.value)}
                  </Tok>{" "}
                  for <Tok>{r.window_days} day{r.window_days === 1 ? "" : "s"}</Tok>
                  {r.min_spend > 0 && (
                    <>
                      {" "}— with at least <Tok>{fmt(r.min_spend)} spent</Tok> —
                    </>
                  )}{" "}
                  <Tok act>{r.action === "pause_campaign" ? "pause the campaign" : "alert me"}</Tok>.
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-grey-40">
                  <span>{campaignName(r.campaign_id)}</span>
                  {r.last_fired_at ? (
                    <span className="font-medium text-grey-60">
                      Last fired {new Date(r.last_fired_at).toLocaleString()}
                    </span>
                  ) : (
                    <span>Never fired</span>
                  )}
                  <span className="ml-auto flex items-center gap-3">
                    <button
                      onClick={async () => {
                        if (!token) return
                        await toggleAdsRule(token, r.id, !r.enabled).catch(() => null)
                        await load()
                      }}
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                        r.enabled
                          ? "bg-[#FEF1EA] text-[#B44A12]"
                          : "bg-grey-10 text-grey-50"
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
                      className="text-grey-40 hover:text-rose-600 hover:underline"
                    >
                      Delete
                    </button>
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}

        {/* Sentence composer */}
        <div
          className={cn(
            "rounded-[10px] border border-dashed border-grey-30 bg-white px-5 py-4",
            rules.length > 0 && "mt-3"
          )}
        >
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.07em] text-grey-40">
            New rule
          </p>
          <p className="text-sm leading-[2.4] text-grey-90">
            If{" "}
            <select
              value={rMetric}
              onChange={(e) => setRMetric(e.target.value as any)}
              className={tokenField}
            >
              {Object.entries(METRIC_SENTENCE).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>{" "}
            is{" "}
            <select
              value={rOp}
              onChange={(e) => setROp(e.target.value as any)}
              className={tokenField}
            >
              <option value="gt">above</option>
              <option value="lt">below</option>
            </select>{" "}
            <input
              value={rValue}
              onChange={(e) => setRValue(e.target.value)}
              inputMode="decimal"
              aria-label="Value"
              className={cn(tokenField, "w-14 text-center tabular-nums")}
            />{" "}
            over{" "}
            <input
              value={rWindow}
              onChange={(e) => setRWindow(e.target.value)}
              inputMode="numeric"
              aria-label="Days"
              className={cn(tokenField, "w-10 text-center tabular-nums")}
            />{" "}
            days — after at least{" "}
            <input
              value={rMinSpend}
              onChange={(e) => setRMinSpend(e.target.value)}
              inputMode="decimal"
              aria-label="Minimum spend"
              className={cn(tokenField, "w-14 text-center tabular-nums")}
            />{" "}
            spent —{" "}
            <select
              value={rAction}
              onChange={(e) => setRAction(e.target.value as any)}
              className={cn(tokenField, "text-[#B44A12]")}
            >
              <option value="pause_campaign">pause the campaign</option>
              <option value="notify">alert me</option>
            </select>
            , for{" "}
            <select
              value={rCampaign}
              onChange={(e) => setRCampaign(e.target.value)}
              className={tokenField}
            >
              <option value="">every active campaign</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            .
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              onClick={addRule}
              disabled={
                busy != null ||
                !Number.isFinite(Number(rValue)) ||
                !Number.isFinite(Number(rWindow))
              }
              className="rounded-md bg-[#0F1319] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1F2630] disabled:opacity-50"
            >
              {busy === "rule" ? <Spinner className="animate-spin" /> : "Add rule"}
            </button>
            <input
              value={rName}
              onChange={(e) => setRName(e.target.value)}
              placeholder="Name it (optional)"
              className="w-40 rounded-md border border-grey-20 px-2.5 py-1.5 text-xs text-grey-90 placeholder-grey-40 focus:border-[#F26522] focus:outline-none"
            />
            <span className="text-xs text-grey-40">
              The classic starter: cost per purchase above your break-even, over 3 days, pause it.
            </span>
          </div>
        </div>
      </section>

      {/* Ledger */}
      <section>
        <div className="mb-3 flex items-baseline gap-2.5">
          <h2 className="text-sm font-semibold text-grey-90">What autopilot did</h2>
          <span className="ml-auto text-xs text-grey-40">
            The same entries appear on each campaign&apos;s timeline
          </span>
        </div>
        <div className="rounded-[10px] border border-grey-20 bg-white shadow-sm">
          {activity.length === 0 ? (
            <p className="px-5 py-5 text-sm text-grey-40">
              Nothing yet — it acts only when a rule or the cap actually trips. Every
              action lands here with the numbers that triggered it.
            </p>
          ) : (
            <div className="divide-y divide-grey-10">
              {activity.map((a) => (
                <div
                  key={a.id}
                  className="grid grid-cols-[92px_16px_1fr] items-start gap-x-3 px-5 py-3"
                >
                  <time className="pt-px text-[11px] tabular-nums text-grey-40">
                    {new Date(a.at).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </time>
                  <span className={cn("mt-1.5 h-2 w-2 rounded-full justify-self-center", dotFor(a.action))} />
                  <p className="text-[13px] leading-relaxed text-grey-90">
                    {a.reason ?? a.action}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
