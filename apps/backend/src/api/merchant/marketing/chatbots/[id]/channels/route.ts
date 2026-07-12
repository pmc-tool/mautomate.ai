import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../../../modules/marketing"
import MarketingModuleService from "../../../../../../modules/marketing/service"
import { resolveMerchant } from "../../../../_helpers"
import { isNotFound, loadOwnedChatbot } from "../../_shared"

/**
 * Chatbot ↔ channel bindings — `/merchant/marketing/chatbots/:id/channels`.
 *
 * A binding (marketing_chatbot_channel) is what makes a bot ANSWER a channel:
 * the inbound runtime (`messaging/auto-reply` -> `resolveChatbot`) looks up the
 * tenant's active binding for the conversation's channel and gives that bot the
 * turn. Without a binding, an inbound Telegram DM is still ingested into the
 * inbox but no AI reply is produced.
 *
 * `social_account_id` names WHICH connected account the binding serves (the
 * Telegram bot, the Facebook page, …). It is validated against the caller's
 * tenant AND against the channel's platform, so a merchant can never bind a bot
 * to another tenant's account or to an account on the wrong platform. It holds
 * no secrets — tokens stay in marketing_social_credential.
 *
 * The (tenant_id, chatbot_id, channel) unique index means one bot serves a
 * channel at most once, so POST is an UPSERT on that key rather than a blind
 * insert (a repeated bind updates the existing row instead of failing).
 *
 * Every read and write is tenant-scoped via `resolveMerchant`; an unknown or
 * cross-tenant chatbot 404s identically.
 */

/** Bindable channels — mirrors marketing_chatbot_channel.channel. */
const CHANNELS = [
  "web_widget",
  "whatsapp",
  "messenger",
  "instagram",
  "telegram",
] as const

/**
 * channel -> the marketing_social_account.platform that may back it. `null` =
 * the channel has NO external account (web_widget is served by the storefront
 * widget), so `social_account_id` must stay empty.
 */
const CHANNEL_PLATFORM: Record<(typeof CHANNELS)[number], string | null> = {
  web_widget: null,
  whatsapp: "whatsapp",
  messenger: "facebook",
  instagram: "instagram",
  telegram: "telegram",
}

const first = <T>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null)

/**
 * The non-secret identity of the connected account a binding serves, for the
 * UI. Never touches marketing_social_credential.
 */
const toAccountRef = (account: any | null | undefined) =>
  account
    ? {
        id: account.id,
        platform: account.platform,
        display_name: account.display_name ?? null,
        handle: account.handle ?? null,
        status: account.status ?? null,
      }
    : null

const toBindingDto = (row: any) => ({
  id: row.id,
  chatbot_id: row.chatbot_id,
  channel: row.channel,
  social_account_id: row.social_account_id ?? null,
  active: row.active !== false,
  config: row.config ?? null,
  created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
  updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null,
})

/**
 * GET /merchant/marketing/chatbots/:id/channels
 *
 * List the bot's channel bindings (tenant-scoped). Each entry carries the
 * binding itself plus `social_account` — the non-secret identity of the account
 * it serves (null for web_widget, which has no external account). Additive:
 * older callers that only read the binding fields keep working.
 * Response: { channels }
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const tenantId = ctx.tenant.id
  const { id } = req.params

  try {
    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)

    const chatbot = await loadOwnedChatbot(svc, id, tenantId, res)
    if (!chatbot) return

    const rows = await (svc as any).listMarketingChatbotChannels(
      { tenant_id: tenantId, chatbot_id: id },
      { take: 100, order: { created_at: "DESC" } }
    )
    const bindings = Array.isArray(rows) ? rows : []

    // Resolve the connected account behind each binding so the UI can name it
    // ("Answered on @mystorebot") without a second round trip. Tenant-scoped:
    // only THIS tenant's accounts are ever looked at, and no credential column
    // is read.
    const accountIds = Array.from(
      new Set(
        bindings
          .map((r: any) => r.social_account_id)
          .filter((v: any): v is string => typeof v === "string" && !!v)
      )
    )
    const accountById = new Map<string, any>()
    if (accountIds.length) {
      const accounts = await (svc as any)
        .listMarketingSocialAccounts(
          { tenant_id: tenantId, id: accountIds },
          { take: accountIds.length }
        )
        .catch(() => [])
      for (const a of Array.isArray(accounts) ? accounts : []) {
        accountById.set(a.id, a)
      }
    }

    res.json({
      channels: bindings.map((row: any) => ({
        ...toBindingDto(row),
        social_account: toAccountRef(accountById.get(row.social_account_id)),
      })),
    })
  } catch (e: any) {
    res.status(isNotFound(e) ? 404 : 500).json({
      message: e?.message ?? "Failed to list chatbot channels",
    })
  }
}

/**
 * POST /merchant/marketing/chatbots/:id/channels
 *
 * Bind the bot to a channel, or update the existing binding for that channel
 * (upsert on the unique (tenant, chatbot, channel) key).
 *
 * Body: { channel, social_account_id?, active?, config? }
 * Response: { channel }  (201 on create, 200 on update)
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const tenantId = ctx.tenant.id
  const { id } = req.params
  const b = (req.body ?? {}) as Record<string, any>

  try {
    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)

    const chatbot = await loadOwnedChatbot(svc, id, tenantId, res)
    if (!chatbot) return

    const channel = String(b.channel ?? "").trim()
    if (!(CHANNELS as readonly string[]).includes(channel)) {
      return res.status(400).json({
        message: `\`channel\` must be one of: ${CHANNELS.join(", ")}.`,
      })
    }

    const platform = CHANNEL_PLATFORM[channel as (typeof CHANNELS)[number]]

    // Validate the account fail-closed: it must exist, belong to THIS tenant and
    // sit on the platform that backs this channel.
    let socialAccountId: string | null = null
    if (b.social_account_id !== undefined && b.social_account_id !== null) {
      const accountId = String(b.social_account_id).trim()
      if (accountId) {
        if (platform === null) {
          return res.status(400).json({
            message: `Channel "${channel}" is not backed by a connected account.`,
          })
        }
        const account = await (svc as any)
          .retrieveMarketingSocialAccount(accountId)
          .catch(() => null)
        if (!account || account.tenant_id !== tenantId) {
          return res
            .status(404)
            .json({ message: `Account ${accountId} was not found` })
        }
        if (account.platform !== platform) {
          return res.status(400).json({
            message: `Account ${accountId} is a "${account.platform}" account and cannot serve the "${channel}" channel.`,
          })
        }
        socialAccountId = account.id
      }
    }

    const active = b.active === undefined ? true : b.active === true
    const config = b.config === undefined ? null : (b.config ?? null)

    const existing = first(
      await (svc as any).listMarketingChatbotChannels(
        { tenant_id: tenantId, chatbot_id: id, channel },
        { take: 1 }
      )
    )

    if (existing) {
      const updated = await (svc as any).updateMarketingChatbotChannels({
        id: (existing as any).id,
        social_account_id: socialAccountId,
        active,
        config,
      })
      res.json({ channel: toBindingDto(first(updated)) })
      return
    }

    const created = await (svc as any).createMarketingChatbotChannels({
      tenant_id: tenantId,
      chatbot_id: id,
      channel,
      social_account_id: socialAccountId,
      active,
      config,
    })

    res.status(201).json({ channel: toBindingDto(first(created)) })
  } catch (e: any) {
    res.status(isNotFound(e) ? 404 : 500).json({
      message: e?.message ?? "Failed to bind chatbot channel",
    })
  }
}

/**
 * DELETE /merchant/marketing/chatbots/:id/channels?channel=telegram
 *
 * Unbind the bot from one channel. The bot then stops answering that channel;
 * inbound messages still land in the inbox for a human.
 * Response: { id, object, deleted }
 */
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const tenantId = ctx.tenant.id
  const { id } = req.params
  const channel = String(
    (req.query?.channel as string) ?? (req.body as any)?.channel ?? ""
  ).trim()

  try {
    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)

    const chatbot = await loadOwnedChatbot(svc, id, tenantId, res)
    if (!chatbot) return

    if (!(CHANNELS as readonly string[]).includes(channel)) {
      return res.status(400).json({
        message: `\`channel\` must be one of: ${CHANNELS.join(", ")}.`,
      })
    }

    const existing = first(
      await (svc as any).listMarketingChatbotChannels(
        { tenant_id: tenantId, chatbot_id: id, channel },
        { take: 1 }
      )
    )
    if (!existing) {
      return res
        .status(404)
        .json({ message: `Chatbot ${id} is not bound to "${channel}"` })
    }

    await (svc as any).deleteMarketingChatbotChannels((existing as any).id)

    res.json({
      id: (existing as any).id,
      object: "marketing_chatbot_channel",
      deleted: true,
    })
  } catch (e: any) {
    res.status(isNotFound(e) ? 404 : 500).json({
      message: e?.message ?? "Failed to unbind chatbot channel",
    })
  }
}
