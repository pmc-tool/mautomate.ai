"use client"

import React, { useEffect, useState } from "react"
import {
  BuildingStorefront,
  CheckCircleSolid,
  GiftSolid,
  SquareTwoStack,
} from "@medusajs/icons"
import { PageHeader } from "@components/merchant-admin/page-header"
import { KpiCard } from "@components/merchant-admin/kpi-card"
import { SectionCard } from "@components/merchant-admin/section-card"
import { DataTable } from "@components/merchant-admin/data-table"
import { StatusBadge } from "@components/merchant-admin/status-badge"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import { ApiError } from "@lib/merchant-admin/api"
import {
  getMerchantReferrals,
  MerchantReferralRow,
  MerchantReferralsResponse,
} from "@lib/merchant-admin/referral-api"

export default function ReferralsPage() {
  const { token, logout } = useMerchantAuth()
  const [data, setData] = useState<MerchantReferralsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!token) return
    getMerchantReferrals(token)
      .then(setData)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) logout()
        else setError(err instanceof Error ? err.message : "Failed to load referrals")
      })
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const copyLink = async () => {
    if (!data?.link) return
    try {
      await navigator.clipboard.writeText(data.link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError("Could not copy — select and copy the link manually.")
    }
  }

  const bonus = data?.program.referee_bonus_credits ?? 200
  const reward = data?.program.referrer_reward_credits ?? 500

  const columns = [
    {
      key: "store_name",
      header: "Store",
      sortable: true,
      render: (r: MerchantReferralRow) => (
        <span className="font-medium text-grey-90">{r.store_name}</span>
      ),
    },
    {
      key: "referred_at",
      header: "Signed up",
      sortable: true,
      render: (r: MerchantReferralRow) => (
        <span className="text-grey-60">
          {new Date(r.referred_at).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (r: MerchantReferralRow) =>
        r.status === "rewarded" ? (
          <StatusBadge status="rewarded" />
        ) : (
          <StatusBadge status="pending" />
        ),
    },
    {
      key: "reward_credits",
      header: "Your reward",
      render: (r: MerchantReferralRow) => (
        <span
          className={
            r.status === "rewarded"
              ? "font-medium text-emerald-700"
              : "text-grey-50"
          }
        >
          {r.status === "rewarded"
            ? `+${r.reward_credits} credits`
            : `${reward} credits when they subscribe`}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Refer & earn"
        description={`Give ${bonus} credits, get ${reward} credits. Rewards are store credits for AI features and platform services — they never expire once earned.`}
      />

      {error && (
        <div className="rounded-base border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label="Stores referred"
          value={data ? String(data.stats.referred) : "—"}
          icon={BuildingStorefront}
        />
        <KpiCard
          label="Became paying stores"
          value={data ? String(data.stats.rewarded) : "—"}
          icon={CheckCircleSolid}
          tone="green"
        />
        <KpiCard
          label="Credits earned"
          value={data ? String(data.stats.credits_earned) : "—"}
          icon={GiftSolid}
          tone="brand"
          trend="Spendable on AI features and services"
        />
      </div>

      <SectionCard
        title="Your referral link"
        description="Share it anywhere. New stores that sign up through it are yours."
        icon={GiftSolid}
      >
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <code className="flex-1 overflow-x-auto rounded-base border border-grey-20 bg-grey-5 px-3 py-2 text-sm text-grey-90">
              {loading ? "Loading..." : data?.link || "—"}
            </code>
            <button
              onClick={copyLink}
              disabled={!data?.link}
              className="inline-flex shrink-0 items-center gap-2 rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-grey-80 disabled:opacity-50"
            >
              <SquareTwoStack className="h-4 w-4" />
              {copied ? "Copied!" : "Copy link"}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-base border border-grey-20 bg-grey-5 p-4">
              <p className="text-sm font-semibold text-grey-90">1. Share your link</p>
              <p className="mt-1 text-xs text-grey-60">
                Send it to friends who want to start selling online.
              </p>
            </div>
            <div className="rounded-base border border-grey-20 bg-grey-5 p-4">
              <p className="text-sm font-semibold text-grey-90">
                2. They get {bonus} credits
              </p>
              <p className="mt-1 text-xs text-grey-60">
                A welcome bonus lands in their new store the moment they sign up.
              </p>
            </div>
            <div className="rounded-base border border-grey-20 bg-grey-5 p-4">
              <p className="text-sm font-semibold text-grey-90">
                3. You get {reward} credits
              </p>
              <p className="mt-1 text-xs text-grey-60">
                Earned when their store makes its first payment — credits appear in
                your balance automatically.
              </p>
            </div>
          </div>
        </div>
      </SectionCard>

      <DataTable<MerchantReferralRow>
        columns={columns}
        rows={data?.referrals || []}
        searchKeys={["store_name"]}
        sortKeys={[
          { key: "store_name", label: "Store" },
          { key: "referred_at", label: "Signed up" },
        ]}
        emptyIcon={GiftSolid}
        emptyTitle="No referrals yet"
        emptyDescription="Share your link — stores that sign up through it appear here."
        isLoading={loading}
        pageSize={20}
      />
    </div>
  )
}
