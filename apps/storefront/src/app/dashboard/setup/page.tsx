"use client"

/**
 * /dashboard/setup — the shop setup wizard.
 *
 * A short, guided, RESUMABLE flow that walks a non-technical merchant through
 * everything a store needs before it can sell: business basics, brand, a real
 * product, delivery, and payments. Nothing here is a dead end — every step can
 * be skipped and every answer can be changed later. Progress is REAL: the ticks
 * come from GET /merchant/setup/status (verified against the store's actual
 * products / shipping / payment), never from "clicked Next", so the merchant is
 * never told they are done when they cannot yet take an order.
 *
 * Draft state (which step, what was answered) is persisted to the server on
 * every save, so leaving and coming back — even on another device — resumes
 * exactly where they left off.
 */

import React, { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  CheckCircleSolid,
  ArrowRight,
  ArrowUpRightOnBox,
  Buildings,
  ShoppingBag,
  TruckFast,
  CreditCard,
  Photo,
  Swatch,
  Eye,
  Spinner,
} from "@medusajs/icons"

import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  getSetup,
  patchSetup,
  setupDelivery,
  uploadSetupLogo,
  generateSetupLogos,
  removeDemoData,
  updateTenantCurrencies,
  listThemes,
  updateTheme,
  Theme,
  SetupSnapshot,
  SetupStatus,
  SetupTask,
} from "@lib/merchant-admin/api"
import { COUNTRY_NAMES } from "@lib/merchant-admin/tax-utils"
import { FormField, Input, Textarea, Select } from "@components/merchant-admin/form-field"
import { ImageUpload } from "@components/merchant-admin/image-upload"
import { Hint } from "@components/merchant-admin/hint"
import { cn } from "@lib/util/cn"

// ---------------------------------------------------------------------------

type StepKey =
  | "basics"
  | "brand"
  | "appearance"
  | "products"
  | "delivery"
  | "payments"
  | "review"

const STEPS: {
  key: StepKey
  title: string
  optional?: boolean
  icon: React.ComponentType<{ className?: string }>
}[] = [
  { key: "basics", title: "Business basics", icon: Buildings },
  { key: "brand", title: "Brand & logo", optional: true, icon: Photo },
  { key: "appearance", title: "Appearance", optional: true, icon: Swatch },
  { key: "products", title: "Products", icon: ShoppingBag },
  { key: "delivery", title: "Delivery", icon: TruckFast },
  { key: "payments", title: "Payments", icon: CreditCard },
  { key: "review", title: "Review & go live", icon: CheckCircleSolid },
]

const BUSINESS_TYPES = [
  { value: "individual", label: "Individual / sole trader" },
  { value: "company", label: "Registered company" },
]

// Kept in sync with the platform global store's supported currencies
// (see backend script seed-global-currencies.ts) so a pick always validates.
const CURRENCIES = [
  { code: "usd", label: "USD — US Dollar" },
  { code: "eur", label: "EUR — Euro" },
  { code: "gbp", label: "GBP — British Pound" },
  { code: "bdt", label: "BDT — Bangladeshi Taka" },
  { code: "inr", label: "INR — Indian Rupee" },
  { code: "pkr", label: "PKR — Pakistani Rupee" },
  { code: "aud", label: "AUD — Australian Dollar" },
  { code: "cad", label: "CAD — Canadian Dollar" },
  { code: "sgd", label: "SGD — Singapore Dollar" },
  { code: "aed", label: "AED — UAE Dirham" },
  { code: "myr", label: "MYR — Malaysian Ringgit" },
  { code: "jpy", label: "JPY — Japanese Yen" },
  { code: "cny", label: "CNY — Chinese Yuan" },
  { code: "zar", label: "ZAR — South African Rand" },
  { code: "ngn", label: "NGN — Nigerian Naira" },
  { code: "sar", label: "SAR — Saudi Riyal" },
]

const CATEGORIES = [
  "Apparel & fashion",
  "Jewellery & accessories",
  "Health & beauty",
  "Home & living",
  "Electronics",
  "Food & drink",
  "Handmade & crafts",
  "Sports & outdoors",
  "Digital products",
  "Other",
]

const COUNTRY_ENTRIES = Object.entries(COUNTRY_NAMES).sort((a, b) =>
  a[1].localeCompare(b[1])
)

type Data = SetupSnapshot & { status: SetupStatus }

// ---------------------------------------------------------------------------

export default function SetupWizardPage() {
  const { token } = useMerchantAuth()
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stepIdx, setStepIdx] = useState(0)

  const load = React.useCallback(async () => {
    if (!token) return
    const d = await getSetup(token)
    setData(d)
    return d
  }, [token])

  useEffect(() => {
    if (!token) return
    let alive = true
    setLoading(true)
    getSetup(token)
      .then((d) => {
        if (!alive) return
        setData(d)
        const resume = d.setup?.current_step as StepKey | undefined
        const idx = resume ? STEPS.findIndex((s) => s.key === resume) : 0
        setStepIdx(idx >= 0 ? idx : 0)
      })
      .catch((e) => alive && setError(e?.message || "Failed to load setup"))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [token])

  const step = STEPS[stepIdx]

  // Persist the current step to the draft so a reload resumes here.
  const persistStep = React.useCallback(
    async (
      key: StepKey,
      opts: { completed?: boolean; skipped?: boolean } = {}
    ) => {
      if (!token || !data) return
      const done = new Set(data.setup?.completed || [])
      const skip = new Set(data.setup?.skipped || [])
      if (opts.completed) {
        done.add(key)
        skip.delete(key)
      }
      if (opts.skipped) {
        skip.add(key)
        done.delete(key)
      }
      await patchSetup(token, {
        draft: {
          current_step: key,
          completed: Array.from(done),
          skipped: Array.from(skip),
          started_at: data.setup?.started_at || new Date().toISOString(),
        },
      })
    },
    [token, data]
  )

  const goTo = (idx: number) => {
    const clamped = Math.max(0, Math.min(STEPS.length - 1, idx))
    setStepIdx(clamped)
    const key = STEPS[clamped].key
    if (token) patchSetup(token, { draft: { current_step: key } }).catch(() => {})
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white text-sm text-grey-50">
        Loading your setup…
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white p-6">
        <div className="rounded-base border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error || "Setup is unavailable right now."}
        </div>
      </div>
    )
  }

  const status = data.status
  const pct = status.percent

  const requiredLeft = status.missing_required.length
  const stepDone = (key: StepKey) => (data.setup?.completed || []).includes(key)

  return (
    <div className="fixed inset-0 z-50 flex justify-center overflow-hidden bg-grey-5">
      {/* Cap + center the whole wizard so it doesn't sprawl (and the content
          doesn't float in a huge gap) on wide monitors. */}
      <div className="flex w-full max-w-[1360px] bg-white lg:border-x lg:border-grey-20">
      {/* ---- Left rail: vertical stepper ---- */}
      <aside className="hidden w-[288px] shrink-0 flex-col border-r border-grey-20 bg-grey-5 lg:flex">
        <div className="px-7 pb-6 pt-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-grey-40">
            Store setup
          </p>
          <h1 className="mt-1.5 text-xl font-semibold text-grey-90">Set up your shop</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-grey-50">
            A few short steps and you&apos;re ready to sell.
          </p>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 pb-4">
          <ol>
            {STEPS.map((s, i) => {
              const isDone = stepDone(s.key)
              const isActive = i === stepIdx
              const isLast = i === STEPS.length - 1
              return (
                <li key={s.key} className="relative">
                  {/* connector line */}
                  {!isLast && (
                    <span
                      className={cn(
                        "absolute left-[27px] top-9 h-[calc(100%-1.25rem)] w-px",
                        isDone ? "bg-emerald-300" : "bg-grey-20"
                      )}
                    />
                  )}
                  <button
                    onClick={() => goTo(i)}
                    className={cn(
                      "relative z-10 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition",
                      isActive ? "bg-white shadow-sm ring-1 ring-grey-20" : "hover:bg-white/70"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition",
                        isDone
                          ? "bg-emerald-500 text-white"
                          : isActive
                          ? "bg-grey-90 text-white"
                          : "border border-grey-30 bg-white text-grey-40"
                      )}
                    >
                      {isDone ? <CheckCircleSolid className="h-4 w-4" /> : i + 1}
                    </span>
                    <span className="min-w-0">
                      <span
                        className={cn(
                          "block truncate text-sm",
                          isActive
                            ? "font-semibold text-grey-90"
                            : isDone
                            ? "font-medium text-grey-70"
                            : "font-medium text-grey-60"
                        )}
                      >
                        {s.title}
                      </span>
                      {s.optional && (
                        <span className="text-[11px] text-grey-40">Optional</span>
                      )}
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        </nav>

        <div className="border-t border-grey-20 px-7 py-5">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-xs font-semibold text-grey-70">
              {status.ready_to_sell ? "Ready to sell" : `${pct}% complete`}
            </span>
            {!status.ready_to_sell && requiredLeft > 0 && (
              <span className="text-[11px] text-grey-40">
                {requiredLeft} required left
              </span>
            )}
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-grey-10">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                status.ready_to_sell ? "bg-emerald-500" : "bg-grey-90"
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
          <Link
            href="/dashboard/overview"
            className="mt-4 inline-block text-xs font-medium text-grey-50 transition hover:text-grey-80"
          >
            Save &amp; exit
          </Link>
        </div>
      </aside>

      {/* ---- Main content ---- */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile progress header (rail hidden < lg) */}
        <div className="flex items-center justify-between gap-3 border-b border-grey-20 px-5 py-3 lg:hidden">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-grey-90">
              {step.title}
              <span className="ml-2 text-xs font-normal text-grey-40">
                Step {stepIdx + 1} of {STEPS.length}
              </span>
            </p>
            <div className="mt-1.5 h-1 w-40 overflow-hidden rounded-full bg-grey-10">
              <div
                className={cn(
                  "h-full rounded-full",
                  status.ready_to_sell ? "bg-emerald-500" : "bg-grey-90"
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
          <Link
            href="/dashboard/overview"
            className="shrink-0 text-xs font-medium text-grey-50"
          >
            Exit
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div
            className={cn(
              "mx-auto w-full px-6 py-10 md:px-12 md:py-14",
              // The theme gallery needs room for its grid; forms read better narrow.
              step.key === "appearance" ? "max-w-4xl" : "max-w-2xl"
            )}
          >
            {/* Step header */}
            <div className="mb-7 flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-grey-90 text-white">
                <step.icon className="h-6 w-6" />
              </span>
              <div className="pt-0.5">
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-semibold tracking-tight text-grey-90">
                    {step.title}
                  </h2>
                  {step.optional && (
                    <span className="rounded-full bg-grey-10 px-2 py-0.5 text-[11px] font-medium text-grey-50">
                      Optional
                    </span>
                  )}
                </div>
              </div>
            </div>

            {step.key === "basics" && (
              <BasicsStep data={data} token={token!} onSaved={load} onNext={() => goTo(stepIdx + 1)} persistStep={persistStep} />
            )}
            {step.key === "brand" && (
              <BrandStep data={data} token={token!} onSaved={load} onNext={() => goTo(stepIdx + 1)} onSkip={() => { persistStep("brand", { skipped: true }); goTo(stepIdx + 1) }} persistStep={persistStep} />
            )}
            {step.key === "appearance" && (
              <AppearanceStep token={token!} onNext={() => { persistStep("appearance", { completed: true }); goTo(stepIdx + 1) }} onSkip={() => { persistStep("appearance", { skipped: true }); goTo(stepIdx + 1) }} />
            )}
            {step.key === "products" && (
              <ProductsStep data={data} onNext={() => goTo(stepIdx + 1)} onRefresh={load} persistStep={persistStep} />
            )}
            {step.key === "delivery" && (
              <DeliveryStep data={data} token={token!} onRefresh={load} onNext={() => goTo(stepIdx + 1)} persistStep={persistStep} />
            )}
            {step.key === "payments" && (
              <PaymentsStep data={data} onRefresh={load} onNext={() => goTo(stepIdx + 1)} persistStep={persistStep} />
            )}
            {step.key === "review" && (
              <ReviewStep data={data} token={token!} onRefresh={load} goTo={(k) => goTo(STEPS.findIndex((s) => s.key === k))} />
            )}
          </div>
        </div>
      </main>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

function StepFooter({
  onBack,
  onSkip,
  onNext,
  nextLabel = "Save & continue",
  saving,
  nextDisabled,
}: {
  onBack?: () => void
  onSkip?: () => void
  onNext: () => void
  nextLabel?: string
  saving?: boolean
  nextDisabled?: boolean
}) {
  return (
    <div className="mt-6 flex items-center justify-between border-t border-grey-10 pt-5">
      <div>
        {onBack && (
          <button
            onClick={onBack}
            className="rounded-lg px-3 py-2 text-sm font-medium text-grey-60 transition hover:bg-grey-10"
          >
            Back
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        {onSkip && (
          <button
            onClick={onSkip}
            className="rounded-lg px-3 py-2 text-sm font-medium text-grey-50 transition hover:bg-grey-10"
          >
            Skip for now
          </button>
        )}
        <button
          onClick={onNext}
          disabled={saving || nextDisabled}
          className="inline-flex items-center gap-1.5 rounded-lg bg-grey-90 px-4 py-2 text-sm font-semibold text-white transition hover:bg-grey-80 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Saving…" : nextLabel}
          {!saving && <ArrowRight className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )
}

function ErrorLine({ msg }: { msg: string | null }) {
  if (!msg) return null
  return (
    <p className="mt-3 rounded-base border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
      {msg}
    </p>
  )
}

type StepProps = {
  data: Data
  token: string
  onSaved: () => Promise<Data | undefined>
  onNext: () => void
  persistStep: (key: StepKey, opts?: { completed?: boolean; skipped?: boolean }) => Promise<void>
}

// ---------------------------------------------------------------------------
// Step: Business basics
// ---------------------------------------------------------------------------

function BasicsStep({ data, token, onSaved, onNext, persistStep }: StepProps) {
  const [name, setName] = useState(data.name || "")
  const [country, setCountry] = useState(data.default_country || data.status.store_country || "us")
  const [currency, setCurrency] = useState((data.currency_code || "usd").toLowerCase())
  const [bizType, setBizType] = useState(data.business?.type || "individual")
  const [category, setCategory] = useState(data.business?.category || "")
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const save = async () => {
    setErr(null)
    if (!name.trim()) return setErr("Give your store a name.")
    setSaving(true)
    try {
      // Currency change persists to the tenant's own region + meta. Do it first
      // so a currency error surfaces before we mark the step done.
      if (currency && currency !== (data.currency_code || "usd").toLowerCase()) {
        await updateTenantCurrencies(token, {
          currencies: [currency],
          default_currency: currency,
        })
      }
      await patchSetup(token, {
        name: name.trim(),
        default_country: country,
        business: { type: bizType, category },
      })
      await persistStep("basics", { completed: true })
      await onSaved()
      onNext()
    } catch (e: any) {
      setErr(e?.message || "Could not save.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-grey-50">
        The essentials. Your store country decides where you sell and is what
        makes delivery and checkout work.
      </p>
      <FormField label="Store name" htmlFor="s-name">
        <Input id="s-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Aurora Boutique" />
      </FormField>
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          label="Store country"
          htmlFor="s-country"
          hint="Where your business is based / sells."
          labelHint="This sets the country your storefront sells in. Delivery and checkout only work for shoppers in a country you cover, so getting this right unblocks everything downstream."
        >
          <Select id="s-country" value={country} onChange={(e) => setCountry(e.target.value)}>
            {COUNTRY_ENTRIES.map(([code, cname]) => (
              <option key={code} value={code}>
                {cname}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Currency" htmlFor="s-currency" hint="The currency your prices and checkout use.">
          <Select id="s-currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </Select>
        </FormField>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label="Business type" htmlFor="s-biz">
          <Select id="s-biz" value={bizType} onChange={(e) => setBizType(e.target.value)}>
            {BUSINESS_TYPES.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="What do you sell?" htmlFor="s-cat">
          <Select id="s-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Choose a category…</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </FormField>
      </div>
      <ErrorLine msg={err} />
      <StepFooter onNext={save} saving={saving} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step: Brand & logo
// ---------------------------------------------------------------------------

function BrandStep({
  data,
  token,
  onSaved,
  onNext,
  onSkip,
  persistStep,
}: StepProps & { onSkip: () => void }) {
  const [logoUrl, setLogoUrl] = useState<string | null>(data.logo_url)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [description, setDescription] = useState(data.business?.description || "")
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  // AI logo generation
  const [aiPrompt, setAiPrompt] = useState("")
  const [generating, setGenerating] = useState(false)
  const [aiLogos, setAiLogos] = useState<string[]>([])

  const onPickFile = async (f: File | null) => {
    setFile(f)
    if (!f) return
    setErr(null)
    setUploading(true)
    try {
      const { url } = await uploadSetupLogo(token, f)
      setLogoUrl(url)
      setFile(null)
    } catch (e: any) {
      setErr(e?.message || "Logo upload failed.")
    } finally {
      setUploading(false)
    }
  }

  const genLogos = async () => {
    setErr(null)
    setGenerating(true)
    setAiLogos([])
    try {
      const { logos } = await generateSetupLogos(token, {
        prompt: aiPrompt.trim() || undefined,
        count: 4,
      })
      setAiLogos(logos)
    } catch (e: any) {
      setErr(e?.message || "Could not generate a logo right now.")
    } finally {
      setGenerating(false)
    }
  }

  const pickAiLogo = async (url: string) => {
    setLogoUrl(url)
    setFile(null)
    try {
      await patchSetup(token, { logo_url: url })
    } catch {
      /* saved again on Continue */
    }
  }

  const save = async () => {
    setSaving(true)
    setErr(null)
    try {
      await patchSetup(token, { business: { description: description.trim() } })
      await persistStep("brand", { completed: true })
      await onSaved()
      onNext()
    } catch (e: any) {
      setErr(e?.message || "Could not save.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-grey-50">
        Make the store feel like yours. This is optional — you can add it any
        time.
      </p>
      <FormField label="Store logo" hint="PNG, JPG, SVG or WebP, up to 5MB.">
        <ImageUpload currentUrl={logoUrl} file={file} onChange={onPickFile} loading={uploading} />
      </FormField>

      {/* Generate with AI */}
      <div className="rounded-lg border border-grey-20 bg-grey-5 p-4">
        <div className="mb-2 flex items-center gap-1.5">
          <p className="text-sm font-semibold text-grey-90">No logo yet? Generate one</p>
          <Hint text="Uses AI credits. We create a couple of clean, transparent logo marks you can use as-is or replace later." />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder={`e.g. ${data.name || "your store"} — a modern ${
              data.business?.category?.toLowerCase() || "shop"
            }`}
          />
          <button
            onClick={genLogos}
            disabled={generating}
            className="shrink-0 rounded-lg bg-grey-90 px-4 py-2 text-sm font-semibold text-white transition hover:bg-grey-80 disabled:opacity-50"
          >
            {generating ? "Generating…" : "Generate logo"}
          </button>
        </div>
        {generating && (
          <p className="mt-2 text-xs text-grey-50">
            Designing your logo — this takes about 30 seconds.
          </p>
        )}
        {aiLogos.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-3">
            {aiLogos.map((url) => (
              <button
                key={url}
                onClick={() => pickAiLogo(url)}
                className={cn(
                  "h-24 w-24 overflow-hidden rounded-lg border-2 bg-white p-1 transition",
                  logoUrl === url ? "border-grey-90" : "border-grey-20 hover:border-grey-40"
                )}
                title="Use this logo"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="AI logo option" className="h-full w-full object-contain" />
              </button>
            ))}
          </div>
        )}
      </div>

      <FormField label="Short description" htmlFor="s-desc" hint="One or two lines about your store. Helps customers and search.">
        <Textarea
          id="s-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Handmade silver jewellery, shipped worldwide."
        />
      </FormField>
      <ErrorLine msg={err} />
      <StepFooter onSkip={onSkip} onNext={save} saving={saving} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step: Appearance (theme)
// ---------------------------------------------------------------------------

function AppearanceStep({
  token,
  onNext,
  onSkip,
}: {
  token: string
  onNext: () => void
  onSkip: () => void
}) {
  const { me } = useMerchantAuth()
  const [themes, setThemes] = useState<Theme[]>([])
  const [active, setActive] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    listThemes(token)
      .then((d) => {
        if (!alive) return
        setThemes(d.themes || [])
        setActive(d.active_theme || "")
      })
      .catch((e: any) => alive && setErr(e?.message || "Could not load themes."))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [token])

  const storeHost = () => {
    if (typeof window === "undefined") return ""
    const root = window.location.host.replace(/^merchant\./, "")
    return (
      me?.store?.domain ||
      (me?.store?.slug ? `${me.store.slug}.${root}` : window.location.host)
    )
  }

  // Preview shows the merchant's REAL content in the candidate theme — nothing
  // is published until they apply it.
  const preview = (id: string) =>
    window.open(
      `https://${storeHost()}/?preview_theme=${encodeURIComponent(id)}`,
      "_blank",
      "noopener"
    )

  const activate = async (id: string) => {
    if (id === active || saving) return
    setSaving(id)
    setErr(null)
    try {
      // A store in setup has no custom design to preserve — install fresh so the
      // theme's own layout renders (matches the Design page's default).
      await updateTheme(token, { active_theme: id, mode: "fresh" })
      setActive(id)
    } catch (e: any) {
      setErr(e?.message || "Could not apply this theme.")
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-grey-50">
        Pick the look of your store. Preview any theme with your own content —
        nothing publishes until you apply it — and you can fine-tune it in the
        editor any time.
      </p>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-grey-20">
              <div className="aspect-[4/3] animate-pulse bg-grey-10" />
              <div className="p-4">
                <div className="h-4 w-24 animate-pulse rounded bg-grey-10" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {themes.map((t) => {
            const isActive = t.id === active
            return (
              <div
                key={t.id}
                className={cn(
                  "group overflow-hidden rounded-xl border bg-white transition",
                  isActive
                    ? "border-grey-90 ring-1 ring-grey-90"
                    : "border-grey-20 hover:border-grey-30"
                )}
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-grey-10">
                  {t.preview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={t.preview}
                      alt={t.name}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-grey-40">
                      No preview
                    </div>
                  )}
                  {isActive && (
                    <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-grey-90 px-2 py-0.5 text-[10px] font-medium text-white">
                      <CheckCircleSolid className="h-3 w-3" />
                      Current
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-sm font-semibold text-grey-90">{t.name}</p>
                  {t.description && (
                    <p className="mt-0.5 line-clamp-2 text-xs text-grey-50">{t.description}</p>
                  )}
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => preview(t.id)}
                      className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-grey-20 px-2 py-1.5 text-xs font-medium text-grey-70 transition hover:bg-grey-10"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Preview
                    </button>
                    <button
                      onClick={() => activate(t.id)}
                      disabled={isActive || saving === t.id}
                      className={cn(
                        "inline-flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition",
                        isActive
                          ? "cursor-default bg-grey-10 text-grey-50"
                          : "bg-grey-90 text-white hover:bg-grey-80 disabled:opacity-50"
                      )}
                    >
                      {saving === t.id ? (
                        <>
                          <Spinner className="h-3.5 w-3.5 animate-spin" />
                          Applying
                        </>
                      ) : isActive ? (
                        "Current"
                      ) : (
                        "Use this"
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <ErrorLine msg={err} />

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-grey-10 pt-5">
        <Link
          href="/dashboard/design"
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-grey-60 transition hover:bg-grey-10"
        >
          <ArrowUpRightOnBox className="h-4 w-4" />
          Open full theme gallery
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={onSkip}
            className="rounded-lg px-3 py-2 text-sm font-medium text-grey-50 transition hover:bg-grey-10"
          >
            Skip for now
          </button>
          <button
            onClick={onNext}
            className="inline-flex items-center gap-1.5 rounded-lg bg-grey-90 px-4 py-2 text-sm font-semibold text-white transition hover:bg-grey-80"
          >
            Continue
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step: Products
// ---------------------------------------------------------------------------

function ProductsStep({
  data,
  onNext,
  onRefresh,
  persistStep,
}: {
  data: Data
  onNext: () => void
  onRefresh: () => Promise<Data | undefined>
  persistStep: StepProps["persistStep"]
}) {
  const [refreshing, setRefreshing] = useState(false)
  const hasProducts = data.status.products

  const recheck = async () => {
    setRefreshing(true)
    await onRefresh()
    setRefreshing(false)
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-grey-50">
        Your store needs at least one real product to sell. Your store already
        includes a sample product so it doesn&apos;t look empty — it isn&apos;t
        counted, so add your own when you&apos;re ready.
      </p>

      <div
        className={cn(
          "flex items-center gap-3 rounded-lg border px-4 py-3 text-sm",
          hasProducts
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-amber-200 bg-amber-50 text-amber-800"
        )}
      >
        {hasProducts ? (
          <>
            <CheckCircleSolid className="h-5 w-5" />
            You&apos;ve added a real product. Nice.
          </>
        ) : (
          <>
            <ShoppingBag className="h-5 w-5" />
            No real products yet — just the sample.
          </>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/dashboard/products/create"
          className="flex flex-col gap-1 rounded-lg border border-grey-20 p-4 transition hover:border-grey-90 hover:shadow-sm"
        >
          <span className="flex items-center gap-2 font-semibold text-grey-90">
            <ShoppingBag className="h-4 w-4" /> Add my own product
          </span>
          <span className="text-xs text-grey-50">
            Open the product editor — title, price, photos.
          </span>
        </Link>
        <Link
          href="/dashboard/products"
          className="flex flex-col gap-1 rounded-lg border border-grey-20 p-4 transition hover:border-grey-90 hover:shadow-sm"
        >
          <span className="flex items-center gap-2 font-semibold text-grey-90">
            <ArrowUpRightOnBox className="h-4 w-4" /> View my products
          </span>
          <span className="text-xs text-grey-50">
            See what&apos;s in your catalog, including the sample.
          </span>
        </Link>
      </div>

      <div className="flex items-center justify-between border-t border-grey-10 pt-5">
        <button
          onClick={recheck}
          className="rounded-lg px-3 py-2 text-sm font-medium text-grey-60 transition hover:bg-grey-10"
        >
          {refreshing ? "Checking…" : "I've added one — recheck"}
        </button>
        <button
          onClick={() => {
            persistStep("products", { completed: hasProducts, skipped: !hasProducts })
            onNext()
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-grey-90 px-4 py-2 text-sm font-semibold text-white transition hover:bg-grey-80"
        >
          Continue
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step: Delivery
// ---------------------------------------------------------------------------

function DeliveryStep({
  data,
  token,
  onRefresh,
  onNext,
  persistStep,
}: {
  data: Data
  token: string
  onRefresh: () => Promise<Data | undefined>
  onNext: () => void
  persistStep: StepProps["persistStep"]
}) {
  const storeCountry = data.default_country || data.status.store_country || "us"
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set([storeCountry, ...(data.status.shipping_countries || [])])
  )
  const [priceType, setPriceType] = useState<"free" | "flat">("free")
  const [amount, setAmount] = useState("")
  const [q, setQ] = useState("")
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState(data.status.shipping)

  const toggle = (code: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return COUNTRY_ENTRIES
    return COUNTRY_ENTRIES.filter(
      ([code, cname]) => cname.toLowerCase().includes(needle) || code.includes(needle)
    )
  }, [q])

  const storeCountryCovered = selected.has(storeCountry)

  const save = async () => {
    setErr(null)
    if (selected.size === 0) return setErr("Pick at least one country you deliver to.")
    if (!storeCountryCovered) {
      return setErr(
        `Include your store country (${storeCountry.toUpperCase()}) — shoppers there can't check out otherwise.`
      )
    }
    if (priceType === "flat" && (!amount || Number(amount) < 0)) {
      return setErr("Enter a delivery charge, or choose Free delivery.")
    }
    setSaving(true)
    try {
      await setupDelivery(token, {
        countries: Array.from(selected),
        price_type: priceType,
        amount: priceType === "flat" ? Number(amount) : 0,
      })
      await persistStep("delivery", { completed: true })
      const fresh = await onRefresh()
      setDone(fresh?.status.shipping ?? true)
      onNext()
    } catch (e: any) {
      setErr(e?.message || "Could not set up delivery.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-grey-50">
        Tell us where you deliver and what you charge. We&apos;ll create the
        delivery option so shoppers can check out.
      </p>

      {data.status.shipping ? (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <CheckCircleSolid className="h-5 w-5" />
          Delivery is set up for {(data.status.shipping_countries || []).map((c) => c.toUpperCase()).join(", ")}. You can add more below.
        </div>
      ) : null}

      <FormField label="Countries you deliver to">
        <div className="rounded-lg border border-grey-20">
          <div className="border-b border-grey-10 p-2">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search countries…"
            />
          </div>
          <div className="max-h-56 overflow-y-auto p-2">
            {filtered.map(([code, cname]) => (
              <label
                key={code}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-grey-10"
              >
                <input
                  type="checkbox"
                  checked={selected.has(code)}
                  onChange={() => toggle(code)}
                  className="h-4 w-4 rounded border-grey-30"
                />
                <span className="text-grey-80">{cname}</span>
                {code === storeCountry && (
                  <span className="ml-auto rounded-full bg-grey-90 px-2 py-0.5 text-[10px] font-medium text-white">
                    your country
                  </span>
                )}
              </label>
            ))}
          </div>
        </div>
      </FormField>

      {!storeCountryCovered && (
        <p className="text-xs text-amber-700">
          Tip: include {storeCountry.toUpperCase()} (your store country) so your
          own customers can order.
        </p>
      )}

      <FormField label="Delivery charge">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-grey-80">
            <input
              type="radio"
              checked={priceType === "free"}
              onChange={() => setPriceType("free")}
            />
            Free delivery
          </label>
          <label className="flex items-center gap-2 text-sm text-grey-80">
            <input
              type="radio"
              checked={priceType === "flat"}
              onChange={() => setPriceType("flat")}
            />
            Flat rate
          </label>
          {priceType === "flat" && (
            <div className="flex items-center gap-1">
              <span className="text-sm text-grey-50">{(data.currency_code || "usd").toUpperCase()}</span>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-28"
              />
            </div>
          )}
        </div>
      </FormField>

      <ErrorLine msg={err} />
      <StepFooter onNext={save} saving={saving} nextLabel="Save delivery & continue" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step: Payments
// ---------------------------------------------------------------------------

function PaymentsStep({
  data,
  onRefresh,
  onNext,
  persistStep,
}: {
  data: Data
  onRefresh: () => Promise<Data | undefined>
  onNext: () => void
  persistStep: StepProps["persistStep"]
}) {
  const [refreshing, setRefreshing] = useState(false)
  const hasPayment = data.status.payment

  const recheck = async () => {
    setRefreshing(true)
    await onRefresh()
    setRefreshing(false)
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-grey-50">
        Connect a way to get paid. Open payment settings, enable a method and
        add your keys — then come back and recheck.
      </p>

      <div
        className={cn(
          "flex items-center gap-3 rounded-lg border px-4 py-3 text-sm",
          hasPayment
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-amber-200 bg-amber-50 text-amber-800"
        )}
      >
        {hasPayment ? (
          <>
            <CheckCircleSolid className="h-5 w-5" />
            A payment method is enabled and ready.
          </>
        ) : (
          <>
            <CreditCard className="h-5 w-5" />
            No payment method enabled yet.
          </>
        )}
      </div>

      <Link
        href="/dashboard/settings"
        className="flex items-center justify-between rounded-lg border border-grey-20 p-4 transition hover:border-grey-90 hover:shadow-sm"
      >
        <span>
          <span className="flex items-center gap-2 font-semibold text-grey-90">
            <CreditCard className="h-4 w-4" /> Open payment settings
          </span>
          <span className="text-xs text-grey-50">Enable and configure a gateway.</span>
        </span>
        <ArrowUpRightOnBox className="h-4 w-4 text-grey-40" />
      </Link>

      <div className="flex items-center justify-between border-t border-grey-10 pt-5">
        <button
          onClick={recheck}
          className="rounded-lg px-3 py-2 text-sm font-medium text-grey-60 transition hover:bg-grey-10"
        >
          {refreshing ? "Checking…" : "I've enabled one — recheck"}
        </button>
        <button
          onClick={() => {
            persistStep("payments", { completed: hasPayment, skipped: !hasPayment })
            onNext()
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-grey-90 px-4 py-2 text-sm font-semibold text-white transition hover:bg-grey-80"
        >
          Continue
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step: Review & go live
// ---------------------------------------------------------------------------

function ReviewStep({
  data,
  token,
  onRefresh,
  goTo,
}: {
  data: Data
  token: string
  onRefresh: () => Promise<Data | undefined>
  goTo: (key: StepKey) => void
}) {
  const router = useRouter()
  const [finishing, setFinishing] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [removed, setRemoved] = useState<number | null>(null)
  const status = data.status
  const removeDemo = async () => {
    setRemoving(true)
    try {
      const { removed: n } = await removeDemoData(token)
      setRemoved(n)
      await onRefresh()
    } catch {
      setRemoved(null)
    } finally {
      setRemoving(false)
    }
  }
  // Tasks that map to a wizard step switch in-place; tasks that live on their own
  // dashboard page (domain) navigate there. `domain` is intentionally absent.
  const taskToStep: Partial<Record<string, StepKey>> = {
    store_country: "basics",
    business_details: "basics",
    logo: "brand",
    products: "products",
    shipping: "delivery",
    payment: "payments",
  }
  const onFix = (t: SetupTask) => {
    const step = taskToStep[t.key]
    if (step) goTo(step)
    else router.push(t.cta_href)
  }

  const finish = async () => {
    setFinishing(true)
    try {
      await patchSetup(token, {
        draft: { completed_at: new Date().toISOString(), current_step: "review" },
      })
      await onRefresh()
    } finally {
      setFinishing(false)
    }
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-grey-50">
        {status.ready_to_sell
          ? "Everything required is done — your store can take orders."
          : "Here's what's left before your store can take an order."}
      </p>

      <ul className="divide-y divide-grey-10 rounded-lg border border-grey-20">
        {status.tasks.map((t: SetupTask) => (
          <li key={t.key} className="flex items-start gap-3 px-4 py-3">
            <span
              className={cn(
                "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px]",
                t.done ? "bg-emerald-500 text-white" : t.required ? "bg-amber-100 text-amber-700" : "bg-grey-10 text-grey-40"
              )}
            >
              {t.done ? "✓" : "!"}
            </span>
            <div className="min-w-0 flex-1">
              <p className={cn("text-sm font-medium", t.done ? "text-grey-50 line-through" : "text-grey-90")}>
                {t.label}
                {!t.required && <span className="ml-1.5 text-xs font-normal text-grey-40">optional</span>}
              </p>
              {!t.done && t.blocker_detail && (
                <p className="text-xs text-amber-700">{t.blocker_detail}</p>
              )}
              {!t.done && !t.blocker_detail && (
                <p className="text-xs text-grey-50">{t.why}</p>
              )}
            </div>
            {!t.done && (
              <button
                onClick={() => onFix(t)}
                className="shrink-0 rounded-lg border border-grey-20 px-2.5 py-1 text-xs font-medium text-grey-70 transition hover:bg-grey-10"
              >
                Fix
              </button>
            )}
          </li>
        ))}
      </ul>

      {/* Remove the placeholder sample product once they've added their own. */}
      <div className="flex items-center justify-between gap-3 rounded-lg border border-grey-20 bg-grey-5 px-4 py-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-medium text-grey-80">
            Remove demo data
            <Hint text="Deletes the sample product your store was created with. Do this once you've added your own products." />
          </p>
          <p className="text-xs text-grey-50">Clear the placeholder sample product.</p>
        </div>
        <button
          onClick={removeDemo}
          disabled={removing || removed !== null}
          className="shrink-0 rounded-lg border border-grey-20 bg-white px-3 py-1.5 text-sm font-medium text-grey-70 transition hover:bg-grey-10 disabled:opacity-60"
        >
          {removing
            ? "Removing…"
            : removed !== null
            ? removed > 0
              ? `Removed ${removed}`
              : "Nothing to remove"
            : "Remove demo data"}
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-grey-10 pt-5">
        <Link
          href="/dashboard/overview"
          className="rounded-lg px-3 py-2 text-sm font-medium text-grey-60 transition hover:bg-grey-10"
        >
          Finish later
        </Link>
        {status.ready_to_sell ? (
          <button
            onClick={finish}
            disabled={finishing}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
          >
            {finishing ? "Saving…" : "Start selling"}
            <CheckCircleSolid className="h-4 w-4" />
          </button>
        ) : (
          <span className="text-xs text-grey-50">
            Finish the required steps above to start selling.
          </span>
        )}
      </div>
    </div>
  )
}
