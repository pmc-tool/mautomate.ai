"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import {
  Facebook,
  Linkedin,
  Telegram,
  X,
  Plus,
  Trash,
  ArrowPath,
  Spinner,
  CheckCircleSolid,
  ExclamationCircle,
  InformationCircle,
  ArrowUpRightOnBox,
  BuildingStorefront,
} from "@medusajs/icons"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  listSocialAccounts,
  connectSocialAccount,
  disconnectSocialAccount,
  refreshSocialAccount,
  ApiError,
  SocialAccount,
  SocialProvider,
} from "@lib/merchant-admin/api"
import { PageHeader } from "@components/merchant-admin/page-header"
import { SectionCard } from "@components/merchant-admin/section-card"
import { EmptyState } from "@components/merchant-admin/empty-state"
import { Modal } from "@components/merchant-admin/modal"
import { FormField, Input } from "@components/merchant-admin/form-field"
import { cn } from "@lib/util/cn"

// Instagram has no brand glyph in @medusajs/icons, so we render a compact
// inline SVG that reads as the real mark. currentColor so the chip tints it.
function InstagramGlyph({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  )
}

type PlatformMeta = {
  platform: string
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  gradient?: string
}

// The 5 platforms this screen surfaces (no WordPress). Ordered for the grid.
const PLATFORMS: PlatformMeta[] = [
  {
    platform: "facebook",
    label: "Facebook",
    description: "Publish to a Facebook Page.",
    icon: Facebook,
    color: "#1877F2",
  },
  {
    platform: "instagram",
    label: "Instagram",
    description: "Share posts to a Business account.",
    icon: InstagramGlyph,
    color: "#E1306C",
    gradient: "linear-gradient(135deg,#F58529,#DD2A7B 55%,#8134AF)",
  },
  {
    platform: "x",
    label: "X (Twitter)",
    description: "Post to your X profile.",
    icon: X,
    color: "#0F1419",
  },
  {
    platform: "linkedin",
    label: "LinkedIn",
    description: "Share updates to a LinkedIn page.",
    icon: Linkedin,
    color: "#0A66C2",
  },
  {
    platform: "telegram",
    label: "Telegram",
    description: "Broadcast to a channel via a bot.",
    icon: Telegram,
    color: "#229ED9",
  },
]

const STATUS_TONES: Record<string, string> = {
  connected: "bg-emerald-50 text-emerald-700",
  expired: "bg-amber-50 text-amber-700",
  revoked: "bg-rose-50 text-rose-700",
  error: "bg-rose-50 text-rose-700",
}

function AccountStatus({ status }: { status: string }) {
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

function BrandChip({
  meta,
  className,
}: {
  meta: PlatformMeta
  className?: string
}) {
  const Icon = meta.icon
  const style = meta.gradient
    ? { background: meta.gradient, color: "#fff" }
    : { backgroundColor: `${meta.color}14`, color: meta.color }
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-large",
        className
      )}
      style={style}
    >
      <Icon className="h-5 w-5" />
    </div>
  )
}

export default function SocialConnectPage() {
  const { token } = useMerchantAuth()

  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [providers, setProviders] = useState<SocialProvider[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [connecting, setConnecting] = useState<string | null>(null)
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({})
  const [busyAccount, setBusyAccount] = useState<string | null>(null)
  const [notice, setNotice] = useState<{
    tone: "success" | "error"
    text: string
  } | null>(null)

  // Telegram (webhook_token) connect dialog
  const [tgOpen, setTgOpen] = useState(false)
  const [tgToken, setTgToken] = useState("")
  const [tgChatId, setTgChatId] = useState("")
  const [tgHandle, setTgHandle] = useState("")
  const [tgSubmitting, setTgSubmitting] = useState(false)
  const [tgError, setTgError] = useState<string | null>(null)

  const providerByPlatform = useMemo(() => {
    const map: Record<string, SocialProvider> = {}
    for (const p of providers) map[p.platform] = p
    return map
  }, [providers])

  const accountsByPlatform = useMemo(() => {
    const map: Record<string, SocialAccount[]> = {}
    for (const a of accounts) {
      ;(map[a.platform] ||= []).push(a)
    }
    return map
  }, [accounts])

  const load = useCallback(() => {
    if (!token) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    listSocialAccounts(token)
      .then((res) => {
        setAccounts(res.accounts || [])
        setProviders(res.providers || [])
      })
      .catch((err) => {
        setError(
          err instanceof ApiError
            ? err.message
            : "Failed to load connected accounts"
        )
      })
      .finally(() => setLoading(false))
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  // Surface the OAuth callback outcome if the provider redirected back with a
  // ?connected= / ?error= query, then scrub it from the URL.
  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    const connected = params.get("connected")
    const err = params.get("error")
    if (connected) {
      setNotice({
        tone: "success",
        text: `${connected} connected successfully.`,
      })
    } else if (err) {
      setNotice({ tone: "error", text: decodeURIComponent(err) })
    }
    if (connected || err) {
      window.history.replaceState({}, "", window.location.pathname)
    }
  }, [])

  const clearCardError = (platform: string) =>
    setCardErrors((prev) => {
      if (!prev[platform]) return prev
      const next = { ...prev }
      delete next[platform]
      return next
    })

  const handleConnect = async (meta: PlatformMeta) => {
    if (!token) return
    const provider = providerByPlatform[meta.platform]
    const mechanism = provider?.connect ?? "oauth"

    if (mechanism === "webhook_token") {
      setTgToken("")
      setTgChatId("")
      setTgHandle("")
      setTgError(null)
      setTgOpen(true)
      return
    }

    clearCardError(meta.platform)
    setConnecting(meta.platform)
    try {
      const res = await connectSocialAccount(token, { platform: meta.platform })
      if (res.auth_url) {
        window.location.href = res.auth_url
        return
      }
      // Non-OAuth platform created the account directly.
      setNotice({ tone: "success", text: `${meta.label} connected.` })
      load()
    } catch (err) {
      const isCred =
        err instanceof ApiError && (err.status === 403 || err.status === 400)
      setCardErrors((prev) => ({
        ...prev,
        [meta.platform]: isCred
          ? "Connect requires the platform's app credentials (added by the operator)."
          : err instanceof ApiError
          ? err.message
          : "Failed to start connection.",
      }))
    } finally {
      setConnecting(null)
    }
  }

  const submitTelegram = async () => {
    if (!token) return
    if (!tgToken.trim() || !tgChatId.trim()) {
      setTgError("Bot token and chat/channel ID are both required.")
      return
    }
    setTgSubmitting(true)
    setTgError(null)
    try {
      await connectSocialAccount(token, {
        platform: "telegram",
        credentials: {
          bot_token: tgToken.trim(),
          chat_id: tgChatId.trim(),
          handle: tgHandle.trim() || undefined,
        },
      })
      setTgOpen(false)
      setNotice({ tone: "success", text: "Telegram connected." })
      load()
    } catch (err) {
      setTgError(
        err instanceof ApiError ? err.message : "Failed to connect Telegram."
      )
    } finally {
      setTgSubmitting(false)
    }
  }

  const handleRefresh = async (account: SocialAccount) => {
    if (!token) return
    setBusyAccount(account.id)
    setNotice(null)
    try {
      const { refreshed } = await refreshSocialAccount(token, account.id)
      setNotice({
        tone: refreshed ? "success" : "error",
        text: refreshed
          ? "Token refreshed."
          : "Nothing to refresh for this account.",
      })
      load()
    } catch (err) {
      setNotice({
        tone: "error",
        text: err instanceof ApiError ? err.message : "Failed to refresh.",
      })
    } finally {
      setBusyAccount(null)
    }
  }

  const handleDisconnect = async (account: SocialAccount) => {
    if (!token) return
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `Disconnect ${account.handle || account.display_name || account.platform}? This removes its stored credentials.`
      )
    ) {
      return
    }
    setBusyAccount(account.id)
    setNotice(null)
    try {
      await disconnectSocialAccount(token, account.id)
      setNotice({ tone: "success", text: "Account disconnected." })
      load()
    } catch (err) {
      setNotice({
        tone: "error",
        text: err instanceof ApiError ? err.message : "Failed to disconnect.",
      })
    } finally {
      setBusyAccount(null)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Social accounts"
        description="Connect the channels your store publishes to. Accounts are scoped to your store only."
      />

      {notice && (
        <div
          className={cn(
            "flex items-start gap-2 rounded-base border p-4 text-sm",
            notice.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-700"
          )}
        >
          {notice.tone === "success" ? (
            <CheckCircleSolid className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <ExclamationCircle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span className="flex-1">{notice.text}</span>
          <button
            onClick={() => setNotice(null)}
            className="text-xs font-medium underline-offset-2 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-base border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <SectionCard
        title="Available platforms"
        description="Choose a platform to connect. You can connect more than one account."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {PLATFORMS.map((meta) => {
            const provider = providerByPlatform[meta.platform]
            const mechanism = provider?.connect ?? "oauth"
            const linked = accountsByPlatform[meta.platform] || []
            const isConnected = linked.length > 0
            const isBusy = connecting === meta.platform
            const needsSetup =
              mechanism === "oauth" && provider && !provider.configured
            const cardError = cardErrors[meta.platform]

            return (
              <div
                key={meta.platform}
                className="flex flex-col gap-4 rounded-large border border-grey-20 bg-white p-5 shadow-borders-base transition-colors hover:border-grey-30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <BrandChip meta={meta} className="h-11 w-11" />
                    <div>
                      <h3 className="font-semibold text-grey-90">
                        {meta.label}
                      </h3>
                      <p className="mt-0.5 text-xs text-grey-50">
                        {meta.description}
                      </p>
                    </div>
                  </div>
                  {isConnected && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      <CheckCircleSolid className="h-3.5 w-3.5" />
                      {linked.length > 1
                        ? `${linked.length} connected`
                        : "Connected"}
                    </span>
                  )}
                </div>

                {needsSetup ? (
                  <div className="flex items-start gap-2 rounded-base bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    <InformationCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      Connect requires the platform&apos;s app credentials
                      (added by the operator).
                    </span>
                  </div>
                ) : cardError ? (
                  <div className="flex items-start gap-2 rounded-base bg-red-50 px-3 py-2 text-xs text-red-700">
                    <ExclamationCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{cardError}</span>
                  </div>
                ) : null}

                <div className="mt-auto">
                  <button
                    type="button"
                    onClick={() => handleConnect(meta)}
                    disabled={isBusy || !!needsSetup || !token}
                    className={cn(
                      "flex w-full items-center justify-center gap-2 rounded-base px-3 py-2 text-sm font-medium transition-colors",
                      needsSetup
                        ? "cursor-not-allowed bg-grey-10 text-grey-40"
                        : "bg-grey-90 text-white hover:bg-grey-80 disabled:opacity-60"
                    )}
                  >
                    {isBusy ? (
                      <Spinner className="h-4 w-4 animate-spin" />
                    ) : mechanism === "oauth" ? (
                      <ArrowUpRightOnBox className="h-4 w-4" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    {isConnected ? "Connect another" : "Connect"}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </SectionCard>

      <SectionCard
        title="Connected accounts"
        description="Manage the accounts currently linked to your store."
      >
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-grey-50">
            <Spinner className="h-4 w-4 animate-spin" />
            Loading accounts…
          </div>
        ) : accounts.length === 0 ? (
          <EmptyState
            icon={BuildingStorefront}
            title="No accounts connected yet"
            description="Connect a platform above to start publishing from your store."
          />
        ) : (
          <div className="divide-y divide-grey-10">
            {accounts.map((account) => {
              const meta =
                PLATFORMS.find((p) => p.platform === account.platform) ?? {
                  platform: account.platform,
                  label: account.platform,
                  description: "",
                  icon: BuildingStorefront,
                  color: "#6b7280",
                }
              const busy = busyAccount === account.id
              return (
                <div
                  key={account.id}
                  className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3">
                    {account.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={account.avatar_url}
                        alt=""
                        className="h-11 w-11 rounded-large object-cover"
                      />
                    ) : (
                      <BrandChip meta={meta} className="h-11 w-11" />
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium text-grey-90">
                          {account.display_name ||
                            account.handle ||
                            meta.label}
                        </span>
                        <AccountStatus status={account.status} />
                      </div>
                      <p className="truncate text-xs text-grey-50">
                        {meta.label}
                        {account.handle ? ` · ${account.handle}` : ""}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleRefresh(account)}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 rounded-base border border-grey-20 px-3 py-1.5 text-sm font-medium text-grey-70 transition-colors hover:bg-grey-10 disabled:opacity-60"
                    >
                      {busy ? (
                        <Spinner className="h-4 w-4 animate-spin" />
                      ) : (
                        <ArrowPath className="h-4 w-4" />
                      )}
                      Refresh
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDisconnect(account)}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 rounded-base border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60"
                    >
                      <Trash className="h-4 w-4" />
                      Disconnect
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </SectionCard>

      <Modal
        open={tgOpen}
        onClose={() => (tgSubmitting ? null : setTgOpen(false))}
        title="Connect Telegram"
        description="Paste your bot token and the target channel/chat ID. The bot must be an admin of the channel."
        size="sm"
      >
        <div className="space-y-4">
          <FormField
            label="Bot token"
            htmlFor="tg-token"
            hint="From @BotFather, e.g. 123456:ABC-DEF..."
          >
            <Input
              id="tg-token"
              value={tgToken}
              onChange={(e) => setTgToken(e.target.value)}
              placeholder="123456789:AA..."
              autoComplete="off"
            />
          </FormField>
          <FormField
            label="Chat / channel ID"
            htmlFor="tg-chat"
            hint="Numeric chat id (e.g. -1001234567890) or @channelname."
          >
            <Input
              id="tg-chat"
              value={tgChatId}
              onChange={(e) => setTgChatId(e.target.value)}
              placeholder="-1001234567890"
              autoComplete="off"
            />
          </FormField>
          <FormField
            label="Channel handle (optional)"
            htmlFor="tg-handle"
            hint="Public @username, used to build post links."
          >
            <Input
              id="tg-handle"
              value={tgHandle}
              onChange={(e) => setTgHandle(e.target.value)}
              placeholder="mychannel"
              autoComplete="off"
            />
          </FormField>

          {tgError && (
            <div className="flex items-start gap-2 rounded-base bg-red-50 px-3 py-2 text-xs text-red-700">
              <ExclamationCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{tgError}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setTgOpen(false)}
              disabled={tgSubmitting}
              className="rounded-base border border-grey-20 px-4 py-2 text-sm font-medium text-grey-70 transition-colors hover:bg-grey-10 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submitTelegram}
              disabled={tgSubmitting}
              className="inline-flex items-center gap-2 rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-grey-80 disabled:opacity-60"
            >
              {tgSubmitting && <Spinner className="h-4 w-4 animate-spin" />}
              Connect
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
