import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../modules/marketing"
import { getMessagingProvider } from "../../../../modules/marketing/messaging"
import { resolveMerchant } from "../../_helpers"

/**
 * GET /merchant/marketing/channels — the tenant's messaging channel map.
 *
 * One call answers every question the Channels UI (chatbot studio + connect
 * page) has to ask:
 *   - `channels`   which channels this platform install can actually run, WHY
 *                  not when it cannot, and which of the tenant's connected
 *                  accounts can back each one,
 *   - `chatbots`   the tenant's assistants (for the "answered by" picker),
 *   - `bindings`   every chatbot-channel binding the tenant has, so the UI can
 *                  show, per account, which assistant answers it.
 *
 * AVAILABILITY IS HONEST, NOT ASPIRATIONAL. It is computed from the messaging
 * provider's own `isConfigured()`: the Meta channels (messenger, instagram,
 * whatsapp) need operator-level app keys (MARKETING_*_APP_SECRET +
 * MARKETING_*_VERIFY_TOKEN) and Facebook app review, so until those exist the
 * UI renders the card disabled with the reason below rather than a button that
 * cannot work. Telegram needs nothing operator-side (the merchant brings their
 * own bot token) and the web widget is always available.
 *
 * MULTI-TENANT: every row read here is filtered by the caller's tenant_id, and
 * no credential column is ever touched (tokens live in
 * marketing_social_credential, not marketing_social_account).
 */

/** channel -> the marketing_social_account.platform that can back it. */
const CHANNEL_PLATFORM: Record<string, string | null> = {
  web_widget: null,
  telegram: "telegram",
  messenger: "facebook",
  instagram: "instagram",
  whatsapp: "whatsapp",
}

/** The channels the UI offers, in the order it should show them. */
const CHANNELS: Array<{
  channel: string
  label: string
  description: string
}> = [
  {
    channel: "web_widget",
    label: "Website chat",
    description:
      "The chat bubble on your storefront and on any site you paste the embed snippet into.",
  },
  {
    channel: "telegram",
    label: "Telegram",
    description: "Answer people who message your Telegram bot.",
  },
  {
    channel: "messenger",
    label: "Facebook Messenger",
    description: "Answer people who message your Facebook Page.",
  },
  {
    channel: "instagram",
    label: "Instagram",
    description: "Answer Instagram direct messages.",
  },
  {
    channel: "whatsapp",
    label: "WhatsApp",
    description: "Answer people who message your WhatsApp business number.",
  },
]

/**
 * Why a channel is not available. Only reached when the provider reports
 * `isConfigured() === false`, which for every Meta channel means the operator
 * has not supplied the app secret + verify token (and Facebook has not approved
 * the app for messaging permissions).
 */
const UNAVAILABLE_REASON: Record<string, string> = {
  messenger:
    "Not available yet - awaiting Facebook app approval and the operator adding the Messenger app keys.",
  instagram:
    "Not available yet - awaiting Facebook app approval and the operator adding the Instagram app keys.",
  whatsapp:
    "Not available yet - awaiting WhatsApp Business approval and the operator adding the WhatsApp Cloud API keys.",
}

const FALLBACK_REASON =
  "Not available yet - this channel needs operator setup before it can be used."

const toAccountRef = (row: any) => ({
  id: row.id,
  platform: row.platform,
  display_name: row.display_name ?? null,
  handle: row.handle ?? null,
  status: row.status ?? null,
})

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const tenantId = ctx.tenant.id
  const mk: any = req.scope.resolve(MARKETING_MODULE)

  try {
    const [accountRows, chatbotRows, bindingRows] = await Promise.all([
      mk
        .listMarketingSocialAccounts(
          { tenant_id: tenantId },
          { take: 200, order: { created_at: "DESC" } }
        )
        .catch(() => []),
      mk
        .listMarketingChatbots(
          { tenant_id: tenantId },
          { take: 200, order: { created_at: "DESC" } }
        )
        .catch(() => []),
      mk
        .listMarketingChatbotChannels(
          { tenant_id: tenantId },
          { take: 500, order: { created_at: "DESC" } }
        )
        .catch(() => []),
    ])

    const accounts = (Array.isArray(accountRows) ? accountRows : []).map(
      toAccountRef
    )
    const chatbots = (Array.isArray(chatbotRows) ? chatbotRows : []).map(
      (b: any) => ({
        id: b.id,
        name: b.name,
        active: b.active !== false,
        reply_mode: b.reply_mode,
        public_key: b.public_key ?? null,
      })
    )
    const nameById = new Map(chatbots.map((b: any) => [b.id, b.name]))

    const bindings = (Array.isArray(bindingRows) ? bindingRows : []).map(
      (r: any) => ({
        id: r.id,
        chatbot_id: r.chatbot_id,
        chatbot_name: nameById.get(r.chatbot_id) ?? null,
        channel: r.channel,
        social_account_id: r.social_account_id ?? null,
        active: r.active !== false,
      })
    )

    const channels = CHANNELS.map((c) => {
      const provider = getMessagingProvider(c.channel)
      const available = provider ? provider.isConfigured() : false
      const platform = CHANNEL_PLATFORM[c.channel] ?? null
      return {
        channel: c.channel,
        label: c.label,
        description: c.description,
        available,
        reason: available
          ? null
          : (UNAVAILABLE_REASON[c.channel] ?? FALLBACK_REASON),
        /** A channel with a platform is served by a connected account. */
        requires_account: platform !== null,
        account_platform: platform,
        accounts: platform
          ? accounts.filter((a: any) => a.platform === platform)
          : [],
      }
    })

    res.json({ channels, chatbots, bindings })
  } catch (e: any) {
    res.status(500).json({
      message: e?.message ?? "Failed to load messaging channels",
    })
  }
}
