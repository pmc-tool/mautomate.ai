"use client"

import { useCallback, useEffect, useState } from "react"
import { ArrowPath, CurrencyDollar, ChartBar, ReceiptPercent } from "@medusajs/icons"

import { useControlAuth } from "@/lib/auth"
import { getMargin, type MarginResponse } from "@/lib/api/margin"
import { KpiCard } from "@/components/kpi-card"
import { PageHeader } from "@/components/page-header"
import { cn } from "@/lib/utils"

const usd = (n: number) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(n || 0)

const LABELS: Record<string, string> = {
  ai_call_minute: "AI calls (web)",
  ai_call_phone_minute: "AI calls (phone)",
  phone_number_month: "Phone number rental",
  sms_segment: "SMS",
  ai_text: "AI text & chatbot",
  ai_page_edit: "AI page edits",
  ai_content: "AI content & blogs",
  ai_image: "AI images",
  ai_logo: "AI logos",
  ai_image_basic: "AI images (basic)",
  email_batch: "Emails",
  email: "Emails",
  domain_purchase_usd: "Domains",
  social_publish: "Social publishing",
}

const WINDOWS = [7, 30, 90] as const

export default function MarginPage() {
  const { token } = useControlAuth()
  const [data, setData] = useState<MarginResponse | null>(null)
  const [days, setDays] = useState<number>(30)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      setData(await getMargin(token, { days }))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load margin")
    } finally {
      setLoading(false)
    }
  }, [token, days])

  useEffect(() => {
    load()
  }, [load])

  const rows = data?.by_action ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Margin & P&L"
        description="Real gross margin per action — computed from delivered usage, not a forecast."
        action={
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-grey-20 p-0.5">
              {WINDOWS.map((w) => (
                <button
                  key={w}
                  onClick={() => setDays(w)}
                  className={cn(
                    "rounded-md px-3 py-1 text-sm font-medium transition",
                    days === w ? "bg-grey-90 text-white" : "text-grey-60 hover:bg-grey-10"
                  )}
                >
                  {w}d
                </button>
              ))}
            </div>
            <button
              onClick={load}
              className="inline-flex items-center gap-1.5 rounded-lg border border-grey-20 px-3 py-1.5 text-sm text-grey-60 hover:bg-grey-10"
            >
              <ArrowPath className="h-4 w-4" /> Refresh
            </button>
          </div>
        }
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="MRR (subscriptions)"
          value={loading ? "—" : usd(data?.revenue.mrr_usd ?? 0)}
          icon={CurrencyDollar}
          tone="brand"
        />
        <KpiCard
          label={`Usage delivered (${days}d)`}
          value={loading ? "—" : usd(data?.revenue.usage_delivered_usd ?? 0)}
          icon={ChartBar}
        />
        <KpiCard
          label={`Vendor cost (${days}d)`}
          value={loading ? "—" : usd(data?.cogs.vendor_usd ?? 0)}
          icon={ReceiptPercent}
          tone="grey"
        />
        <KpiCard
          label="Gross margin"
          value={
            loading
              ? "—"
              : data?.gross.margin_pct != null
                ? `${data.gross.margin_pct}%`
                : "—"
          }
          icon={ChartBar}
          tone="green"
        />
      </div>

      {/* Per-action P&L — the table that answers "where does the money come from" */}
      <div className="rounded-xl border border-grey-20 bg-white">
        <div className="border-b border-grey-10 px-5 py-4">
          <h3 className="text-base font-semibold text-grey-90">Margin by feature</h3>
          <p className="text-sm text-grey-50">
            What we charged vs what the vendor billed us, for every metered action.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-grey-5 text-grey-50">
              <tr className="text-left">
                <th className="px-5 py-2 font-medium">Feature</th>
                <th className="px-3 py-2 text-right font-medium">Uses</th>
                <th className="px-3 py-2 text-right font-medium">Credits</th>
                <th className="px-3 py-2 text-right font-medium">Revenue</th>
                <th className="px-3 py-2 text-right font-medium">Vendor cost</th>
                <th className="px-3 py-2 text-right font-medium">Profit</th>
                <th className="px-3 py-2 text-right font-medium">Multiple</th>
                <th className="px-5 py-2 text-right font-medium">Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-grey-10">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-grey-50">
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-grey-50">
                    No metered usage in this window yet.
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const thin = (r.margin_pct ?? 100) < 50
                  return (
                    <tr key={r.action}>
                      <td className="px-5 py-2.5 font-medium text-grey-90">
                        {LABELS[r.action] ?? r.action}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-grey-60">
                        {r.events.toLocaleString()}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-grey-60">
                        {r.credits.toLocaleString()}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-grey-90">
                        {usd(r.revenue_usd)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-grey-60">
                        {usd(r.cost_usd)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-medium text-green-700">
                        {usd(r.profit_usd)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-grey-60">
                        {r.multiple != null ? `${r.multiple}x` : "—"}
                      </td>
                      <td className="px-5 py-2.5 text-right">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-semibold",
                            r.margin_pct == null
                              ? "bg-grey-10 text-grey-50"
                              : thin
                                ? "bg-amber-100 text-amber-700"
                                : "bg-green-100 text-green-700"
                          )}
                        >
                          {r.margin_pct != null ? `${r.margin_pct}%` : "—"}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MRR by plan */}
      <div className="rounded-xl border border-grey-20 bg-white">
        <div className="border-b border-grey-10 px-5 py-4">
          <h3 className="text-base font-semibold text-grey-90">Subscriptions by plan</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-grey-5 text-grey-50">
              <tr className="text-left">
                <th className="px-5 py-2 font-medium">Plan</th>
                <th className="px-3 py-2 text-right font-medium">Tenants</th>
                <th className="px-5 py-2 text-right font-medium">MRR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-grey-10">
              {(data?.by_plan ?? []).map((p) => (
                <tr key={p.plan}>
                  <td className="px-5 py-2.5 font-medium capitalize text-grey-90">
                    {p.plan.replace(/_/g, " ")}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-grey-60">
                    {p.tenants}
                  </td>
                  <td className="px-5 py-2.5 text-right tabular-nums font-medium text-grey-90">
                    {usd(p.mrr_usd)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
