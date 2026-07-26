"use client"

/**
 * Global upgrade/unlock modal (monetization plan P2).
 *
 * The shared API helper dispatches `mautomate:gate-denied` whenever the
 * backend rejects a request with an entitlement payload (code
 * "entitlement_locked" | "limit_reached"). Mounting this once in the
 * dashboard layout gives every surface the same upsell for free — no
 * per-page wiring.
 *
 * Routing: trial AI locks send the merchant to buy credits (the $5 unlock);
 * plan locks and capacity limits send them to the plans tab.
 */

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useMerchantAuth } from "@lib/merchant-admin/auth"

type GateDetail = {
  message?: string
  code?: "entitlement_locked" | "limit_reached"
  feature?: string | null
  limit?: string | null
  max?: number | null
  used?: number | null
  required_plan?: string
  required_plan_label?: string
}

/**
 * Trial countdown / grace strip, pinned above the dashboard content. Reads
 * the trial clock the backend computes on /merchant/me — nothing is decided
 * client-side.
 */
function TrialBanner() {
  const { me } = useMerchantAuth()
  const router = useRouter()
  const trial = me?.store?.trial
  if (!trial || trial.state === "paid") return null

  const isGrace = trial.state !== "trial"
  const text =
    trial.state === "trial"
      ? `Free trial - ${trial.days_left} day${trial.days_left === 1 ? "" : "s"} left. Pick a plan to keep your store live.`
      : trial.state === "grace"
        ? "Your trial has ended - your store goes offline soon. Pick a plan to keep it live."
        : "Your trial has ended and your store is paused. Pick a plan to bring it back."

  return (
    <div
      className={
        isGrace
          ? "sticky top-0 z-[200] flex items-center justify-center gap-3 bg-red-600 px-4 py-2 text-sm font-medium text-white"
          : "sticky top-0 z-[200] flex items-center justify-center gap-3 bg-grey-90 px-4 py-2 text-sm font-medium text-white"
      }
    >
      <span>{text}</span>
      <button
        type="button"
        onClick={() => router.push("/dashboard/billing?tab=plans")}
        className="rounded-base bg-white/15 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-white/25"
      >
        View plans
      </button>
    </div>
  )
}

export function GateDeniedWatcher() {
  const router = useRouter()
  const [detail, setDetail] = useState<GateDetail | null>(null)

  useEffect(() => {
    const onDenied = (e: Event) => {
      const d = (e as CustomEvent).detail as GateDetail
      if (d && (d.code === "entitlement_locked" || d.code === "limit_reached")) {
        setDetail(d)
      }
    }
    window.addEventListener("mautomate:gate-denied", onDenied)
    return () => window.removeEventListener("mautomate:gate-denied", onDenied)
  }, [])

  const close = useCallback(() => setDetail(null), [])

  if (!detail) return <TrialBanner />

  // The trial AI lock is a credits pitch, not a plan pitch.
  const isTrialAiLock =
    detail.feature === "ai_generation" &&
    (detail.message ?? "").toLowerCase().includes("credit")

  const title =
    detail.code === "limit_reached"
      ? "Plan limit reached"
      : isTrialAiLock
        ? "Unlock AI generation"
        : `This needs the ${detail.required_plan_label ?? "a bigger"} plan`

  const go = (tab: "plans" | "credits") => {
    close()
    router.push(`/dashboard/billing?tab=${tab}`)
  }

  return (
    <>
    <TrialBanner />
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={close}
    >
      <div
        className="w-full max-w-md rounded-large bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-grey-90">{title}</h2>
        <p className="mt-2 text-sm text-grey-60">
          {detail.message ?? "Your current plan does not include this."}
        </p>
        {detail.code === "limit_reached" &&
          detail.max != null &&
          detail.used != null && (
            <p className="mt-2 text-xs text-grey-50">
              Using {detail.used} of {detail.max} included in your plan.
            </p>
          )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={close}
            className="rounded-base border border-grey-20 px-4 py-2 text-sm font-medium text-grey-70 transition-colors hover:bg-grey-10"
          >
            Not now
          </button>
          {isTrialAiLock ? (
            <button
              type="button"
              onClick={() => go("credits")}
              className="rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-grey-80"
            >
              Buy AI credits
            </button>
          ) : (
            <button
              type="button"
              onClick={() => go("plans")}
              className="rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-grey-80"
            >
              View plans
            </button>
          )}
        </div>
      </div>
    </div>
    </>
  )
}
