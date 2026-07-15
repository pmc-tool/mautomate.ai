"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Sparkles } from "@medusajs/icons"

import { useMerchantAuth } from "@lib/merchant-admin/auth"
import { getBillingOverview } from "@lib/merchant-admin/api"
import { cn } from "@lib/util/cn"

/**
 * Always-visible credit meter (sidebar, above Log out). Merchants should never
 * be surprised by an empty wallet mid-task — the balance, the plan, and a
 * low-balance warning are one glance away on every dashboard page.
 * Refreshes once a minute; clicking through lands on Billing.
 */
export function CreditsBadge() {
  const { token } = useMerchantAuth()
  const [data, setData] = useState<{
    total: number
    expiring: number
    purchased: number
    next_expiry: string | null
    plan: string
    included: number
    used: number
  } | null>(null)

  useEffect(() => {
    if (!token) return
    let alive = true
    const load = async () => {
      try {
        const ov: any = await getBillingOverview(token)
        if (!alive) return
        setData({
          total: ov?.credits?.total ?? ov?.wallet?.balance ?? 0,
          expiring: ov?.credits?.expiring ?? 0,
          purchased: ov?.credits?.purchased ?? 0,
          next_expiry: ov?.credits?.next_expiry ?? null,
          plan: ov?.current_plan?.name ?? ov?.current_plan?.key ?? "Trial",
          included: ov?.allowance?.included ?? 0,
          used: ov?.allowance?.used_this_cycle ?? 0,
        })
      } catch {
        /* badge is decorative — never break the shell */
      }
    }
    load()
    const t = setInterval(load, 60_000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [token])

  if (!data) return null

  const low = data.total < 100
  const pct =
    data.included > 0 ? Math.min(100, Math.round((data.used / data.included) * 100)) : 0

  return (
    <Link
      href="/dashboard/billing"
      className={cn(
        "mb-3 block rounded-lg border p-3 transition-colors",
        low
          ? "border-amber-300 bg-amber-50 hover:bg-amber-100"
          : "border-grey-20 bg-grey-5 hover:bg-grey-10"
      )}
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-medium text-grey-50">
          <Sparkles className={cn("h-4 w-4", low ? "text-amber-500" : "text-grey-40")} />
          AI credits
        </span>
        <span className="rounded-full bg-grey-90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
          {String(data.plan).replace(/_/g, " ")}
        </span>
      </div>
      <div className={cn("mt-1 text-xl font-bold tabular-nums", low ? "text-amber-700" : "text-grey-90")}>
        {data.total.toLocaleString()}
      </div>
      {data.included > 0 && (
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-grey-20">
          <div
            className={cn("h-full rounded-full", pct >= 90 ? "bg-amber-500" : "bg-grey-90")}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      <div className="mt-1 text-[11px] text-grey-50">
        {low
          ? "Running low — tap to top up"
          : data.expiring > 0 && data.next_expiry
            ? `${data.expiring.toLocaleString()} expire ${new Date(data.next_expiry).toLocaleDateString()}`
            : `${data.purchased.toLocaleString()} purchased · never expire`}
      </div>
    </Link>
  )
}
