import crypto from "crypto"
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { MARKETING_MODULE } from "../../../../../modules/marketing"
import { ensurePlatformEnv } from "../../../../../modules/marketing/platform-credentials"
import {
  getPublishProvider,
  sealCredentials,
} from "../../../../../modules/marketing/publish"
import { startOAuth } from "../../../../../modules/marketing/oauth/service"
import { resolveMerchant } from "../../../_helpers"

const statusFor = (e: any): number => {
  if (e?.type === MedusaError.Types.INVALID_DATA) return 400
  if (e?.type === MedusaError.Types.NOT_ALLOWED) return 403
  if (e?.type === MedusaError.Types.NOT_FOUND) return 404
  return 500
}

const first = <T>(v: T | T[]): T => (Array.isArray(v) ? v[0] : v)

/** Public URL Telegram should deliver this bot's updates to. Mirrors the OAuth
 *  callback base resolution (MARKETING_BACKEND_URL -> MEDUSA_BACKEND_URL). */
const buildTelegramWebhookUrl = (): string => {
  const base =
    process.env.MARKETING_BACKEND_URL ??
    process.env.MEDUSA_BACKEND_URL ??
    "http://localhost:9000"
  return `${base.replace(/\/$/, "")}/marketing-webhooks/telegram`
}

/**
 * Register (or re-register) the bot's Telegram webhook, binding the per-bot
 * `secret_token`. Telegram then presents that token as
 * `x-telegram-bot-api-secret-token` on every inbound update, which the shared
 * ingest matches to the owning tenant (marketing_social_account.meta.webhook_secret).
 * Throws INVALID_DATA on any failure so connect fails closed rather than leaving
 * a bot that can never receive.
 */
const registerTelegramWebhook = async (
  botToken: string,
  secret: string
): Promise<void> => {
  const url = buildTelegramWebhookUrl()
  let resp: Response
  try {
    resp = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        secret_token: secret,
        allowed_updates: ["message"],
      }),
    })
  } catch (e: any) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Could not reach Telegram to register the bot webhook: ${
        e?.message ?? "network error"
      }`
    )
  }

  let data: any = null
  try {
    data = await resp.json()
  } catch {
    data = null
  }

  if (!resp.ok || data?.ok !== true) {
    const desc = data?.description ?? `status ${resp.status}`
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Telegram rejected the webhook registration: ${desc}`
    )
  }
}

const toAccountDto = (row: any) => ({
  id: row.id,
  platform: row.platform,
  handle: row.handle ?? null,
  display_name: row.display_name ?? null,
  avatar_url: row.avatar_url ?? null,
  status: row.status,
  external_id: row.external_id ?? null,
  connected_at: row.created_at ? new Date(row.created_at).toISOString() : null,
})

/**
 * POST /merchant/marketing/accounts/connect
 *
 * Start (or, for token-based platforms, complete) connecting a social account
 * for THIS merchant's tenant.
 *  - oauth        → returns { auth_url } for the provider consent screen. The
 *                   oauth_state row is minted carrying ctx.tenant.id, so the
 *                   public callback attributes the account to THIS merchant.
 *  - app_password (wordpress) → creates the account from
 *                   credentials.{site_url,username,app_password}.
 *  - webhook_token (telegram) → creates the account from
 *                   credentials.{bot_token,chat_id}.
 *
 * Body: { platform, mode?: "system"|"custom", credentials? }
 *
 * NOTE: `mode`/`client_id`/`client_secret` are accepted for forward-compat; the
 * OAuth engine currently authorizes with the platform's SYSTEM app credentials
 * (from env). A platform that is not configured returns a clear 403 rather than
 * a fabricated success.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  // Ensure platform social APP keys stored by the super-admin are loaded
  // into process.env before the OAuth flow reads them (survives restarts).
  try {
    await ensurePlatformEnv(req.scope)
  } catch {
    /* non-blocking */
  }
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const tenantId = ctx.tenant.id
  const b = (req.body ?? {}) as Record<string, any>
  const platform = b.platform as string
  const credentials = (b.credentials ?? {}) as Record<string, any>
  const userId = (req as any).auth_context?.actor_id ?? null

  try {
    if (!platform) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "`platform` is required."
      )
    }

    const provider = getPublishProvider(platform)
    if (!provider) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Unknown platform "${platform}".`
      )
    }

    const mk: any = req.scope.resolve(MARKETING_MODULE)
    const connect = provider.capabilities.connect

    if (connect === "oauth") {
      const { auth_url } = await startOAuth(mk, {
        tenantId,
        platform,
        userId,
      })
      res.json({ auth_url })
      return
    }

    if (connect === "app_password") {
      const siteUrl = credentials.site_url
      const username = credentials.username
      const appPassword = credentials.app_password
      if (!siteUrl || !username || !appPassword) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "`credentials.site_url`, `credentials.username` and `credentials.app_password` are required."
        )
      }

      const created = await mk.createMarketingSocialAccounts({
        tenant_id: tenantId,
        platform,
        external_id: null,
        handle: siteUrl,
        display_name: siteUrl,
        status: "connected",
        connected_by_user_id: userId,
        meta: { site_url: siteUrl, username },
      } as any)
      const account = first(created)

      await sealCredentials(mk, {
        tenantId,
        socialAccountId: account.id,
        accessToken: appPassword,
        tokenType: "app_password",
      })

      res.status(201).json({ account: toAccountDto(account) })
      return
    }

    if (connect === "webhook_token") {
      const botToken = credentials.bot_token
      const chatId = credentials.chat_id
      const handle = credentials.handle ?? null
      if (!botToken || !chatId) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "`credentials.bot_token` and `credentials.chat_id` are required."
        )
      }

      // Per-bot webhook secret: mint a unique secret for THIS bot, register the
      // bot's webhook with Telegram so every inbound update carries it as
      // `x-telegram-bot-api-secret-token`, and store it on the account meta. The
      // shared inbound ingest matches that token to this account -> THIS tenant
      // (meta.webhook_secret); an update whose token matches no bot is dropped
      // (fail closed). Register BEFORE creating the account so a Telegram
      // rejection surfaces as a 400 instead of a half-connected bot.
      const meta: Record<string, any> = { chat_id: String(chatId) }
      if (platform === "telegram") {
        const webhookSecret = crypto.randomBytes(32).toString("hex")
        await registerTelegramWebhook(botToken, webhookSecret)
        meta.webhook_secret = webhookSecret
      }

      const created = await mk.createMarketingSocialAccounts({
        tenant_id: tenantId,
        platform,
        external_id: String(chatId),
        handle: handle ?? String(chatId),
        display_name: handle ?? String(chatId),
        status: "connected",
        connected_by_user_id: userId,
        meta,
      } as any)
      const account = first(created)

      await sealCredentials(mk, {
        tenantId,
        socialAccountId: account.id,
        accessToken: botToken,
        tokenType: "bot_token",
      })

      res.status(201).json({ account: toAccountDto(account) })
      return
    }

    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Platform "${platform}" cannot be connected this way.`
    )
  } catch (e: any) {
    res.status(statusFor(e)).json({
      message: e?.message ?? "Failed to connect account",
    })
  }
}
