/**
 * Platform → AI Usage & Cost (super-admin).
 *
 * A native operator view of platform-wide AI spend, fed by the self-hosted
 * Langfuse via GET /admin/platform/ai-usage (the backend reads the Langfuse env
 * server-side and never exposes the secret to the browser). No SSH tunnel, no
 * separate Langfuse login — the operator sees cost by merchant / feature / model
 * and the most recent AI activity for a 24h / 7d / 30d window.
 *
 * Self-contained by design: inline fetch + types + CSP-safe inline bars, built
 * on the shared marketing ui-kit so it matches the rest of the admin.
 */
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { CurrencyDollar, ArrowPath, Sparkles, ChartBar, Bolt } from "@medusajs/icons"
import { Button, Container, Text, clx } from "@medusajs/ui"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ACCENTS,
  EmptyState,
  PageHeader,
  SectionLabel,
  StatTile,
} from "../../marketing/_components/ui-kit"

/* ------------------------------------------------------------------ *
 * Types (mirror the API response)
 * ------------------------------------------------------------------ */

type MerchantRow = {
  tenant_id: string | null
  name: string
  cost: number
  traces: number
  tokens: number
}
type FeatureRow = { feature: string; cost: number; traces: number }
type ModelRow = { model: string; cost: number; tokens: number; traces: number }
type RecentRow = {
  time: string
  name: string
  feature: string
  merchant: string
  model: string | null
  cost: number
}

type AiUsage = {
  available: true
  range: string
  window: { from: string; to: string }
  total_cost: number
  total_traces: number
  total_tokens: number
  by_merchant: MerchantRow[]
  by_feature: FeatureRow[]
  by_model: ModelRow[]
  recent: RecentRow[]
  truncated?: boolean
  note?: string
}

type AiUsageUnavailable = { available: false; reason: string }
type AiUsageResponse = AiUsage | AiUsageUnavailable

/* ------------------------------------------------------------------ *
 * Fetch helper — credentials included so the admin cookie rides along
 * ------------------------------------------------------------------ */

const fetchUsage = async (range: string): Promise<AiUsageResponse> => {
  const res = await fetch(`/admin/platform/ai-usage?range=${range}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  })
  if (!res.ok) {
    let detail = ""
    try {
      const body = await res.json()
      detail = body?.message || body?.error || ""
    } catch (_e) {
      /* no JSON body */
    }
    throw new Error(detail || `Request failed (${res.status})`)
  }
  return (await res.json()) as AiUsageResponse
}

/* ------------------------------------------------------------------ *
 * Formatting
 * ------------------------------------------------------------------ */

const RANGES = [
  { key: "24h", label: "24h" },
  { key: "7d", label: "7d" },
  { key: "30d", label: "30d" },
]

const fmtInt = (v: number): string => new Intl.NumberFormat().format(v ?? 0)

/** USD with 4 decimals — AI costs are tiny (fractions of a cent). */
const fmtUSD = (v: number): string => {
  const amount = Number(v ?? 0)
  return `$${amount.toLocaleString(undefined, {
    minimumFractionDigits: amount === 0 ? 2 : 4,
    maximumFractionDigits: 4,
  })}`
}

const fmtTime = (iso: string): string => {
  const d = new Date(iso)
  if (isNaN(d.getTime())) {
    return iso
  }
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

const titleize = (s: string): string =>
  (s || "").replace(/[_:]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())

/* ------------------------------------------------------------------ *
 * Building blocks
 * ------------------------------------------------------------------ */

const Panel = ({
  title,
  count,
  children,
}: {
  title: string
  count?: number
  children: React.ReactNode
}) => (
  <div className="flex flex-col rounded-xl border border-ui-border-base bg-ui-bg-base">
    <div className="flex items-center justify-between border-b border-ui-border-base px-4 py-3">
      <SectionLabel count={count} className="mb-0">
        {title}
      </SectionLabel>
    </div>
    <div className="p-4">{children}</div>
  </div>
)

/** A labelled horizontal bar (CSP-safe — pure div, no chart lib). */
const Bar = ({
  label,
  value,
  max,
  accent,
  right,
}: {
  label: string
  value: number
  max: number
  accent: string
  right: string
}) => {
  const w = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0
  return (
    <div className="flex flex-col gap-y-1 py-1.5">
      <div className="flex items-center justify-between gap-x-3">
        <Text size="small" className="truncate text-ui-fg-base">
          {label}
        </Text>
        <Text size="small" className="shrink-0 tabular-nums text-ui-fg-subtle">
          {right}
        </Text>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-ui-bg-subtle">
        <div
          style={{ width: `${w}%`, background: accent }}
          className="h-full rounded-full"
        />
      </div>
    </div>
  )
}

const CardSkeleton = () => (
  <div className="h-[104px] animate-pulse rounded-xl border border-ui-border-base bg-ui-bg-subtle" />
)

/* ------------------------------------------------------------------ *
 * Page
 * ------------------------------------------------------------------ */

const AiUsagePage = () => {
  const [range, setRange] = useState<string>("7d")
  const [data, setData] = useState<AiUsage | null>(null)
  const [unavailable, setUnavailable] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  const load = useCallback(async (r: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchUsage(r)
      if (res.available === false) {
        setUnavailable(res.reason || "Langfuse is unavailable.")
        setData(null)
      } else {
        setUnavailable(null)
        setData(res)
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load AI usage.")
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(range)
  }, [range, load])

  const hasActivity = !!data && data.total_traces > 0

  const merchantMax = useMemo(
    () => Math.max(0, ...(data?.by_merchant || []).map((m) => m.cost)),
    [data]
  )
  const featureMax = useMemo(
    () => Math.max(0, ...(data?.by_feature || []).map((f) => f.cost)),
    [data]
  )
  const modelMax = useMemo(
    () => Math.max(0, ...(data?.by_model || []).map((m) => m.cost)),
    [data]
  )

  const RangeSwitcher = (
    <div className="flex items-center gap-x-1 rounded-lg border border-ui-border-base bg-ui-bg-subtle p-0.5">
      {RANGES.map((r) => (
        <button
          key={r.key}
          onClick={() => setRange(r.key)}
          className={clx(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            range === r.key
              ? "bg-ui-bg-base text-ui-fg-base shadow-sm"
              : "text-ui-fg-subtle hover:text-ui-fg-base"
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  )

  return (
    <Container className="p-0">
      <PageHeader
        icon={CurrencyDollar}
        accent="green"
        title="AI Usage & Cost"
        subtitle="Platform-wide AI spend across all merchants, from the self-hosted Langfuse."
        actions={
          <div className="flex items-center gap-x-2">
            {RangeSwitcher}
            <Button
              variant="secondary"
              size="small"
              onClick={() => load(range)}
              disabled={loading}
            >
              <ArrowPath className={clx(loading && "animate-spin")} />
              Refresh
            </Button>
          </div>
        }
      />

      <div className="flex flex-col gap-y-6 px-6 pb-8">
        {/* Error */}
        {error && (
          <div className="rounded-xl border border-ui-border-error bg-ui-bg-base p-4">
            <Text weight="plus" className="text-ui-fg-base">
              Could not load AI usage
            </Text>
            <Text size="small" className="text-ui-fg-subtle">
              {error}
            </Text>
          </div>
        )}

        {/* Unavailable (Langfuse off / unreachable) */}
        {!error && unavailable && !loading && (
          <div className="rounded-xl border border-ui-border-base bg-ui-bg-base">
            <EmptyState
              icon={Sparkles}
              accent="amber"
              title="AI usage tracking is unavailable"
              description={unavailable}
            />
          </div>
        )}

        {/* Loading */}
        {loading && !data && (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
            </div>
            <div className="h-64 animate-pulse rounded-xl border border-ui-border-base bg-ui-bg-subtle" />
          </>
        )}

        {/* Data */}
        {!error && !unavailable && data && (
          <>
            {/* Scorecards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatTile
                label="Total AI cost"
                value={fmtUSD(data.total_cost)}
                sub={`${titleize(data.range)} window`}
                accent="green"
                icon={CurrencyDollar}
              />
              <StatTile
                label="Total traces"
                value={fmtInt(data.total_traces)}
                sub="AI calls tracked"
                accent="blue"
                icon={ChartBar}
              />
              <StatTile
                label="Total tokens"
                value={fmtInt(data.total_tokens)}
                sub="Prompt + completion"
                accent="violet"
                icon={Bolt}
              />
            </div>

            {data.truncated && data.note && (
              <div className="rounded-lg border border-ui-border-base bg-ui-bg-subtle px-4 py-2">
                <Text size="small" className="text-ui-fg-subtle">
                  {data.note}
                </Text>
              </div>
            )}

            {!hasActivity ? (
              <div className="rounded-xl border border-ui-border-base bg-ui-bg-base">
                <EmptyState
                  icon={Sparkles}
                  accent="slate"
                  title="No AI activity yet in this window"
                  description="Once merchants use AI features, spend will show up here broken down by merchant, feature, and model."
                />
              </div>
            ) : (
              <>
                {/* Cost by merchant — the headline */}
                <Panel title="Cost by merchant" count={data.by_merchant.length}>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[520px] text-left text-sm">
                      <thead>
                        <tr className="text-ui-fg-muted">
                          <th className="pb-2 font-normal">Merchant</th>
                          <th className="pb-2 text-right font-normal">Cost</th>
                          <th className="pb-2 text-right font-normal">Traces</th>
                          <th className="pb-2 text-right font-normal">Tokens</th>
                          <th className="w-[30%] pb-2 pl-4 font-normal">Share</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.by_merchant.map((m) => {
                          const w =
                            merchantMax > 0
                              ? Math.max(2, Math.round((m.cost / merchantMax) * 100))
                              : 0
                          return (
                            <tr
                              key={m.tenant_id ?? "platform"}
                              className="border-t border-ui-border-base"
                            >
                              <td className="py-2 pr-3">
                                <Text
                                  size="small"
                                  weight="plus"
                                  className="text-ui-fg-base"
                                >
                                  {m.name}
                                </Text>
                              </td>
                              <td className="py-2 text-right tabular-nums text-ui-fg-base">
                                {fmtUSD(m.cost)}
                              </td>
                              <td className="py-2 text-right tabular-nums text-ui-fg-subtle">
                                {fmtInt(m.traces)}
                              </td>
                              <td className="py-2 text-right tabular-nums text-ui-fg-subtle">
                                {fmtInt(m.tokens)}
                              </td>
                              <td className="py-2 pl-4">
                                <div className="h-1.5 w-full overflow-hidden rounded-full bg-ui-bg-subtle">
                                  <div
                                    style={{
                                      width: `${w}%`,
                                      background: ACCENTS.green,
                                    }}
                                    className="h-full rounded-full"
                                  />
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </Panel>

                {/* Feature + model breakdowns */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <Panel title="Cost by feature" count={data.by_feature.length}>
                    {data.by_feature.length ? (
                      <div className="flex flex-col divide-y divide-ui-border-base">
                        {data.by_feature.map((f) => (
                          <Bar
                            key={f.feature}
                            label={titleize(f.feature)}
                            value={f.cost}
                            max={featureMax}
                            accent={ACCENTS.blue}
                            right={`${fmtUSD(f.cost)} · ${fmtInt(f.traces)}`}
                          />
                        ))}
                      </div>
                    ) : (
                      <Text size="small" className="text-ui-fg-subtle">
                        No feature data.
                      </Text>
                    )}
                  </Panel>

                  <Panel title="Cost by model" count={data.by_model.length}>
                    {data.by_model.length ? (
                      <div className="flex flex-col divide-y divide-ui-border-base">
                        {data.by_model.map((m) => (
                          <Bar
                            key={m.model}
                            label={m.model}
                            value={m.cost}
                            max={modelMax}
                            accent={ACCENTS.violet}
                            right={`${fmtUSD(m.cost)} · ${fmtInt(
                              m.tokens
                            )} tok`}
                          />
                        ))}
                      </div>
                    ) : (
                      <Text size="small" className="text-ui-fg-subtle">
                        No model data.
                      </Text>
                    )}
                  </Panel>
                </div>

                {/* Recent activity */}
                <Panel title="Recent AI activity" count={data.recent.length}>
                  {data.recent.length ? (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[640px] text-left text-sm">
                        <thead>
                          <tr className="text-ui-fg-muted">
                            <th className="pb-2 font-normal">Time</th>
                            <th className="pb-2 font-normal">Merchant</th>
                            <th className="pb-2 font-normal">Feature</th>
                            <th className="pb-2 font-normal">Model</th>
                            <th className="pb-2 text-right font-normal">Cost</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.recent.map((r, i) => (
                            <tr
                              key={i}
                              className="border-t border-ui-border-base"
                            >
                              <td className="py-2 pr-3 tabular-nums text-ui-fg-subtle">
                                {fmtTime(r.time)}
                              </td>
                              <td className="py-2 pr-3 text-ui-fg-base">
                                {r.merchant}
                              </td>
                              <td className="py-2 pr-3 text-ui-fg-subtle">
                                {titleize(r.feature)}
                              </td>
                              <td className="py-2 pr-3 text-ui-fg-subtle">
                                {r.model || "—"}
                              </td>
                              <td className="py-2 text-right tabular-nums text-ui-fg-base">
                                {fmtUSD(r.cost)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <Text size="small" className="text-ui-fg-subtle">
                      No recent activity.
                    </Text>
                  )}
                </Panel>
              </>
            )}
          </>
        )}
      </div>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "AI Usage",
  icon: CurrencyDollar,
})

export default AiUsagePage
