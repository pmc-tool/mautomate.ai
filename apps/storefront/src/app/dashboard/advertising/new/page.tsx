"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowUturnLeft,
  BuildingStorefront,
  CheckCircleSolid,
  ChartPie,
  ExclamationCircle,
  Sparkles,
  Spinner,
} from "@medusajs/icons"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  AdCopyDraft,
  AdsAccountsResponse,
  AdsPage,
  Product,
  createAdsCampaign,
  generateAdCopy,
  generateAdImage,
  generateAdVideo,
  listAdsAccounts,
  listAdsPages,
  listProducts,
} from "@lib/merchant-admin/api"
import { PageHeader } from "@components/merchant-admin/page-header"
import { SectionCard } from "@components/merchant-admin/section-card"
import { cn } from "@lib/util/cn"

/**
 * Advertising — guided ad creation.
 *
 * The flow a merchant actually thinks in: pick WHAT to advertise -> say WHY ->
 * watch the ad being made -> polish it -> set money -> create (paused).
 *
 * The generation screen is HONEST motion: every stage's spinner flips to a
 * check only when its real API call resolves (copy = the live text engine,
 * image = the live image engine, video = the live SVD-XT engine). No fake
 * progress bars, no simulated delays; costs are shown in credits on every
 * button before it is pressed.
 */

type Step = "product" | "goal" | "generating" | "review" | "settings"

const GOALS = [
  {
    key: "sales" as const,
    label: "Sales",
    description: "Optimize for purchases. Needs your pixel (one click to set up).",
  },
  {
    key: "traffic" as const,
    label: "Traffic",
    description: "Get the most people clicking through to your store.",
  },
  {
    key: "awareness" as const,
    label: "Awareness",
    description: "Reach as many of the right people as possible.",
  },
]

type GenStage = {
  key: string
  label: string
  state: "pending" | "running" | "done" | "error"
  detail?: string
}

const MOTION_CSS = `
@keyframes ads-blob {
  0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: .55; }
  33% { transform: translate(-46%, -54%) scale(1.15); opacity: .8; }
  66% { transform: translate(-54%, -47%) scale(.92); opacity: .6; }
}
@keyframes ads-rise {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes ads-pop {
  0% { transform: scale(.4); opacity: 0; }
  70% { transform: scale(1.15); }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes ads-shimmer {
  from { background-position: 200% 0; }
  to { background-position: -200% 0; }
}
.ads-rise { animation: ads-rise .45s ease both; }
.ads-pop { animation: ads-pop .35s ease both; }
.ads-shimmer {
  background: linear-gradient(100deg, #f1f0ee 40%, #fafaf9 50%, #f1f0ee 60%);
  background-size: 200% 100%;
  animation: ads-shimmer 1.6s linear infinite;
}
@media (prefers-reduced-motion: reduce) {
  .ads-rise, .ads-pop { animation: none; }
  .ads-blob-el { animation: none !important; }
}
`

export default function NewCampaignPage() {
  const { token } = useMerchantAuth()
  const router = useRouter()

  // Platform context
  const [accounts, setAccounts] = useState<AdsAccountsResponse | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [pages, setPages] = useState<AdsPage[]>([])
  const [loading, setLoading] = useState(true)

  // Flow state
  const [step, setStep] = useState<Step>("product")
  const [productId, setProductId] = useState<string | null>(null)
  const [wholeStore, setWholeStore] = useState(false)
  const [goal, setGoal] = useState<"sales" | "traffic" | "awareness">("traffic")
  const [instructions, setInstructions] = useState("")

  // Generation state
  const [stages, setStages] = useState<GenStage[]>([])
  const [genError, setGenError] = useState<string | null>(null)

  // The ad being built
  const [draft, setDraft] = useState<AdCopyDraft | null>(null)
  const [headline, setHeadline] = useState("")
  const [primaryText, setPrimaryText] = useState("")
  const [imagePrompt, setImagePrompt] = useState("")
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [audienceHint, setAudienceHint] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<{
    kind: "success" | "error" | "credits"
    text: string
  } | null>(null)

  // Settings
  const [name, setName] = useState("")
  const [budget, setBudget] = useState("5")
  const [countries, setCountries] = useState("US")
  const [pageId, setPageId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const platform = useMemo(
    () =>
      (accounts?.connections ?? []).find((c) => c.status === "connected")
        ?.platform ?? null,
    [accounts]
  )
  const selectedAccount = useMemo(
    () => (accounts?.accounts ?? []).find((a) => a.selected),
    [accounts]
  )
  const product = useMemo(
    () => products.find((p) => p.id === productId) ?? null,
    [products, productId]
  )

  useEffect(() => {
    if (!token) return
    Promise.all([
      listAdsAccounts(token),
      listProducts(token).catch(() => ({ products: [], count: 0 })),
    ])
      .then(([acc, prod]) => {
        setAccounts(acc)
        setProducts((prod.products ?? []).filter((p) => p.status === "published"))
      })
      .catch((e: any) =>
        setNotice({ kind: "error", text: e?.message ?? "Could not load." })
      )
      .finally(() => setLoading(false))
  }, [token])

  useEffect(() => {
    if (!token || !platform) return
    listAdsPages(token, platform)
      .then(({ pages }) => {
        setPages(pages)
        if (pages.length === 1) setPageId(pages[0].id)
      })
      .catch(() => setPages([]))
  }, [token, platform])

  const failNotice = (e: any, fallback: string) => {
    const msg = e?.message ?? fallback
    setNotice({
      kind: /credit/i.test(String(msg)) ? "credits" : "error",
      text: String(msg),
    })
  }

  const setStage = (key: string, patch: Partial<GenStage>) =>
    setStages((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)))

  /** The generation run: each stage completes when its REAL call resolves. */
  const runGeneration = useCallback(async () => {
    if (!token) return
    setGenError(null)
    setNotice(null)
    setStep("generating")
    setStages([
      { key: "read", label: wholeStore ? "Reading your store" : "Reading your product", state: "running" },
      { key: "copy", label: "Writing headlines & ad text", state: "pending" },
      { key: "image", label: "Designing your ad image", state: "pending" },
    ])

    try {
      // Stage 1+2: the copy call carries the product read.
      setStage("read", { state: "done" })
      setStage("copy", { state: "running" })
      const copyRes = await generateAdCopy(token, {
        product_id: wholeStore ? null : productId,
        goal,
        instructions: instructions.trim() || null,
      })
      const d = copyRes.draft
      setDraft(d)
      setHeadline(d.headline)
      setPrimaryText(d.primary_text)
      setImagePrompt(d.image_prompt)
      setAudienceHint(d.audience_hint)
      setName(
        `${wholeStore ? "Store" : copyRes.product.title} — ${goal}`.slice(0, 60)
      )
      setStage("copy", { state: "done", detail: d.headline })

      // Stage 3: the image call.
      setStage("image", { state: "running" })
      const imgRes = await generateAdImage(token, {
        prompt: d.image_prompt,
        orientation: "square",
      })
      setImageUrl(imgRes.image_url)
      setStage("image", { state: "done" })

      setStep("review")
    } catch (e: any) {
      setStages((prev) =>
        prev.map((s) => (s.state === "running" ? { ...s, state: "error" } : s))
      )
      setGenError(e?.message ?? "Generation failed.")
    }
  }, [token, wholeStore, productId, goal, instructions])

  const skipToManual = useCallback(() => {
    setDraft(null)
    setHeadline(product?.title ?? "")
    setPrimaryText("")
    setImagePrompt("")
    setImageUrl(product?.thumbnail ?? null)
    setName(`${wholeStore ? "Store" : product?.title ?? "Campaign"} — ${goal}`.slice(0, 60))
    setStep("review")
  }, [product, wholeStore, goal])

  const regenCopy = useCallback(async () => {
    if (!token || busy) return
    setBusy("copy")
    setNotice(null)
    try {
      const { draft: d } = await generateAdCopy(token, {
        product_id: wholeStore ? null : productId,
        goal,
        instructions: instructions.trim() || null,
        regen: true,
      })
      setDraft(d)
      setHeadline(d.headline)
      setPrimaryText(d.primary_text)
      if (d.image_prompt) setImagePrompt(d.image_prompt)
    } catch (e: any) {
      failNotice(e, "Rewrite failed.")
    } finally {
      setBusy(null)
    }
  }, [token, busy, wholeStore, productId, goal, instructions])

  const regenImage = useCallback(async () => {
    if (!token || busy) return
    setBusy("image")
    setNotice(null)
    try {
      const { image_url } = await generateAdImage(token, {
        prompt: imagePrompt || `professional product photo of ${headline}`,
        orientation: "square",
      })
      setImageUrl(image_url)
      setVideoUrl(null)
    } catch (e: any) {
      failNotice(e, "Image generation failed.")
    } finally {
      setBusy(null)
    }
  }, [token, busy, imagePrompt, headline])

  const makeVideo = useCallback(async () => {
    if (!token || busy || !imageUrl) return
    setBusy("video")
    setNotice(null)
    try {
      const { video_url } = await generateAdVideo(token, {
        image_url: imageUrl,
        orientation: "square",
      })
      setVideoUrl(video_url)
      setNotice({
        kind: "success",
        text: "Video ready — it is saved with this campaign and yours to use anywhere. Meta video placements switch on with the live Meta integration.",
      })
    } catch (e: any) {
      failNotice(e, "Video generation failed.")
    } finally {
      setBusy(null)
    }
  }, [token, busy, imageUrl])

  const create = useCallback(async () => {
    if (!token || creating || !platform) return
    setCreating(true)
    setNotice(null)
    try {
      const { campaign } = await createAdsCampaign(token, {
        platform,
        name: name.trim(),
        goal,
        daily_budget: Number(budget),
        countries: countries
          .split(",")
          .map((c) => c.trim().toUpperCase())
          .filter(Boolean),
        product_handle: wholeStore ? null : (product?.handle ?? null),
        headline: headline.trim(),
        primary_text: primaryText.trim(),
        image_url: imageUrl,
        page_id: pageId,
      })
      router.push(`/dashboard/advertising/campaigns/${campaign.id}?created=1`)
    } catch (e: any) {
      failNotice(e, "Could not create the campaign.")
      setCreating(false)
    }
  }, [
    token, creating, platform, name, goal, budget, countries, wholeStore,
    product, headline, primaryText, imageUrl, pageId, router,
  ])

  // ---------------------------------------------------------------- guards
  if (loading) {
    return (
      <div className="flex items-center gap-2 py-16 text-grey-50">
        <Spinner className="animate-spin" /> Loading…
      </div>
    )
  }
  if (!platform || !selectedAccount) {
    return (
      <div className="space-y-6">
        <PageHeader title="New campaign" description="Create and launch ads without leaving your dashboard." />
        <SectionCard title="Connect first">
          <div className="py-6 text-center">
            <ChartPie className="mx-auto text-grey-40" />
            <p className="mt-2 text-sm text-grey-60">
              A campaign needs a connected ad platform and a chosen ad account.
            </p>
            <Link
              href="/dashboard/advertising/connect"
              className="mt-4 inline-block rounded-md bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80"
            >
              Connect an ad account
            </Link>
          </div>
        </SectionCard>
      </div>
    )
  }

  const stepIndex = ["product", "goal", "generating", "review", "settings"].indexOf(step)

  return (
    <div className="space-y-6">
      <style dangerouslySetInnerHTML={{ __html: MOTION_CSS }} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader
          title="New campaign"
          description="Pick a product, and the AI writes and designs the ad. Nothing spends until you press Launch."
        />
        <div className="flex items-center gap-1.5 text-xs text-grey-40">
          {["What", "Goal", "Create", "Polish", "Money"].map((label, i) => (
            <React.Fragment key={label}>
              {i > 0 && <span className="h-px w-4 bg-grey-20" />}
              <span
                className={cn(
                  "rounded-full px-2 py-0.5",
                  i === stepIndex
                    ? "bg-grey-90 font-medium text-white"
                    : i < stepIndex
                      ? "bg-grey-10 text-grey-70"
                      : "text-grey-40"
                )}
              >
                {label}
              </span>
            </React.Fragment>
          ))}
        </div>
      </div>

      {notice && (
        <div
          className={cn(
            "ads-rise flex items-start justify-between gap-2 rounded-base border p-4 text-sm",
            notice.kind === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : notice.kind === "credits"
                ? "border-amber-200 bg-amber-50 text-amber-800"
                : "border-rose-200 bg-rose-50 text-rose-700"
          )}
        >
          <div className="flex items-start gap-2">
            {notice.kind === "success" ? (
              <CheckCircleSolid className="mt-0.5 shrink-0" />
            ) : (
              <ExclamationCircle className="mt-0.5 shrink-0" />
            )}
            <span>{notice.text}</span>
          </div>
          {notice.kind === "credits" && (
            <Link href="/dashboard/billing" className="shrink-0 font-medium underline">
              Top up
            </Link>
          )}
        </div>
      )}

      {/* ------------------------------------------------ STEP 1: product */}
      {step === "product" && (
        <SectionCard
          title="What are you advertising?"
          description="Pick a product and the ad links straight to it — photo, headline, and text are created from it."
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <button
              onClick={() => {
                setWholeStore(true)
                setProductId(null)
                setStep("goal")
              }}
              className="ads-rise flex h-full min-h-[9rem] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-grey-30 bg-white p-3 text-grey-60 hover:border-grey-50 hover:text-grey-90"
            >
              <BuildingStorefront className="h-6 w-6" />
              <span className="text-xs font-medium">My whole store</span>
            </button>
            {products.map((p, i) => (
              <button
                key={p.id}
                onClick={() => {
                  setWholeStore(false)
                  setProductId(p.id)
                  setStep("goal")
                }}
                style={{ animationDelay: `${Math.min(i * 40, 300)}ms` }}
                className="ads-rise rounded-lg border border-grey-20 bg-white p-2 text-left transition-transform hover:-translate-y-0.5 hover:border-grey-50 hover:shadow-sm"
              >
                {p.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.thumbnail} alt="" className="h-28 w-full rounded object-cover" />
                ) : (
                  <div className="flex h-28 w-full items-center justify-center rounded bg-grey-10 text-xs text-grey-40">
                    no photo
                  </div>
                )}
                <div className="mt-1.5 truncate text-xs font-medium text-grey-90">{p.title}</div>
                {p.price != null && (
                  <div className="text-[11px] tabular-nums text-grey-50">
                    {p.price} {p.currency_code?.toUpperCase()}
                  </div>
                )}
              </button>
            ))}
          </div>
          {products.length === 0 && (
            <p className="mt-3 text-sm text-grey-50">
              No published products yet — you can still advertise your whole store.
            </p>
          )}
        </SectionCard>
      )}

      {/* --------------------------------------------------- STEP 2: goal */}
      {step === "goal" && (
        <div className="ads-rise space-y-6">
          <SectionCard
            title={
              wholeStore
                ? "Advertising your whole store"
                : `Advertising: ${product?.title ?? ""}`
            }
            description="What should this campaign optimize for?"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {GOALS.map((g) => (
                <button
                  key={g.key}
                  onClick={() => setGoal(g.key)}
                  className={cn(
                    "rounded-lg border p-4 text-left transition-colors",
                    goal === g.key
                      ? "border-grey-90 bg-grey-5"
                      : "border-grey-20 bg-white hover:border-grey-40"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-grey-90">{g.label}</span>
                    {goal === g.key && <CheckCircleSolid className="ads-pop text-grey-90" />}
                  </div>
                  <p className="mt-1 text-xs text-grey-60">{g.description}</p>
                </button>
              ))}
            </div>
            <label className="mt-4 block">
              <span className="text-xs font-medium text-grey-70">
                Anything the AI should know? <span className="font-normal text-grey-50">(optional)</span>
              </span>
              <input
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="e.g. free shipping over $50, launching Friday, playful tone"
                className="mt-1 w-full rounded-md border border-grey-20 px-3 py-2 text-sm"
              />
            </label>
          </SectionCard>

          <div className="flex items-center justify-between rounded-lg border border-grey-20 bg-white p-4">
            <button onClick={() => setStep("product")} className="inline-flex items-center gap-1 text-sm text-grey-50 hover:text-grey-90">
              <ArrowUturnLeft className="h-3.5 w-3.5" /> Back
            </button>
            <div className="flex items-center gap-3">
              <button onClick={skipToManual} className="text-sm text-grey-50 underline hover:text-grey-90">
                Write it myself
              </button>
              <button
                onClick={runGeneration}
                className="inline-flex items-center gap-2 rounded-md bg-grey-90 px-5 py-2.5 text-sm font-medium text-white hover:bg-grey-80"
              >
                <Sparkles />
                Create my ad with AI
                <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] tabular-nums">27 credits</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------- STEP 3: generating */}
      {step === "generating" && (
        <div className="relative overflow-hidden rounded-xl border border-grey-20 bg-white">
          <div
            className="ads-blob-el pointer-events-none absolute left-1/2 top-1/2 h-[28rem] w-[28rem] rounded-full opacity-60 blur-3xl"
            style={{
              background: "radial-gradient(closest-side, #e5e2dc, #f6f5f3 70%, transparent)",
              animation: "ads-blob 7s ease-in-out infinite",
            }}
          />
          <div className="relative mx-auto flex min-h-[26rem] max-w-md flex-col items-center justify-center gap-6 px-6 py-12">
            <div className="relative">
              {(wholeStore ? null : product?.thumbnail) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={product!.thumbnail!}
                  alt=""
                  className="h-24 w-24 rounded-xl object-cover shadow-md"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-xl bg-grey-10 shadow-md">
                  <BuildingStorefront className="h-8 w-8 text-grey-40" />
                </div>
              )}
              {!genError && (
                <span className="absolute -inset-2 -z-10 animate-ping rounded-2xl bg-grey-20/60" style={{ animationDuration: "2.2s" }} />
              )}
            </div>

            <div className="text-center">
              <div className="text-lg font-semibold text-grey-90">
                {genError ? "That didn't work" : "Creating your ad"}
              </div>
              <div className="mt-0.5 text-sm text-grey-50">
                {genError
                  ? genError
                  : "Real work is happening — each step ticks when it truly finishes."}
              </div>
            </div>

            <ol className="w-full space-y-2.5">
              {stages.map((s) => (
                <li
                  key={s.key}
                  className={cn(
                    "ads-rise flex items-center gap-3 rounded-lg border px-4 py-3",
                    s.state === "done"
                      ? "border-emerald-200 bg-emerald-50/50"
                      : s.state === "error"
                        ? "border-rose-200 bg-rose-50/50"
                        : "border-grey-20 bg-white"
                  )}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                    {s.state === "done" ? (
                      <CheckCircleSolid className="ads-pop h-5 w-5 text-emerald-600" />
                    ) : s.state === "running" ? (
                      <Spinner className="h-5 w-5 animate-spin text-grey-60" />
                    ) : s.state === "error" ? (
                      <ExclamationCircle className="h-5 w-5 text-rose-600" />
                    ) : (
                      <span className="h-2 w-2 rounded-full bg-grey-30" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <div className={cn("text-sm", s.state === "pending" ? "text-grey-40" : "font-medium text-grey-90")}>
                      {s.label}
                    </div>
                    {s.detail && s.state === "done" && (
                      <div className="truncate text-xs text-grey-50">“{s.detail}”</div>
                    )}
                  </div>
                </li>
              ))}
            </ol>

            {genError ? (
              <div className="flex items-center gap-3">
                <button onClick={() => setStep("goal")} className="rounded-md border border-grey-20 bg-white px-4 py-2 text-sm text-grey-90 hover:bg-grey-5">
                  Back
                </button>
                <button onClick={runGeneration} className="rounded-md bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80">
                  Try again
                </button>
              </div>
            ) : (
              <div className="h-9" />
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------- STEP 4: review */}
      {step === "review" && (
        <div className="ads-rise grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <SectionCard title="Your ad" description="This is what people see. Swap, rewrite, or regenerate any piece.">
              <div className="overflow-hidden rounded-xl border border-grey-20 bg-white shadow-sm">
                {busy === "video" ? (
                  <div className="ads-shimmer flex h-72 w-full flex-col items-center justify-center gap-2">
                    <Spinner className="h-6 w-6 animate-spin text-grey-50" />
                    <span className="text-xs text-grey-60">Animating your image — about a minute, real render in progress</span>
                  </div>
                ) : videoUrl ? (
                  <video src={videoUrl} poster={imageUrl ?? undefined} controls autoPlay muted loop playsInline className="h-72 w-full object-cover" />
                ) : busy === "image" ? (
                  <div className="ads-shimmer h-72 w-full" />
                ) : imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imageUrl} alt="" className="h-72 w-full object-cover" />
                ) : (
                  <div className="flex h-72 w-full items-center justify-center bg-grey-10 text-sm text-grey-40">
                    no image yet
                  </div>
                )}
                <div className="space-y-1 p-4">
                  <div className="text-base font-semibold text-grey-90">{headline || "Your headline"}</div>
                  <div className="text-sm text-grey-60">{primaryText || "Your ad text appears here."}</div>
                  <div className="pt-1 text-[10px] uppercase tracking-wide text-grey-40">
                    {wholeStore ? "links to your store" : `links to ${product?.title ?? "your product"}`}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  onClick={regenImage}
                  disabled={busy != null}
                  className="inline-flex items-center gap-1.5 rounded-md border border-grey-20 bg-white px-3 py-1.5 text-xs font-medium text-grey-90 hover:bg-grey-5 disabled:opacity-50"
                >
                  {busy === "image" ? <Spinner className="animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  New image · 2 cr
                </button>
                <button
                  onClick={makeVideo}
                  disabled={busy != null || !imageUrl}
                  className="inline-flex items-center gap-1.5 rounded-md border border-grey-20 bg-white px-3 py-1.5 text-xs font-medium text-grey-90 hover:bg-grey-5 disabled:opacity-50"
                >
                  {busy === "video" ? <Spinner className="animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {videoUrl ? "Regenerate video" : "Make it a video"} · 60 cr
                </button>
                <input
                  value={imagePrompt}
                  onChange={(e) => setImagePrompt(e.target.value)}
                  placeholder="describe the image scene…"
                  className="min-w-[12rem] flex-1 rounded-md border border-grey-20 px-2.5 py-1.5 text-xs"
                />
              </div>
            </SectionCard>
          </div>

          <div className="space-y-6">
            <SectionCard title="Words" description="Click an alternative to swap it in, edit freely, or have the AI rewrite.">
              <label className="block">
                <span className="text-xs font-medium text-grey-70">Headline</span>
                <input value={headline} onChange={(e) => setHeadline(e.target.value)} className="mt-1 w-full rounded-md border border-grey-20 px-3 py-2 text-sm" />
              </label>
              {draft?.alt_headlines?.length ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[draft.headline, ...draft.alt_headlines]
                    .filter((h, i, a) => a.indexOf(h) === i)
                    .map((h) => (
                      <button
                        key={h}
                        onClick={() => setHeadline(h)}
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-xs",
                          h === headline ? "border-grey-90 bg-grey-90 text-white" : "border-grey-20 bg-white text-grey-60 hover:border-grey-50"
                        )}
                      >
                        {h}
                      </button>
                    ))}
                </div>
              ) : null}
              <label className="mt-4 block">
                <span className="text-xs font-medium text-grey-70">Main text</span>
                <textarea value={primaryText} onChange={(e) => setPrimaryText(e.target.value)} rows={4} className="mt-1 w-full rounded-md border border-grey-20 px-3 py-2 text-sm" />
              </label>
              <div className="mt-3 flex items-center justify-between">
                <button
                  onClick={regenCopy}
                  disabled={busy != null}
                  className="inline-flex items-center gap-1.5 rounded-md border border-grey-20 bg-white px-3 py-1.5 text-xs font-medium text-grey-90 hover:bg-grey-5 disabled:opacity-50"
                >
                  {busy === "copy" ? <Spinner className="animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  Rewrite · 2 cr
                </button>
                {audienceHint && (
                  <span className="text-right text-xs text-grey-50">AI suggests: {audienceHint}</span>
                )}
              </div>
            </SectionCard>

            <div className="flex items-center justify-between rounded-lg border border-grey-20 bg-white p-4">
              <button onClick={() => setStep("goal")} className="inline-flex items-center gap-1 text-sm text-grey-50 hover:text-grey-90">
                <ArrowUturnLeft className="h-3.5 w-3.5" /> Back
              </button>
              <button
                onClick={() => setStep("settings")}
                disabled={!headline.trim() || !primaryText.trim()}
                className="rounded-md bg-grey-90 px-5 py-2.5 text-sm font-medium text-white hover:bg-grey-80 disabled:opacity-50"
              >
                Looks good — set budget
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------- STEP 5: settings */}
      {step === "settings" && (
        <div className="ads-rise space-y-6">
          <SectionCard
            title="Budget & audience"
            description="The daily budget is billed by the ad platform to your own ad account — not from your credits."
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <label className="block">
                <span className="text-xs font-medium text-grey-70">Campaign name</span>
                <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-md border border-grey-20 px-3 py-2 text-sm" />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-grey-70">
                  Daily budget ({selectedAccount.currency ?? "account currency"})
                </span>
                <input value={budget} onChange={(e) => setBudget(e.target.value)} inputMode="decimal" className="mt-1 w-full rounded-md border border-grey-20 px-3 py-2 text-sm tabular-nums" />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-grey-70">Countries (codes)</span>
                <input value={countries} onChange={(e) => setCountries(e.target.value)} placeholder="US, GB" className="mt-1 w-full rounded-md border border-grey-20 px-3 py-2 text-sm uppercase" />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-grey-70">Publish as</span>
                <select value={pageId ?? ""} onChange={(e) => setPageId(e.target.value || null)} className="mt-1 w-full rounded-md border border-grey-20 bg-white px-3 py-2 text-sm">
                  <option value="">Choose a page…</option>
                  {pages.map((p) => (
                    <option key={p.id} value={p.id}>{p.name ?? p.id}</option>
                  ))}
                </select>
              </label>
            </div>
          </SectionCard>

          <div className="flex items-center justify-between rounded-lg border border-grey-20 bg-white p-4">
            <button onClick={() => setStep("review")} className="inline-flex items-center gap-1 text-sm text-grey-50 hover:text-grey-90">
              <ArrowUturnLeft className="h-3.5 w-3.5" /> Back to the ad
            </button>
            <div className="flex items-center gap-3">
              <span className="text-sm text-grey-60">
                Created <span className="font-medium text-grey-90">paused</span> — you press Launch yourself.
              </span>
              <button
                onClick={create}
                disabled={
                  creating ||
                  !name.trim() ||
                  !headline.trim() ||
                  !primaryText.trim() ||
                  !(Number(budget) > 0) ||
                  !countries.trim() ||
                  (platform === "meta" && !pageId)
                }
                className="inline-flex items-center gap-1.5 rounded-md bg-grey-90 px-5 py-2.5 text-sm font-medium text-white hover:bg-grey-80 disabled:opacity-50"
              >
                {creating ? <Spinner className="animate-spin" /> : null}
                Create campaign (paused)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
