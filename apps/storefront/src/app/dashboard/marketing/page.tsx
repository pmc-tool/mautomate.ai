"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import {
  RocketLaunch,
  DocumentText,
  Calendar,
  Envelope,
  ChatBubbleLeftRight,
  Hashtag,
  Sparkles,
  ArrowRightOnRectangle,
  Globe,
} from "@medusajs/icons"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  getMarketingSummary,
  MarketingSummary,
  ApiError,
} from "@lib/merchant-admin/api"
import { PageHeader } from "@components/merchant-admin/page-header"
import { KpiCard } from "@components/merchant-admin/kpi-card"
import { cn } from "@lib/util/cn"

const quickLinks = [
  { href: "/dashboard/marketing/connect", label: "Social accounts", icon: Globe },
  { href: "/dashboard/marketing/posts", label: "Posts", icon: DocumentText },
  { href: "/dashboard/marketing/journeys", label: "Journeys", icon: Sparkles },
  { href: "/dashboard/marketing/campaigns", label: "Campaigns", icon: Hashtag },
  { href: "/dashboard/marketing/email", label: "Email templates", icon: Envelope },
  { href: "/dashboard/marketing/chatbots", label: "Chatbots", icon: ChatBubbleLeftRight },
]

export default function MarketingPage() {
  const { token } = useMerchantAuth()
  const [summary, setSummary] = useState<MarketingSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    getMarketingSummary(token)
      .then(setSummary)
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Failed to load marketing summary")
      })
      .finally(() => setLoading(false))
  }, [token])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marketing"
        description="Manage posts, journeys, campaigns, email templates, and chatbots for your store."
      />

      <Link
        href="/dashboard/marketing/connect"
        className={cn(
          "flex items-center justify-between gap-4 rounded-large border border-grey-20 bg-white p-5 shadow-borders-base",
          "transition-colors hover:border-grey-40 hover:bg-grey-5"
        )}
      >
        <div className="flex items-center gap-4">
          <div className="rounded-large bg-cyan-50 p-3 text-cyan-700">
            <Globe className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-semibold text-grey-90">Connect accounts</h3>
            <p className="mt-0.5 text-sm text-grey-50">
              Link Facebook, Instagram, X, LinkedIn, or Telegram to publish from your store.
            </p>
          </div>
        </div>
        <ArrowRightOnRectangle className="h-5 w-5 shrink-0 text-grey-50" />
      </Link>

      {error && (
        <div className="rounded-base border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          label="Total posts"
          value={loading ? "—" : summary?.posts.total ?? 0}
          icon={DocumentText}
          tone="brand"
        />
        <KpiCard
          label="Scheduled (next 7 days)"
          value={loading ? "—" : summary?.scheduled_next_7d ?? 0}
          icon={Calendar}
          tone="green"
        />
        <KpiCard
          label="Brand voices"
          value={loading ? "—" : summary?.brand_voice_count ?? 0}
          icon={RocketLaunch}
        />
        <KpiCard
          label="Connected accounts"
          value={loading ? "—" : summary?.connected_accounts_count ?? 0}
          icon={Hashtag}
          tone="green"
        />
        <KpiCard
          label="Recent conversations"
          value={loading ? "—" : summary?.recent_conversations_count ?? 0}
          icon={ChatBubbleLeftRight}
        />
      </div>

      {summary && summary.posts.total > 0 && (
        <div className="rounded-large border border-grey-20 bg-white p-5 shadow-borders-base">
          <h3 className="mb-4 font-semibold text-grey-90">Posts by status</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(summary.posts.by_status).map(([status, count]) => (
              <span
                key={status}
                className="inline-flex items-center gap-2 rounded-base border border-grey-20 bg-grey-5 px-3 py-1.5 text-sm text-grey-70"
              >
                <span className="capitalize">{status.replace(/_/g, " ")}</span>
                <span className="font-medium text-grey-90">{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-large border border-grey-20 bg-white p-5 shadow-borders-base">
        <h3 className="mb-4 font-semibold text-grey-90">Marketing channels</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {quickLinks.map((item) => (
            <QuickLink key={item.href} {...item} />
          ))}
        </div>
      </div>
    </div>
  )
}

function QuickLink({
  href,
  label,
  icon: Icon,
}: {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center justify-between rounded-base border border-grey-20 bg-white p-4",
        "transition-colors hover:border-grey-40 hover:bg-grey-5"
      )}
    >
      <div className="flex items-center gap-3">
        <div className="rounded-base bg-cyan-50 p-2 text-cyan-700">
          <Icon className="h-5 w-5" />
        </div>
        <span className="font-medium text-grey-90">{label}</span>
      </div>
      <ArrowRightOnRectangle className="h-4 w-4 text-grey-50" />
    </Link>
  )
}
