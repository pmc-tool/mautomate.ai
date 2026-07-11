/**
 * Marketing — Connect.
 *
 * Manage the social / messaging accounts used to publish scheduled posts. One
 * card per provider returned by the backend; each card reflects whether the
 * provider's app keys are configured and whether an account is connected, and
 * exposes the right connect flow for its auth style:
 *
 *   - oauth        → POST connect returns { auth_url }; we redirect the browser.
 *   - app_password → a modal collects { site_url, username, app_password }.
 *   - webhook_token→ a modal collects { bot_token, chat_id, handle? }.
 *
 * Self-contained on purpose: this route does not import the sibling
 * `_components/lib.ts` — it inlines its own cookie-session fetch helper and
 * types so the backend contract for this screen lives in one file. Secrets are
 * only ever sent to the backend, never rendered back.
 */
import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  ArrowPath,
  ArrowUpRightOnBox,
  Channels,
  CheckCircleSolid,
  ExclamationCircle,
  Key,
  Spinner,
  Trash,
} from "@medusajs/icons"
import {
  Badge,
  Button,
  clx,
  Container,
  FocusModal,
  Heading,
  IconButton,
  Input,
  Label,
  Text,
  toast,
  Tooltip,
  usePrompt,
} from "@medusajs/ui"
import { useCallback, useEffect, useState } from "react"
import { BrandIcon } from "../_components/brand-icons"
import { EmptyState, PageHeader } from "../_components/ui-kit"

/* ------------------------------------------------------------------ */
/* API contract                                                        */
/* ------------------------------------------------------------------ */

type ConnectStyle = "oauth" | "app_password" | "webhook_token"

type AccountStatus = "connected" | "expired" | "revoked" | "error"

type AccountDto = {
  id: string
  platform: string
  handle: string | null
  display_name: string | null
  avatar_url: string | null
  status: AccountStatus | string
  external_id: string | null
  connected_at: string | null
}

type ProviderInfoDto = {
  platform: string
  label: string
  /** True when the app-level keys/secrets are present in the environment. */
  configured: boolean
  connect: ConnectStyle
  /** True when an account already exists for this provider. */
  connected: boolean
}

type AccountsResponse = {
  accounts: AccountDto[]
  providers: ProviderInfoDto[]
}

/* Cookie-session fetch helper — mirrors the marketing lib, inlined here. */
async function api<T = any>(
  path: string,
  init?: RequestInit & { json?: unknown }
): Promise<T> {
  const { json, headers, ...rest } = init ?? {}
  const res = await fetch(path, {
    credentials: "include",
    headers: {
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(headers ?? {}),
    },
    ...(json !== undefined ? { body: JSON.stringify(json) } : {}),
    ...rest,
  })
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message =
      payload?.message ||
      (Array.isArray(payload?.errors) ? payload.errors.join("; ") : "") ||
      `Request failed (${res.status})`
    const err = new Error(message) as Error & { status?: number }
    err.status = res.status
    throw err
  }
  return payload as T
}

/* ------------------------------------------------------------------ */
/* Presentation helpers                                                */
/* ------------------------------------------------------------------ */

function humanize(v?: string | null): string {
  if (!v) return "—"
  return v
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
}

function statusBadge(status?: string | null): {
  label: string
  color: "green" | "orange" | "red" | "grey"
} {
  switch (status) {
    case "connected":
      return { label: "Connected", color: "green" }
    case "expired":
      return { label: "Token expired", color: "orange" }
    case "revoked":
      return { label: "Revoked", color: "red" }
    case "error":
      return { label: "Error", color: "red" }
    default:
      return { label: humanize(status), color: "grey" }
  }
}

/* ------------------------------------------------------------------ */
/* Credential modals                                                   */
/* ------------------------------------------------------------------ */

type AppPasswordForm = { site_url: string; username: string; app_password: string }
type WebhookForm = { bot_token: string; chat_id: string; handle: string }

function AppPasswordModal({
  provider,
  open,
  onOpenChange,
  onSubmit,
  busy,
}: {
  provider: ProviderInfoDto
  open: boolean
  onOpenChange: (v: boolean) => void
  onSubmit: (creds: AppPasswordForm) => void
  busy: boolean
}) {
  const [form, setForm] = useState<AppPasswordForm>({
    site_url: "",
    username: "",
    app_password: "",
  })

  useEffect(() => {
    if (open) setForm({ site_url: "", username: "", app_password: "" })
  }, [open])

  const submit = () => {
    if (!form.site_url.trim() || !form.username.trim() || !form.app_password.trim()) {
      toast.error("All fields are required")
      return
    }
    onSubmit({
      site_url: form.site_url.trim(),
      username: form.username.trim(),
      app_password: form.app_password.trim(),
    })
  }

  return (
    <FocusModal open={open} onOpenChange={onOpenChange}>
      <FocusModal.Content>
        <FocusModal.Header>
          <Button size="small" onClick={submit} isLoading={busy}>
            Connect
          </Button>
        </FocusModal.Header>
        <FocusModal.Body className="flex flex-col items-center overflow-y-auto py-10">
          <div className="flex w-full max-w-lg flex-col gap-y-6">
            <div className="flex flex-col gap-y-1">
              <Heading level="h2">Connect {provider.label}</Heading>
              <Text size="small" className="text-ui-fg-subtle">
                Create an application password in your {provider.label} profile,
                then paste the details below. Credentials are stored securely and
                never shown again.
              </Text>
            </div>

            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus" htmlFor="ap-site-url">
                Site URL
              </Label>
              <Input
                id="ap-site-url"
                placeholder="https://blog.example.com"
                value={form.site_url}
                onChange={(e) => setForm((f) => ({ ...f, site_url: e.target.value }))}
              />
            </div>

            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus" htmlFor="ap-username">
                Username
              </Label>
              <Input
                id="ap-username"
                placeholder="admin"
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
              />
            </div>

            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus" htmlFor="ap-app-password">
                Application password
              </Label>
              <Input
                id="ap-app-password"
                type="password"
                autoComplete="new-password"
                placeholder="xxxx xxxx xxxx xxxx"
                value={form.app_password}
                onChange={(e) =>
                  setForm((f) => ({ ...f, app_password: e.target.value }))
                }
              />
            </div>
          </div>
        </FocusModal.Body>
      </FocusModal.Content>
    </FocusModal>
  )
}

function WebhookModal({
  provider,
  open,
  onOpenChange,
  onSubmit,
  busy,
}: {
  provider: ProviderInfoDto
  open: boolean
  onOpenChange: (v: boolean) => void
  onSubmit: (creds: WebhookForm) => void
  busy: boolean
}) {
  const [form, setForm] = useState<WebhookForm>({
    bot_token: "",
    chat_id: "",
    handle: "",
  })

  useEffect(() => {
    if (open) setForm({ bot_token: "", chat_id: "", handle: "" })
  }, [open])

  const submit = () => {
    if (!form.bot_token.trim() || !form.chat_id.trim()) {
      toast.error("Bot token and chat ID are required")
      return
    }
    onSubmit({
      bot_token: form.bot_token.trim(),
      chat_id: form.chat_id.trim(),
      handle: form.handle.trim(),
    })
  }

  return (
    <FocusModal open={open} onOpenChange={onOpenChange}>
      <FocusModal.Content>
        <FocusModal.Header>
          <Button size="small" onClick={submit} isLoading={busy}>
            Connect
          </Button>
        </FocusModal.Header>
        <FocusModal.Body className="flex flex-col items-center overflow-y-auto py-10">
          <div className="flex w-full max-w-lg flex-col gap-y-6">
            <div className="flex flex-col gap-y-1">
              <Heading level="h2">Connect {provider.label}</Heading>
              <Text size="small" className="text-ui-fg-subtle">
                Create a bot with @BotFather, then paste its token and the chat
                or channel ID it should post to. Credentials are stored securely
                and never shown again.
              </Text>
            </div>

            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus" htmlFor="wh-bot-token">
                Bot token
              </Label>
              <Input
                id="wh-bot-token"
                type="password"
                autoComplete="new-password"
                placeholder="123456:ABC-DEF..."
                value={form.bot_token}
                onChange={(e) => setForm((f) => ({ ...f, bot_token: e.target.value }))}
              />
            </div>

            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus" htmlFor="wh-chat-id">
                Chat ID
              </Label>
              <Input
                id="wh-chat-id"
                placeholder="-1001234567890"
                value={form.chat_id}
                onChange={(e) => setForm((f) => ({ ...f, chat_id: e.target.value }))}
              />
            </div>

            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus" htmlFor="wh-handle">
                Handle{" "}
                <span className="font-normal text-ui-fg-muted">(optional)</span>
              </Label>
              <Input
                id="wh-handle"
                placeholder="@mychannel"
                value={form.handle}
                onChange={(e) => setForm((f) => ({ ...f, handle: e.target.value }))}
              />
            </div>
          </div>
        </FocusModal.Body>
      </FocusModal.Content>
    </FocusModal>
  )
}

/* ------------------------------------------------------------------ */
/* Provider card                                                       */
/* ------------------------------------------------------------------ */

function ProviderCard({
  provider,
  account,
  busy,
  onConnect,
  onReconnect,
  onRefresh,
  onDisconnect,
}: {
  provider: ProviderInfoDto
  account?: AccountDto
  busy: boolean
  onConnect: () => void
  onReconnect: () => void
  onRefresh: () => void
  onDisconnect: () => void
}) {
  const connected = provider.connected && !!account

  let state: { label: string; color: "green" | "blue" | "grey"; helper: string }
  if (connected) {
    const b = statusBadge(account?.status)
    state = {
      label: b.label,
      color: b.color === "green" ? "green" : "blue",
      helper: "",
    }
  } else if (!provider.configured) {
    state = {
      label: "Not configured",
      color: "grey",
      helper: `Add app credentials in your environment to enable ${provider.label}.`,
    }
  } else {
    state = { label: "Ready to connect", color: "blue", helper: "" }
  }

  const isOauth = provider.connect === "oauth"

  return (
    <div className="flex flex-col justify-between gap-y-4 rounded-xl border border-ui-border-base bg-ui-bg-base p-4 transition-shadow hover:shadow-elevation-card-rest">
      <div className="flex flex-col gap-y-3">
        <div className="flex items-start justify-between gap-x-3">
          <div className="flex min-w-0 items-center gap-x-3">
            <BrandIcon platform={provider.platform} size={40} />
            <Text size="base" weight="plus" className="truncate">
              {provider.label}
            </Text>
          </div>
          <Badge size="2xsmall" color={state.color}>
            {state.label}
          </Badge>
        </div>

        {connected ? (
          <div className="flex items-center gap-x-3">
            {account?.avatar_url ? (
              <img
                src={account.avatar_url}
                alt=""
                className="size-8 shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ui-bg-base shadow-borders-base">
                <CheckCircleSolid className="text-ui-fg-interactive" />
              </div>
            )}
            <div className="flex min-w-0 flex-col">
              <Text size="small" weight="plus" className="truncate">
                {account?.display_name || account?.handle || provider.label}
              </Text>
              {account?.handle && (
                <Text size="xsmall" className="truncate text-ui-fg-subtle">
                  {account.handle}
                </Text>
              )}
            </div>
          </div>
        ) : (
          <Text size="small" className="text-ui-fg-subtle">
            {state.helper ||
              `Connect ${provider.label} to publish scheduled posts to it.`}
          </Text>
        )}

        {connected && account?.status && account.status !== "connected" && (
          <div className="flex items-center gap-x-1.5 text-ui-fg-subtle">
            <ExclamationCircle className="text-ui-tag-orange-icon" />
            <Text size="xsmall">
              This connection needs attention — reconnect to keep publishing.
            </Text>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {connected ? (
          <>
            <Button
              size="small"
              variant="secondary"
              onClick={onReconnect}
              isLoading={busy}
            >
              Reconnect
            </Button>
            {isOauth && (
              <Button
                size="small"
                variant="transparent"
                onClick={onRefresh}
                disabled={busy}
              >
                <ArrowPath />
                Refresh token
              </Button>
            )}
            <div className="ml-auto">
              <IconButton
                size="small"
                variant="transparent"
                onClick={onDisconnect}
                disabled={busy}
              >
                <Trash />
              </IconButton>
            </div>
          </>
        ) : !provider.configured ? (
          <Tooltip
            content={`Add ${provider.label} app credentials to your environment to enable this.`}
          >
            <span tabIndex={0}>
              <Button size="small" disabled>
                Connect
              </Button>
            </span>
          </Tooltip>
        ) : (
          <Button size="small" onClick={onConnect} isLoading={busy}>
            {isOauth ? <ArrowUpRightOnBox /> : <Key />}
            Connect
          </Button>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

const ConnectPage = () => {
  const dialog = usePrompt()

  const [data, setData] = useState<AccountsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  /** Platform currently running a mutation (connect / refresh / delete). */
  const [busyPlatform, setBusyPlatform] = useState<string | null>(null)

  const [pwModal, setPwModal] = useState<ProviderInfoDto | null>(null)
  const [whModal, setWhModal] = useState<ProviderInfoDto | null>(null)
  const [modalBusy, setModalBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api<AccountsResponse>("/admin/marketing/accounts")
      setData({
        accounts: res.accounts ?? [],
        providers: res.providers ?? [],
      })
    } catch (e: any) {
      setError(e?.message ?? "Could not load connected accounts.")
    } finally {
      setLoading(false)
    }
  }, [])

  // Handle the OAuth callback redirect (?connected=… / ?error=…) and load.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const connected = params.get("connected")
    const errMsg = params.get("error")
    if (connected) {
      toast.success(`${humanize(connected)} connected`)
    }
    if (errMsg) {
      toast.error("Could not connect account", { description: errMsg })
    }
    if (connected || errMsg) {
      params.delete("connected")
      params.delete("error")
      const qs = params.toString()
      window.history.replaceState(
        {},
        "",
        `${window.location.pathname}${qs ? `?${qs}` : ""}`
      )
    }
    load()
  }, [load])

  const accountFor = (platform: string) =>
    data?.accounts.find((a) => a.platform === platform)

  /** Runs POST connect; redirects for oauth, refetches for credential flows. */
  const runConnect = async (
    platform: string,
    credentials?: Record<string, unknown>
  ): Promise<boolean> => {
    const res = await api<{ auth_url?: string; account?: AccountDto }>(
      "/admin/marketing/accounts/connect",
      { method: "POST", json: { platform, ...(credentials ? { credentials } : {}) } }
    )
    if (res.auth_url) {
      window.location.href = res.auth_url
      return true
    }
    return false
  }

  const handleConnect = async (provider: ProviderInfoDto) => {
    if (provider.connect === "app_password") {
      setPwModal(provider)
      return
    }
    if (provider.connect === "webhook_token") {
      setWhModal(provider)
      return
    }
    // oauth
    setBusyPlatform(provider.platform)
    try {
      const redirected = await runConnect(provider.platform)
      if (!redirected) {
        toast.success(`${provider.label} connected`)
        await load()
      }
      // On redirect we leave the page; nothing more to do.
    } catch (e: any) {
      toast.error(`Could not connect ${provider.label}`, {
        description: e?.message,
      })
    } finally {
      setBusyPlatform(null)
    }
  }

  const submitAppPassword = async (creds: AppPasswordForm) => {
    if (!pwModal) return
    setModalBusy(true)
    try {
      await runConnect(pwModal.platform, creds)
      toast.success(`${pwModal.label} connected`)
      setPwModal(null)
      await load()
    } catch (e: any) {
      toast.error(`Could not connect ${pwModal.label}`, {
        description: e?.message,
      })
    } finally {
      setModalBusy(false)
    }
  }

  const submitWebhook = async (creds: WebhookForm) => {
    if (!whModal) return
    setModalBusy(true)
    try {
      const payload: Record<string, unknown> = {
        bot_token: creds.bot_token,
        chat_id: creds.chat_id,
      }
      if (creds.handle) payload.handle = creds.handle
      await runConnect(whModal.platform, payload)
      toast.success(`${whModal.label} connected`)
      setWhModal(null)
      await load()
    } catch (e: any) {
      toast.error(`Could not connect ${whModal.label}`, {
        description: e?.message,
      })
    } finally {
      setModalBusy(false)
    }
  }

  const handleRefresh = async (provider: ProviderInfoDto, account: AccountDto) => {
    setBusyPlatform(provider.platform)
    try {
      await api(`/admin/marketing/accounts/${account.id}/refresh`, {
        method: "POST",
      })
      toast.success(`${provider.label} token refreshed`)
      await load()
    } catch (e: any) {
      toast.error(`Could not refresh ${provider.label}`, {
        description: e?.message,
      })
    } finally {
      setBusyPlatform(null)
    }
  }

  const handleDisconnect = async (provider: ProviderInfoDto, account: AccountDto) => {
    const ok = await dialog({
      title: `Disconnect ${provider.label}`,
      description: `Disconnect ${
        account.display_name || account.handle || provider.label
      }? Scheduled posts to this channel will stop publishing until you reconnect.`,
      confirmText: "Disconnect",
      cancelText: "Keep",
      variant: "danger",
    })
    if (!ok) return
    setBusyPlatform(provider.platform)
    try {
      await api(`/admin/marketing/accounts/${account.id}`, { method: "DELETE" })
      toast.success(`${provider.label} disconnected`)
      await load()
    } catch (e: any) {
      toast.error(`Could not disconnect ${provider.label}`, {
        description: e?.message,
      })
    } finally {
      setBusyPlatform(null)
    }
  }

  const providers = data?.providers ?? []

  return (
    <Container className="divide-y p-0">
      <PageHeader
        icon={Channels}
        accent="slate"
        title="Channels"
        subtitle="Connect your social and messaging accounts to publish scheduled posts and receive messages."
      />

      <div className="px-6 py-6">
        {loading ? (
          <div className="flex items-center gap-x-2 text-ui-fg-subtle">
            <Spinner className="animate-spin" />
            <Text size="small">Loading channels…</Text>
          </div>
        ) : error ? (
          <div className="flex flex-col items-start gap-y-3 rounded-lg border border-ui-border-error bg-ui-bg-subtle p-4">
            <div className="flex items-center gap-x-2 text-ui-fg-error">
              <ExclamationCircle />
              <Text size="small" weight="plus">
                {error}
              </Text>
            </div>
            <Button size="small" variant="secondary" onClick={load}>
              <ArrowPath />
              Retry
            </Button>
          </div>
        ) : providers.length === 0 ? (
          <EmptyState
            icon={Channels}
            accent="slate"
            title="No channels available"
            description="Configure a provider in your environment to see it here."
          />
        ) : (
          <div
            className={clx(
              "grid grid-cols-1 gap-4",
              "md:grid-cols-2 xl:grid-cols-3"
            )}
          >
            {providers.map((p) => {
              const account = accountFor(p.platform)
              return (
                <ProviderCard
                  key={p.platform}
                  provider={p}
                  account={account}
                  busy={busyPlatform === p.platform}
                  onConnect={() => handleConnect(p)}
                  onReconnect={() => handleConnect(p)}
                  onRefresh={() => account && handleRefresh(p, account)}
                  onDisconnect={() => account && handleDisconnect(p, account)}
                />
              )
            })}
          </div>
        )}
      </div>

      {pwModal && (
        <AppPasswordModal
          provider={pwModal}
          open={!!pwModal}
          onOpenChange={(v) => {
            if (!v) setPwModal(null)
          }}
          onSubmit={submitAppPassword}
          busy={modalBusy}
        />
      )}

      {whModal && (
        <WebhookModal
          provider={whModal}
          open={!!whModal}
          onOpenChange={(v) => {
            if (!v) setWhModal(null)
          }}
          onSubmit={submitWebhook}
          busy={modalBusy}
        />
      )}
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Connect",
  icon: Channels,
})

export default ConnectPage
