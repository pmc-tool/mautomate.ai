"use client"

import React, { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  BookOpen,
  ChatBubbleLeftRight,
  CheckCircleSolid,
  CircleWarningSolid,
  XMark,
} from "@medusajs/icons"
import { PageHeader } from "@components/merchant-admin/page-header"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  MobileAppBuildStatus,
  MobileAppConfig,
  MobileAppService,
  getMobileAppBuildStatus,
  getMobileAppConfig,
  getMobileAppService,
} from "@lib/merchant-admin/api"
import { cn } from "@lib/util/cn"
import { BrandingEditor } from "./components/branding-editor"
import { BuildStep, PublishStep } from "./components/get-your-app"

const SUPPORT_EMAIL = "support@mautomate.ai"

/**
 * The mobile-app page is a JOURNEY, not a brochure: three numbered steps a
 * merchant walks in order — design it, get it built (free), put it on the
 * stores — with a tracker on top that always answers "where is my app right
 * now and what do I do next". Every state shown is real: branding from the
 * saved config, build state from /build-request, publishing state from
 * /service.
 */

type StepState = "done" | "active" | "todo"

function deriveSteps(
  config: MobileAppConfig | null,
  build: MobileAppBuildStatus | null,
  service: MobileAppService | null
): { design: StepState; build: StepState; publish: StepState; subs: string[] } {
  const svcState = service?.service?.state ?? "none"
  const buildReady = !!build?.download_url
  const buildQueued =
    !buildReady &&
    !!build?.latest_status &&
    !["cancelled", "failed"].includes(build.latest_status)

  const published = svcState === "published"
  const teamWorking = svcState === "paid" || svcState === "in_progress"

  const design: StepState = config?.app_name ? "done" : "active"
  const buildState: StepState = buildReady
    ? "done"
    : buildQueued
      ? "active"
      : design === "done" && !teamWorking && !published
        ? "active"
        : "todo"
  const publish: StepState = published
    ? "done"
    : teamWorking || svcState === "awaiting_payment"
      ? "active"
      : buildReady
        ? "active"
        : "todo"

  const subs = [
    config?.app_name ? `"${config.app_name}"` : "Name your app",
    buildReady
      ? "Ready to download"
      : buildQueued
        ? "Preparing your app…"
        : teamWorking || published
          ? "Handled by our team"
          : "Free — one click",
    published
      ? "Live on the stores"
      : teamWorking
        ? "Our team is on it"
        : svcState === "awaiting_payment"
          ? "Checkout not finished"
          : "Yourself, or our team",
  ]

  return { design, build: buildState, publish, subs }
}

function TrackerNode({
  n,
  label,
  sub,
  state,
  selected,
  onSelect,
}: {
  n: number
  label: string
  sub: string
  state: StepState
  selected: boolean
  onSelect: () => void
}) {
  return (
    <li className="flex w-24 sm:w-44">
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected ? "step" : undefined}
        className={cn(
          "flex w-full flex-col items-center gap-1.5 rounded-base px-1 py-2 text-center transition-colors",
          selected ? "bg-grey-5" : "hover:bg-grey-5/60"
        )}
      >
        <span
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all",
            state === "done"
              ? "bg-emerald-500 text-white"
              : state === "active"
                ? "maap-pulse bg-brand-500 text-white"
                : "border border-grey-30 bg-white text-grey-40",
            selected && "ring-2 ring-brand-200 ring-offset-2"
          )}
        >
          {state === "done" ? (
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            n
          )}
        </span>
        <span
          className={cn(
            "text-sm font-semibold",
            state === "todo" && !selected ? "text-grey-40" : "text-grey-90"
          )}
        >
          {label}
        </span>
        <span
          className={cn(
            "text-xs",
            state === "active" ? "font-medium text-brand-600" : "text-grey-50"
          )}
        >
          {sub}
        </span>
      </button>
    </li>
  )
}

function WizardNav({
  onBack,
  backLabel,
  onNext,
  nextLabel,
}: {
  onBack?: () => void
  backLabel?: string
  onNext?: () => void
  nextLabel?: string
}) {
  return (
    <div className="mt-6 flex items-center justify-between border-t border-grey-10 pt-5">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-base border border-grey-20 bg-white px-4 py-2 text-sm font-medium text-grey-70 transition-colors hover:bg-grey-10"
        >
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M11 18l-6-6 6-6" />
          </svg>
          {backLabel}
        </button>
      ) : (
        <span />
      )}
      {onNext && (
        <button
          type="button"
          onClick={onNext}
          className="inline-flex items-center gap-1.5 rounded-base bg-grey-90 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-grey-80"
        >
          {nextLabel}
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      )}
    </div>
  )
}

function StepSection({
  n,
  title,
  lead,
  chip,
  children,
}: {
  n: number
  title: string
  lead: string
  chip?: { label: string; tone: "done" | "active" } | null
  children: React.ReactNode
}) {
  return (
    <section className="rounded-large border border-grey-20 bg-white p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-grey-40">
            Step {n} of 3
          </p>
          <h2 className="mt-0.5 text-base font-semibold text-grey-90">{title}</h2>
          <p className="mt-1 max-w-2xl text-sm text-grey-60">{lead}</p>
        </div>
        {chip && (
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-semibold",
              chip.tone === "done"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-brand-50 text-brand-600"
            )}
          >
            {chip.label}
          </span>
        )}
      </div>
      {children}
    </section>
  )
}

export default function MobileAppPage() {
  const { token } = useMerchantAuth()

  const [config, setConfig] = useState<MobileAppConfig | null>(null)
  const [service, setService] = useState<MobileAppService | null>(null)
  const [build, setBuild] = useState<MobileAppBuildStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [banner, setBanner] = useState<"success" | "cancel" | null>(null)
  // The wizard shows ONE step at a time. We land the merchant on the step
  // that needs them (once, when data first arrives) — after that the tracker
  // and Back/Continue own navigation.
  const [activeStep, setActiveStep] = useState(1)
  const autoLandedRef = React.useRef(false)

  useEffect(() => {
    const p =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("publish")
        : null
    if (p === "success") setBanner("success")
    else if (p === "cancel") setBanner("cancel")
  }, [])

  const refreshBuild = useCallback(async () => {
    if (!token) return
    const b = await getMobileAppBuildStatus(token).catch(() => null)
    if (b) setBuild(b)
  }, [token])

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    // Fetch independently so one missing/late backend route never blanks the
    // whole page — the UI degrades to sensible defaults instead of crashing.
    const [cfg, svc, bld] = await Promise.allSettled([
      getMobileAppConfig(token),
      getMobileAppService(token),
      getMobileAppBuildStatus(token),
    ])
    if (cfg.status === "fulfilled") setConfig(cfg.value)
    if (svc.status === "fulfilled") setService(svc.value)
    if (bld.status === "fulfilled") setBuild(bld.value)
    if (!autoLandedRef.current) {
      autoLandedRef.current = true
      const c = cfg.status === "fulfilled" ? cfg.value : null
      const b = bld.status === "fulfilled" ? bld.value : null
      const s = svc.status === "fulfilled" ? svc.value : null
      const st = deriveSteps(c, b, s)
      setActiveStep(
        st.design !== "done" ? 1 : st.build === "done" ? 3 : st.publish === "active" && st.build !== "active" ? 3 : 2
      )
    }
    setLoading(false)
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  const steps = deriveSteps(config, build, service)

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <style>{`
        .maap-pulse{ animation: maapPulse 1.9s ease-in-out infinite; }
        @keyframes maapPulse{
          0%,100%{ box-shadow: 0 0 0 0 rgba(242,101,34,0.35); }
          55%{ box-shadow: 0 0 0 7px rgba(242,101,34,0); }
        }
        @media (prefers-reduced-motion: reduce){ .maap-pulse{ animation: none; } }
      `}</style>

      <PageHeader
        title="Your mobile app"
        description="A real shopping app of your store, on your customers' phones. Three steps: design it, we build it free, then put it on the app stores."
      />

      {/* Stripe return banner */}
      {banner && (
        <div
          className={
            banner === "success"
              ? "mb-6 flex items-start justify-between gap-3 rounded-large border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
              : "mb-6 flex items-start justify-between gap-3 rounded-large border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          }
          role="status"
        >
          <div className="flex items-start gap-2.5">
            {banner === "success" ? (
              <CheckCircleSolid className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            ) : (
              <CircleWarningSolid className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            )}
            <div>
              {banner === "success" ? (
                <>
                  <p className="font-medium">Payment received — you&apos;re all set.</p>
                  <p className="mt-0.5 opacity-90">
                    Our team will start on your app and email you with the next steps.
                    You can keep editing your design below in the meantime.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-medium">Checkout cancelled.</p>
                  <p className="mt-0.5 opacity-90">
                    No charge was made. You can start again whenever you&apos;re ready.
                  </p>
                </>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setBanner(null)}
            aria-label="Dismiss"
            className="rounded p-1 hover:bg-black/5"
          >
            <XMark className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Where your app is right now */}
      <div className="mb-8 rounded-large border border-grey-20 bg-white px-4 py-3">
        <ol className="flex items-start justify-center">
          <TrackerNode
            n={1}
            label="Design"
            sub={steps.subs[0]}
            state={steps.design}
            selected={activeStep === 1}
            onSelect={() => setActiveStep(1)}
          />
          <span
            aria-hidden="true"
            className={cn(
              "mt-[22px] h-px flex-1",
              steps.design === "done" ? "bg-emerald-300" : "bg-grey-20"
            )}
          />
          <TrackerNode
            n={2}
            label="Build"
            sub={steps.subs[1]}
            state={steps.build}
            selected={activeStep === 2}
            onSelect={() => setActiveStep(2)}
          />
          <span
            aria-hidden="true"
            className={cn(
              "mt-[22px] h-px flex-1",
              steps.build === "done" ? "bg-emerald-300" : "bg-grey-20"
            )}
          />
          <TrackerNode
            n={3}
            label="Publish"
            sub={steps.subs[2]}
            state={steps.publish}
            selected={activeStep === 3}
            onSelect={() => setActiveStep(3)}
          />
        </ol>
      </div>

      <div className="space-y-6">
        {activeStep === 1 && (
          <StepSection
            n={1}
            title="Design your app"
            lead="We've already filled this in from your store — your name, logo and colour. Change anything you like; the phone shows exactly what customers will get."
            chip={config?.app_name ? { label: "Ready", tone: "done" } : null}
          >
            {loading ? (
              <div className="h-40 animate-pulse rounded-base bg-grey-10" />
            ) : token ? (
              <BrandingEditor token={token} config={config} onSaved={setConfig} />
            ) : (
              <p className="text-sm text-grey-50">Sign in to design your app.</p>
            )}
            <WizardNav
              onNext={() => setActiveStep(2)}
              nextLabel="Continue to Build"
            />
          </StepSection>
        )}

        {activeStep === 2 && (
          <StepSection
            n={2}
            title="Get your app built — free"
            lead="Happy with the design? Ask for your app and we prepare a real, installable Android app of your store. The download appears right here when it's ready."
            chip={
              build?.download_url
                ? { label: "Ready", tone: "done" }
                : build?.latest_status &&
                    !["cancelled", "failed"].includes(build.latest_status)
                  ? { label: "In progress", tone: "active" }
                  : null
            }
          >
            {token ? (
              <BuildStep token={token} build={build} onRefresh={refreshBuild} />
            ) : (
              <p className="text-sm text-grey-50">Sign in to request your build.</p>
            )}
            <WizardNav
              onBack={() => setActiveStep(1)}
              backLabel="Design"
              onNext={() => setActiveStep(3)}
              nextLabel="Continue to Publish"
            />
          </StepSection>
        )}

        {activeStep === 3 && (
          <StepSection
            n={3}
            title="Put it on the app stores"
            lead="Two ways to go live — pick whichever suits you."
          >
            {token ? (
              <PublishStep token={token} service={service} />
            ) : (
              <p className="text-sm text-grey-50">Sign in to publish your app.</p>
            )}
            <WizardNav onBack={() => setActiveStep(2)} backLabel="Build" />
          </StepSection>
        )}

        {/* Help */}
        <div className="flex flex-col gap-4 rounded-large border border-grey-20 bg-grey-5 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-grey-60">
            Stuck anywhere? We&apos;ll walk you through it.
          </p>
          <div className="flex shrink-0 flex-wrap gap-3">
            <Link
              href="/dashboard/mobile-app/guide"
              className="inline-flex items-center gap-2 rounded-base border border-grey-20 bg-white px-4 py-2 text-sm font-medium text-grey-90 transition-colors hover:bg-grey-10"
            >
              <BookOpen className="h-4 w-4" />
              Step-by-step guide
            </Link>
            <a
              href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
                "Help with my mobile app"
              )}`}
              className="inline-flex items-center gap-2 rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-grey-80"
            >
              <ChatBubbleLeftRight className="h-4 w-4" />
              Contact support
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
