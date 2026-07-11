import { resolveTenantId } from "../../../../../lib/tenant-context"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { MARKETING_MODULE } from "../../../../../modules/marketing"
import { ensurePlatformEnv } from "../../../../../modules/marketing/platform-credentials"
import {
  getPublishProvider,
  sealCredentials,
} from "../../../../../modules/marketing/publish"
import { startOAuth } from "../../../../../modules/marketing/oauth/service"
import { toAccountDto } from "../_dto"

const TENANT_ID = resolveTenantId("MARKETING_DEFAULT_TENANT")

const statusFor = (e: any): number => {
  if (e?.type === MedusaError.Types.INVALID_DATA) return 400
  if (e?.type === MedusaError.Types.NOT_ALLOWED) return 403
  if (e?.type === MedusaError.Types.NOT_FOUND) return 404
  return 500
}

const first = <T>(v: T | T[]): T => (Array.isArray(v) ? v[0] : v)

/**
 * POST /admin/marketing/accounts/connect
 *
 * Start (or complete, for token-based platforms) connecting an account.
 *  - oauth      → { auth_url } to redirect the admin to the provider consent.
 *  - app_password (wordpress) → creates the account from site_url/username/app_password.
 *  - webhook_token (telegram) → creates the account from bot_token/chat_id.
 * Body: { platform, credentials? }
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  // Ensure platform social APP keys stored by the super-admin are loaded
  // into process.env before the OAuth flow reads them (survives restarts).
  try {
    await ensurePlatformEnv(req.scope)
  } catch {
    /* non-blocking */
  }
  const b = (req.body ?? {}) as Record<string, any>
  const platform = b.platform as string
  const credentials = (b.credentials ?? {}) as Record<string, any>

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
    const userId = (req as any).auth_context?.actor_id ?? null

    const connect = provider.capabilities.connect

    if (connect === "oauth") {
      const { auth_url } = await startOAuth(mk, {
        tenantId: TENANT_ID,
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
        tenant_id: TENANT_ID,
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
        tenantId: TENANT_ID,
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

      const created = await mk.createMarketingSocialAccounts({
        tenant_id: TENANT_ID,
        platform,
        external_id: String(chatId),
        handle: handle ?? String(chatId),
        display_name: handle ?? String(chatId),
        status: "connected",
        connected_by_user_id: userId,
        meta: { chat_id: String(chatId) },
      } as any)
      const account = first(created)

      await sealCredentials(mk, {
        tenantId: TENANT_ID,
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
