"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  ChartPie,
  CheckCircleSolid,
  ExclamationCircle,
  Spinner,
} from "@medusajs/icons"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  AdsAccountsResponse,
  AdsPage,
  Product,
  createAdsCampaign,
  listAdsAccounts,
  listAdsPages,
  listProducts,
} from "@lib/merchant-admin/api"
import { PageHeader } from "@components/merchant-admin/page-header"
import { SectionCard } from "@components/merchant-admin/section-card"
import { cn } from "@lib/util/cn"

/**
 * Advertising — New campaign. One guided form: goal, what to promote (a real
 * product or the whole store), the ad itself, budget and audience, then an
 * honest review. Creating NEVER starts spending — the campaign lands PAUSED
 * and is launched from its own page with a separate click.
 */

const GOALS = [
  {
    key: "sales" as const,
    label: "Sales",
    description:
      "Optimize for purchases. Needs your pixel (one click on the Ad accounts page).",
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

export default function NewCampaignPage() {
  const { token } = useMerchantAuth()
  const router = useRouter()

  const [accounts, setAccounts] = useState<AdsAccountsResponse | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [pages, setPages] = useState<AdsPage[]>([])
  const [pagesError, setPagesError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [goal, setGoal] = useState<"sales" | "traffic" | "awareness">("traffic")
  const [productId, setProductId] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [headline, setHeadline] = useState("")
  const [primaryText, setPrimaryText] = useState("")
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [budget, setBudget] = useState("5")
  const [countries, setCountries] = useState("US")
  const [pageId, setPageId] = useState<string | null>(null)

  const platform = useMemo(() => {
    const connected = (accounts?.connections ?? []).find(
      (c) => c.status === "connected"
    )
    return connected?.platform ?? null
  }, [accounts])

  const selectedAccount = useMemo(
    () => (accounts?.accounts ?? []).find((a) => a.selected),
    [accounts]
  )

  useEffect(() => {
    if (!token) return
    Promise.all([
      listAdsAccounts(token),
      listProducts(token).catch(() => ({ products: [], count: 0 })),
    ])
      .then(([acc, prod]) => {
        setAccounts(acc)
        setProducts(
          (prod.products ?? []).filter((p) => p.status === "published")
        )
      })
      .catch((e: any) =>
        setError(e?.message ?? "Could not load your ad accounts.")
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
      .catch((e: any) =>
        setPagesError(e?.message ?? "Could not load your pages.")
      )
  }, [token, platform])

  const product = useMemo(
    () => products.find((p) => p.id === productId) ?? null,
    [products, productId]
  )

  const pickProduct = useCallback(
    (p: Product) => {
      setProductId(p.id)
      if (!name) setName(`${p.title} — ${goal}`)
      if (!headline) setHeadline(p.title)
      setImageUrl(p.thumbnail ?? null)
    },
    [name, headline, goal]
  )

  const create = useCallback(async () => {
    if (!token || creating || !platform) return
    setCreating(true)
    setError(null)
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
        product_handle: product?.handle ?? null,
        headline: headline.trim(),
        primary_text: primaryText.trim(),
        image_url: imageUrl,
        page_id: pageId,
      })
      router.push(`/dashboard/advertising/campaigns/${campaign.id}?created=1`)
    } catch (e: any) {
      setError(e?.message ?? "Could not create the campaign.")
      setCreating(false)
    }
  }, [
    token,
    creating,
    platform,
    name,
    goal,
    budget,
    countries,
    product,
    headline,
    primaryText,
    imageUrl,
    pageId,
    router,
  ])

  const ready =
    Boolean(platform) &&
    Boolean(selectedAccount) &&
    name.trim().length > 0 &&
    headline.trim().length > 0 &&
    primaryText.trim().length > 0 &&
    Number(budget) > 0 &&
    countries.trim().length > 0 &&
    (platform !== "meta" || Boolean(pageId))

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
        <PageHeader
          title="New campaign"
          description="Create and launch ads without leaving your dashboard."
        />
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="New campaign"
        description="Fill this in and the campaign is created PAUSED — nothing spends until you press Launch on the campaign page."
      />

      {error && (
        <div className="flex items-start gap-2 rounded-base border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <ExclamationCircle className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <SectionCard
        title="1 · Goal"
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
                {goal === g.key && (
                  <CheckCircleSolid className="text-grey-90" />
                )}
              </div>
              <p className="mt-1 text-xs text-grey-60">{g.description}</p>
            </button>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="2 · What are you promoting?"
        description="Pick a product and the ad links straight to it (photo and headline pre-filled), or skip to promote your whole store."
      >
        {products.length === 0 ? (
          <div className="text-sm text-grey-50">
            No published products yet — the ad will link to your store&apos;s
            home page.
          </div>
        ) : (
          <div className="grid max-h-72 grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => (
              <button
                key={p.id}
                onClick={() =>
                  productId === p.id ? setProductId(null) : pickProduct(p)
                }
                className={cn(
                  "rounded-lg border p-2 text-left",
                  productId === p.id
                    ? "border-grey-90 bg-grey-5"
                    : "border-grey-20 bg-white hover:border-grey-40"
                )}
              >
                {p.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.thumbnail}
                    alt=""
                    className="h-24 w-full rounded object-cover"
                  />
                ) : (
                  <div className="flex h-24 w-full items-center justify-center rounded bg-grey-10 text-xs text-grey-40">
                    no photo
                  </div>
                )}
                <div className="mt-1.5 truncate text-xs font-medium text-grey-90">
                  {p.title}
                </div>
              </button>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="3 · The ad"
        description="What people actually see. Keep the headline short; the main text sells it."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <label className="block">
              <span className="text-xs font-medium text-grey-70">
                Campaign name (internal)
              </span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Summer sale — traffic"
                className="mt-1 w-full rounded-md border border-grey-20 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-grey-70">Headline</span>
              <input
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="Handmade jewellery, shipped free"
                className="mt-1 w-full rounded-md border border-grey-20 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-grey-70">
                Main text
              </span>
              <textarea
                value={primaryText}
                onChange={(e) => setPrimaryText(e.target.value)}
                rows={4}
                placeholder="Why should someone stop scrolling? Offer, benefit, call to action."
                className="mt-1 w-full rounded-md border border-grey-20 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-grey-70">
                Image URL{" "}
                <span className="font-normal text-grey-50">
                  (pre-filled from the product)
                </span>
              </span>
              <input
                value={imageUrl ?? ""}
                onChange={(e) => setImageUrl(e.target.value || null)}
                placeholder="https://…"
                className="mt-1 w-full rounded-md border border-grey-20 px-3 py-2 text-sm"
              />
            </label>
          </div>
          <div>
            <span className="text-xs font-medium text-grey-70">Preview</span>
            <div className="mt-1 overflow-hidden rounded-lg border border-grey-20 bg-white">
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl}
                  alt=""
                  className="h-44 w-full object-cover"
                />
              ) : (
                <div className="flex h-44 w-full items-center justify-center bg-grey-10 text-xs text-grey-40">
                  ad image
                </div>
              )}
              <div className="p-3">
                <div className="text-sm font-semibold text-grey-90">
                  {headline || "Your headline"}
                </div>
                <div className="mt-0.5 line-clamp-3 text-xs text-grey-60">
                  {primaryText || "Your main text appears here."}
                </div>
                <div className="mt-2 text-[10px] uppercase tracking-wide text-grey-40">
                  {product ? `links to ${product.title}` : "links to your store"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="4 · Budget & audience"
        description="The daily budget is billed by the ad platform to your own ad account — not from your mAutomate credits."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="text-xs font-medium text-grey-70">
              Daily budget ({selectedAccount.currency ?? "account currency"})
            </span>
            <input
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              inputMode="decimal"
              className="mt-1 w-full rounded-md border border-grey-20 px-3 py-2 text-sm tabular-nums"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-grey-70">
              Countries (comma-separated codes)
            </span>
            <input
              value={countries}
              onChange={(e) => setCountries(e.target.value)}
              placeholder="US, GB, BD"
              className="mt-1 w-full rounded-md border border-grey-20 px-3 py-2 text-sm uppercase"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-grey-70">
              Publish as (Facebook Page)
            </span>
            <select
              value={pageId ?? ""}
              onChange={(e) => setPageId(e.target.value || null)}
              className="mt-1 w-full rounded-md border border-grey-20 bg-white px-3 py-2 text-sm"
            >
              <option value="">Choose a page…</option>
              {pages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name ?? p.id}
                </option>
              ))}
            </select>
            {pagesError ? (
              <span className="mt-1 block text-xs text-rose-600">
                {pagesError}
              </span>
            ) : pages.length === 0 ? (
              <span className="mt-1 block text-xs text-grey-50">
                No pages found on your Meta account yet.
              </span>
            ) : null}
          </label>
        </div>
      </SectionCard>

      <div className="flex items-center justify-between rounded-lg border border-grey-20 bg-white p-4">
        <div className="text-sm text-grey-60">
          Creating makes the campaign on{" "}
          <span className="font-medium capitalize text-grey-90">{platform}</span>{" "}
          in a <span className="font-medium text-grey-90">paused</span> state.
          You review it and press Launch yourself — nothing spends until then.
        </div>
        <button
          onClick={create}
          disabled={!ready || creating}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:opacity-50"
        >
          {creating ? <Spinner className="animate-spin" /> : null}
          Create campaign (paused)
        </button>
      </div>
    </div>
  )
}
