"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import {
  ArrowPath,
  CheckCircleSolid,
  ChartPie,
  ExclamationCircle,
  Facebook,
  Spinner,
  Trash,
} from "@medusajs/icons"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  AdsAccount,
  AdsAccountsResponse,
  AdsSignals,
  connectAdsPlatform,
  disconnectAdsConnection,
  getAdsSignals,
  listAdsAccounts,
  runAdsSyncNow,
  selectAdsAccount,
  setupAdsPixel,
  syncAdsCatalog,
} from "@lib/merchant-admin/api"
import { PageHeader } from "@components/merchant-admin/page-header"
import { SectionCard } from "@components/merchant-admin/section-card"
import { EmptyState } from "@components/merchant-admin/empty-state"
import { cn } from "@lib/util/cn"

/**
 * Advertising — Connect. Link the ad platforms this store advertises on.
 * Meta connects via OAuth (the merchant approves once, we take it from
 * there); Google and TikTok are shown honestly as "coming soon" until their
 * platform access lands. Ad spend stays on the merchant's own card at the
 * platform — connecting here never moves money.
 */

type StaticPlatform = {
  platform: string
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  comingSoon?: boolean
}

const GoogleGlyph = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
    <path d="M21.6 12.2c0-.7-.06-1.4-.18-2.06H12v3.9h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.24c1.9-1.74 2.98-4.3 2.98-7.36Z" />
    <path d="M12 22c2.7 0 4.96-.9 6.62-2.42l-3.24-2.5c-.9.6-2.04.95-3.38.95-2.6 0-4.8-1.75-5.58-4.1H3.07v2.58A10 10 0 0 0 12 22Z" />
    <path d="M6.42 13.93a6 6 0 0 1 0-3.85V7.5H3.07a10 10 0 0 0 0 9l3.35-2.58Z" />
    <path d="M12 5.97c1.47 0 2.78.5 3.82 1.5l2.86-2.87A9.97 9.97 0 0 0 12 2a10 10 0 0 0-8.93 5.5l3.35 2.58C7.2 7.73 9.4 5.97 12 5.97Z" />
  </svg>
)

const TikTokGlyph = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
    <path d="M16.6 3c.36 1.94 1.62 3.46 3.9 3.76v3.06c-1.5.06-2.82-.36-3.9-1.13v5.85c0 4.06-2.9 6.46-6.16 6.46A5.87 5.87 0 0 1 4.5 15.2c0-3.45 2.72-6.06 6.34-5.86v3.2c-.3-.08-.62-.13-.94-.13a2.73 2.73 0 0 0-2.8 2.76 2.75 2.75 0 0 0 2.8 2.78c1.66 0 2.9-1.2 2.9-3.14V3h3.8Z" />
  </svg>
)

const COMING_SOON: StaticPlatform[] = [
  {
    platform: "google",
    label: "Google Ads",
    description:
      "Search, Shopping, and Performance Max campaigns from your product catalog.",
    icon: GoogleGlyph,
    color: "#4285F4",
    comingSoon: true,
  },
  {
    platform: "tiktok",
    label: "TikTok Ads",
    description: "Smart+ campaigns powered by your AI-generated product videos.",
    icon: TikTokGlyph,
    color: "#0F1419",
    comingSoon: true,
  },
]

const PLATFORM_META: Record<
  string,
  { label: string; description: string; icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  meta: {
    label: "Meta ads",
    description:
      "Run Facebook and Instagram campaigns for this store — accounts, campaigns, and results appear in your Advertising overview.",
    icon: Facebook,
    color: "#1877F2",
  },
  mock: {
    label: "Demo platform",
    description:
      "A safe demo ad platform for testing the panel end to end. Development environments only.",
    icon: ChartPie,
    color: "#697077",
  },
}

const STATUS_TONES: Record<string, string> = {
  connected: "bg-emerald-50 text-emerald-700",
  expired: "bg-amber-50 text-amber-700",
  revoked: "bg-rose-50 text-rose-700",
  error: "bg-rose-50 text-rose-700",
}

function StatusPill({ status }: { status: string }) {
  const tone = STATUS_TONES[status] ?? "bg-grey-10 text-grey-70"
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
        tone
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {status.replace(/_/g, " ")}
    </span>
  )
}

export default function AdvertisingConnectPage() {
  const { token } = useMerchantAuth()
  const searchParams = useSearchParams()
  const [data, setData] = useState<AdsAccountsResponse | null>(null)
  const [signals, setSignals] = useState<AdsSignals | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<{
    kind: "success" | "error"
    text: string
  } | null>(null)

  useEffect(() => {
    const connected = searchParams?.get("connected")
    const error = searchParams?.get("error")
    if (connected) {
      setNotice({
        kind: "success",
        text: `Connected. Your ${connected} ad accounts are being discovered — pick the one this store uses below.`,
      })
    } else if (error) {
      setNotice({
        kind: "error",
        text: `The connection did not complete: ${decodeURIComponent(error)}`,
      })
    }
  }, [searchParams])

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const [accounts, sig] = await Promise.all([
        listAdsAccounts(token),
        getAdsSignals(token).catch(() => null),
      ])
      setData(accounts)
      setSignals(sig)
    } catch (e: any) {
      setNotice({
        kind: "error",
        text: e?.message ?? "Could not load your ad platform connections.",
      })
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  const connect = useCallback(
    async (platform: string) => {
      if (!token || busy) return
      setBusy(`connect:${platform}`)
      setNotice(null)
      try {
        const res = await connectAdsPlatform(token, platform)
        if (res.auth_url) {
          window.location.href = res.auth_url
          return
        }
        setNotice({ kind: "success", text: "Connected." })
        await load()
      } catch (e: any) {
        setNotice({ kind: "error", text: e?.message ?? "Could not connect." })
      } finally {
        setBusy(null)
      }
    },
    [token, busy, load]
  )

  const disconnect = useCallback(
    async (connectionId: string) => {
      if (!token || busy) return
      if (
        !window.confirm(
          "Disconnect this ad platform? Your campaigns keep running on the platform — this store just stops managing them from here."
        )
      ) {
        return
      }
      setBusy(`disconnect:${connectionId}`)
      try {
        await disconnectAdsConnection(token, connectionId)
        await load()
      } catch (e: any) {
        setNotice({ kind: "error", text: e?.message ?? "Could not disconnect." })
      } finally {
        setBusy(null)
      }
    },
    [token, busy, load]
  )

  const toggleAccount = useCallback(
    async (account: AdsAccount) => {
      if (!token || busy) return
      setBusy(`select:${account.id}`)
      try {
        await selectAdsAccount(token, account.id, !account.selected)
        await load()
      } catch (e: any) {
        setNotice({
          kind: "error",
          text: e?.message ?? "Could not update the account.",
        })
      } finally {
        setBusy(null)
      }
    },
    [token, busy, load]
  )

  const setupPixel = useCallback(async () => {
    if (!token || busy) return
    setBusy("pixel")
    setNotice(null)
    try {
      const { pixel } = await setupAdsPixel(token)
      setNotice({
        kind: "success",
        text: `Pixel ${pixel.external_id} is installed. Every store visit now reaches Meta, and purchases are reported server-side automatically.`,
      })
      await load()
    } catch (e: any) {
      setNotice({ kind: "error", text: e?.message ?? "Pixel setup failed." })
    } finally {
      setBusy(null)
    }
  }, [token, busy, load])

  const syncCatalog = useCallback(async () => {
    if (!token || busy) return
    setBusy("catalog")
    setNotice(null)
    try {
      const { result } = await syncAdsCatalog(token)
      setNotice({
        kind: "success",
        text: `${result.pushed} product${result.pushed === 1 ? "" : "s"} synced to your Meta catalog${
          result.skipped
            ? ` (${result.skipped} skipped — they need a photo and a price)`
            : ""
        }.`,
      })
      await load()
    } catch (e: any) {
      setNotice({ kind: "error", text: e?.message ?? "Catalog sync failed." })
    } finally {
      setBusy(null)
    }
  }, [token, busy, load])

  const syncNow = useCallback(async () => {
    if (!token || busy) return
    setBusy("sync")
    try {
      const { summary } = await runAdsSyncNow(token)
      setNotice(
        summary.errors.length
          ? { kind: "error", text: `Sync finished with issues: ${summary.errors[0]}` }
          : {
              kind: "success",
              text: `Synced ${summary.accounts} account${
                summary.accounts === 1 ? "" : "s"
              } and ${summary.campaigns} campaign${
                summary.campaigns === 1 ? "" : "s"
              }.`,
            }
      )
      await load()
    } catch (e: any) {
      setNotice({ kind: "error", text: e?.message ?? "Sync failed." })
    } finally {
      setBusy(null)
    }
  }, [token, busy, load])

  // Live platforms from the API, then the static coming-soon cards for the
  // ones the API does not offer yet.
  const platformCards = useMemo(() => {
    const live = (data?.platforms ?? []).map((p) => ({
      platform: p.platform,
      label: PLATFORM_META[p.platform]?.label ?? p.label,
      description:
        PLATFORM_META[p.platform]?.description ??
        "Connect this platform's ad account.",
      icon: PLATFORM_META[p.platform]?.icon ?? ChartPie,
      color: PLATFORM_META[p.platform]?.color ?? "#697077",
      configured: p.configured,
      comingSoon: false,
    }))
    const liveKeys = new Set(live.map((p) => p.platform))
    return [
      ...live,
      ...COMING_SOON.filter((p) => !liveKeys.has(p.platform)).map((p) => ({
        ...p,
        configured: false,
      })),
    ]
  }, [data?.platforms])

  const connections = data?.connections ?? []
  const accounts = data?.accounts ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ad accounts"
        description="Connect the platforms this store advertises on. Ad spend is always billed by the platform to your own ad account — connecting here never moves money."
      />

      {notice && (
        <div
          className={cn(
            "flex items-start gap-2 rounded-base border p-4 text-sm",
            notice.kind === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-700"
          )}
        >
          {notice.kind === "success" ? (
            <CheckCircleSolid className="mt-0.5 shrink-0" />
          ) : (
            <ExclamationCircle className="mt-0.5 shrink-0" />
          )}
          <span>{notice.text}</span>
        </div>
      )}

      <SectionCard
        title="Platforms"
        description="One connection per platform. You approve access once on the platform's own consent screen; we never see your password."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {platformCards.map((p) => {
            const Icon = p.icon
            const connection = connections.find(
              (c) => c.platform === p.platform && c.status === "connected"
            )
            const anyConnection = connections.find(
              (c) => c.platform === p.platform && c.status !== "revoked"
            )
            return (
              <div
                key={p.platform}
                className="flex flex-col rounded-lg border border-grey-20 bg-white p-4"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-md text-white"
                    style={{ background: p.color }}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="font-medium text-grey-90">{p.label}</div>
                    {connection ? (
                      <StatusPill status="connected" />
                    ) : anyConnection && anyConnection.status !== "revoked" ? (
                      <StatusPill status={anyConnection.status} />
                    ) : null}
                  </div>
                </div>
                <p className="mt-3 flex-1 text-sm text-grey-60">{p.description}</p>
                <div className="mt-4">
                  {p.comingSoon ? (
                    <span className="inline-flex rounded-full bg-grey-10 px-2.5 py-1 text-xs font-medium text-grey-60">
                      Coming soon
                    </span>
                  ) : !p.configured ? (
                    <div className="text-xs text-grey-50">
                      Not switched on yet — platform access is being set up.
                      This card goes live the moment it is approved.
                    </div>
                  ) : connection ? (
                    <button
                      onClick={() => disconnect(connection.id)}
                      disabled={busy === `disconnect:${connection.id}`}
                      className="inline-flex items-center gap-1.5 rounded-md border border-grey-20 px-3 py-1.5 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                    >
                      {busy === `disconnect:${connection.id}` ? (
                        <Spinner className="animate-spin" />
                      ) : (
                        <Trash />
                      )}
                      Disconnect
                    </button>
                  ) : (
                    <button
                      onClick={() => connect(p.platform)}
                      disabled={busy === `connect:${p.platform}`}
                      className="inline-flex items-center gap-1.5 rounded-md bg-grey-90 px-3 py-1.5 text-sm font-medium text-white hover:bg-grey-80 disabled:opacity-50"
                    >
                      {busy === `connect:${p.platform}` ? (
                        <Spinner className="animate-spin" />
                      ) : null}
                      {anyConnection ? "Reconnect" : `Connect ${p.label}`}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </SectionCard>

      <SectionCard
        title="Your ad accounts"
        description="The ad accounts found under your connections. Choose which ones this store manages — campaigns and results sync only for the accounts in use."
      >
        {loading ? (
          <div className="flex items-center gap-2 py-8 text-grey-50">
            <Spinner className="animate-spin" /> Loading…
          </div>
        ) : accounts.length === 0 ? (
          <EmptyState
            icon={ChartPie}
            title="No ad accounts yet"
            description="Connect a platform above and the ad accounts you have access to will be listed here."
          />
        ) : (
          <div className="divide-y divide-grey-10">
            {accounts.map((a) => (
              <div
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium text-grey-90">
                    {a.name ?? a.external_id}
                  </div>
                  <div className="text-xs text-grey-50">
                    <span className="capitalize">{a.platform}</span>
                    {" · "}
                    {a.external_id}
                    {a.currency ? ` · ${a.currency}` : ""}
                    {a.status !== "active" ? " · disabled on platform" : ""}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {a.selected ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                      <CheckCircleSolid className="h-3.5 w-3.5" /> In use
                    </span>
                  ) : null}
                  <button
                    onClick={() => toggleAccount(a)}
                    disabled={busy === `select:${a.id}` || a.status !== "active"}
                    className={cn(
                      "rounded-md border px-3 py-1.5 text-sm font-medium disabled:opacity-50",
                      a.selected
                        ? "border-grey-20 text-grey-60 hover:bg-grey-5"
                        : "border-grey-20 bg-white text-grey-90 hover:bg-grey-5"
                    )}
                  >
                    {busy === `select:${a.id}` ? (
                      <Spinner className="animate-spin" />
                    ) : a.selected ? (
                      "Stop using"
                    ) : (
                      "Use this account"
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {accounts.some((a) => a.selected) && (
          <div className="mt-4 flex justify-end">
            <button
              onClick={syncNow}
              disabled={busy === "sync"}
              className="inline-flex items-center gap-1.5 rounded-md border border-grey-20 bg-white px-3 py-1.5 text-sm font-medium text-grey-90 hover:bg-grey-5 disabled:opacity-50"
            >
              {busy === "sync" ? (
                <Spinner className="animate-spin" />
              ) : (
                <ArrowPath />
              )}
              Sync campaigns and results now
            </button>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Tracking & catalog"
        description="What makes your ads actually perform: the pixel tells Meta who visited, purchases are reported server-side (more reliable than browser-only tracking), and the catalog powers ads generated from your real products."
      >
        {!signals?.requirements.connected ? (
          <div className="text-sm text-grey-50">
            Connect Meta above to set up tracking — both pieces are one click
            once an ad account is in use.
          </div>
        ) : !signals.requirements.account_selected ? (
          <div className="text-sm text-grey-50">
            Choose an ad account above (&ldquo;Use this account&rdquo;) to set
            up tracking.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-grey-20 p-4">
              <div className="flex items-center justify-between">
                <div className="font-medium text-grey-90">Meta pixel</div>
                {signals.pixel ? <StatusPill status="connected" /> : null}
              </div>
              {signals.pixel ? (
                <div className="mt-2 text-sm text-grey-60">
                  <div>
                    Pixel {signals.pixel.external_id} is live on your store.
                  </div>
                  <div className="mt-1 text-xs text-grey-50">
                    {signals.pixel.events_sent > 0
                      ? `${signals.pixel.events_sent} purchase${
                          signals.pixel.events_sent === 1 ? "" : "s"
                        } reported server-side${
                          signals.pixel.last_event_at
                            ? `, last ${new Date(
                                signals.pixel.last_event_at
                              ).toLocaleString()}`
                            : ""
                        }`
                      : "No purchases reported yet — they are sent automatically when orders come in."}
                  </div>
                </div>
              ) : (
                <>
                  <p className="mt-2 text-sm text-grey-60">
                    Installs your Meta pixel on every store page and starts
                    reporting purchases server-side. Uses your account&apos;s
                    existing pixel, or creates one.
                  </p>
                  <button
                    onClick={setupPixel}
                    disabled={busy === "pixel"}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-grey-90 px-3 py-1.5 text-sm font-medium text-white hover:bg-grey-80 disabled:opacity-50"
                  >
                    {busy === "pixel" ? (
                      <Spinner className="animate-spin" />
                    ) : null}
                    Set up pixel
                  </button>
                </>
              )}
            </div>

            <div className="rounded-lg border border-grey-20 p-4">
              <div className="flex items-center justify-between">
                <div className="font-medium text-grey-90">Product catalog</div>
                {signals.catalog ? (
                  <StatusPill
                    status={
                      signals.catalog.status === "active"
                        ? "connected"
                        : "error"
                    }
                  />
                ) : null}
              </div>
              {signals.catalog ? (
                <div className="mt-2 text-sm text-grey-60">
                  <div>
                    {signals.catalog.item_count} product
                    {signals.catalog.item_count === 1 ? "" : "s"} in your Meta
                    catalog
                    {signals.catalog.skipped_count
                      ? ` (${signals.catalog.skipped_count} skipped — need a photo and a price)`
                      : ""}
                    .
                  </div>
                  <button
                    onClick={syncCatalog}
                    disabled={busy === "catalog"}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-grey-20 bg-white px-3 py-1.5 text-sm font-medium text-grey-90 hover:bg-grey-5 disabled:opacity-50"
                  >
                    {busy === "catalog" ? (
                      <Spinner className="animate-spin" />
                    ) : (
                      <ArrowPath />
                    )}
                    Sync products again
                  </button>
                </div>
              ) : (
                <>
                  <p className="mt-2 text-sm text-grey-60">
                    Copies your published products into a Meta catalog so ads
                    can show real products with live prices. Re-sync any time.
                  </p>
                  <button
                    onClick={syncCatalog}
                    disabled={busy === "catalog"}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-grey-90 px-3 py-1.5 text-sm font-medium text-white hover:bg-grey-80 disabled:opacity-50"
                  >
                    {busy === "catalog" ? (
                      <Spinner className="animate-spin" />
                    ) : null}
                    Sync products to Meta
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  )
}
