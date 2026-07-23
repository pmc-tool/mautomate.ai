"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import {
  BuildingStorefront,
  ChartBar,
  CheckCircleSolid,
  CurrencyDollar,
  SquareTwoStack,
} from "@medusajs/icons"
import { PageHeader } from "@components/merchant-admin/page-header"
import { KpiCard } from "@components/merchant-admin/kpi-card"
import { SectionCard } from "@components/merchant-admin/section-card"
import { StatusBadge } from "@components/merchant-admin/status-badge"
import { usePartnerAuth } from "@lib/partner/auth"
import {
  listPartnerCommissions,
  PartnerApiError,
  PartnerCommission,
  usd,
} from "@lib/partner/api"

const SOURCE_LABEL: Record<string, string> = {
  subscription: "New subscription",
  renewal: "Plan renewal",
  topup: "Credit top-up",
  manual: "Adjustment",
}

export default function PartnerOverviewPage() {
  const { token, me, logout, refreshMe } = usePartnerAuth()
  const [recent, setRecent] = useState<PartnerCommission[]>([])
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    refreshMe().catch(() => undefined)
    listPartnerCommissions(token)
      .then((res) => setRecent((res.commissions || []).slice(0, 8)))
      .catch((err) => {
        if (err instanceof PartnerApiError && err.status === 401) logout()
        else setError(err instanceof Error ? err.message : "Failed to load earnings")
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const copyLink = async () => {
    if (!me?.referral_link) return
    try {
      await navigator.clipboard.writeText(me.referral_link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError("Could not copy — select and copy the link manually.")
    }
  }

  const stats = me?.stats

  return (
    <div className="space-y-6">
      <PageHeader
        title={me ? `Welcome back, ${me.partner.name.split(" ")[0]}` : "Overview"}
        description="Your partner program at a glance."
      />

      {error && (
        <div className="rounded-base border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Referred stores"
          value={stats ? String(stats.referred_stores) : "—"}
          icon={BuildingStorefront}
        />
        <KpiCard
          label="Active stores"
          value={stats ? String(stats.active_stores) : "—"}
          icon={CheckCircleSolid}
          tone="green"
        />
        <KpiCard
          label="Open balance"
          value={stats ? usd(stats.pending_cents) : "—"}
          icon={CurrencyDollar}
          tone="brand"
          trend="Commission not yet paid out"
        />
        <KpiCard
          label="Paid out"
          value={stats ? usd(stats.paid_cents) : "—"}
          icon={ChartBar}
          trend={stats ? `Lifetime ${usd(stats.lifetime_cents)}` : undefined}
        />
      </div>

      <SectionCard
        title="Your referral link"
        description={`Every store that signs up through this link is attributed to you. You earn ${
          me?.partner.commission_pct ?? 0
        }% of their plan payments and credit purchases.`}
      >
        {me?.referral_link ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <code className="flex-1 overflow-x-auto rounded-base border border-grey-20 bg-grey-5 px-3 py-2 text-sm text-grey-90">
              {me.referral_link}
            </code>
            <button
              onClick={copyLink}
              className="inline-flex shrink-0 items-center gap-2 rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-grey-80"
            >
              <SquareTwoStack className="h-4 w-4" />
              {copied ? "Copied!" : "Copy link"}
            </button>
          </div>
        ) : (
          <p className="text-sm text-grey-50">
            No referral code is set on your account yet — contact us to get one.
          </p>
        )}
      </SectionCard>

      <SectionCard
        title="Recent earnings"
        action={
          <Link
            href="/partners/earnings"
            className="text-sm font-medium text-grey-60 hover:text-grey-90"
          >
            View all
          </Link>
        }
      >
        {recent.length === 0 ? (
          <p className="text-sm text-grey-50">
            No commissions yet — they appear here when your referred stores pay for a
            plan or buy credits.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-grey-50">
                <tr>
                  <th className="py-2 pr-4 font-medium">Date</th>
                  <th className="py-2 pr-4 font-medium">Store</th>
                  <th className="py-2 pr-4 font-medium">Type</th>
                  <th className="py-2 pr-4 font-medium">Commission</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-grey-10">
                {recent.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2.5 pr-4 text-grey-60">
                      {new Date(c.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-2.5 pr-4 font-medium text-grey-90">{c.store}</td>
                    <td className="py-2.5 pr-4 text-grey-60">
                      {SOURCE_LABEL[c.source] ?? c.source}
                    </td>
                    <td className="py-2.5 pr-4 font-medium text-grey-90">
                      {usd(c.amount_cents)}
                    </td>
                    <td className="py-2.5">
                      <StatusBadge
                        status={c.status === "pending" && c.payout_id ? "processing" : c.status}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  )
}
