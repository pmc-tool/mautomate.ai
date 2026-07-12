import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import crypto from "crypto"
import { MARKETING_MODULE } from "../../../../modules/marketing"
import MarketingModuleService from "../../../../modules/marketing/service"
import { resolveMerchant } from "../../_helpers"
import { DATA_KINDS, parseChatbotFields } from "./_shared"

/**
 * GET /merchant/marketing/chatbots
 *
 * Merchant-scoped list of chatbots. Query params: limit, offset.
 * Response: { chatbots, count, limit, offset }
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const tenantId = ctx.tenant.id
  const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)

  try {
    const limit = parseInt((req.query.limit as string) ?? "50")
    const offset = parseInt((req.query.offset as string) ?? "0")

    const [chatbots, count] = await svc.listAndCountMarketingChatbots(
      { tenant_id: tenantId },
      {
        take: limit,
        skip: offset,
        order: { created_at: "DESC" },
      }
    )

    res.json({ chatbots, count, limit, offset })
  } catch (e: any) {
    res.status(500).json({
      message: e?.message ?? "Failed to list chatbots",
    })
  }
}

/**
 * POST /merchant/marketing/chatbots
 *
 * Create a merchant-scoped chatbot with a freshly generated `public_key`.
 * Accepts the full studio surface (persona, appearance, feature toggles,
 * dimensions) via `parseChatbotFields`, so the wizard's "create then configure"
 * flow and a one-shot API create both work. Optionally seeds knowledge sources
 * via `data`. Every created row is tagged with the caller's tenant_id.
 *
 * Body: { name, ...chatbot fields, data? }
 * Response: { chatbot, data }
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const tenantId = ctx.tenant.id
  const b = (req.body ?? {}) as Record<string, any>

  try {
    const parsed = parseChatbotFields(b)
    if (!parsed.ok) {
      return res.status(400).json({ message: parsed.message })
    }
    if (!parsed.data.name) {
      return res.status(400).json({ message: "A chatbot `name` is required." })
    }

    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)

    const created = await svc.createMarketingChatbots({
      tenant_id: tenantId,
      // Column defaults cover everything the caller did not send.
      //
      // reply_mode defaults to "auto": a new bot ANSWERS. It used to default to
      // "draft", which — combined with the storefront mounting the widget on
      // `active` alone — put a chat bubble on the store that never replied to a
      // customer (the reply only ever appeared in the merchant's inbox as a
      // suggestion). "draft" is a deliberate human-in-the-loop choice the studio
      // offers explicitly; it is never the silent default.
      reply_mode: "auto",
      active: true,
      ...parsed.data,
      public_key: crypto.randomBytes(12).toString("hex"),
      training_status: "not_trained",
    } as any)

    const chatbot = Array.isArray(created) ? created[0] : created

    // Bind the bot to the storefront widget channel, switched ON. This binding
    // is the merchant's real on/off switch for "the assistant appears on my
    // website" (/tenant-config reads it, fail-closed), so a bot created without
    // one would never show up. Best-effort: a binding failure must not fail the
    // create — the studio's Channels step can always create it.
    try {
      await (svc as any).createMarketingChatbotChannels({
        tenant_id: tenantId,
        chatbot_id: (chatbot as any).id,
        channel: "web_widget",
        social_account_id: null,
        active: true,
        config: null,
      })
    } catch {
      // Swallowed by design: see above.
    }

    // Optionally seed knowledge sources. Each row is tenant-tagged and starts
    // `pending` — it only counts as knowledge once /train embeds it.
    let data: any[] = []
    if (Array.isArray(b.data) && b.data.length) {
      const rows = b.data
        .map((d: any) => {
          const kind = (d?.kind ?? "faq").trim()
          if (!(DATA_KINDS as readonly string[]).includes(kind)) return null
          const content = d?.content?.trim()
          const source = d?.source?.trim()
          if (!content && !source) return null
          return {
            tenant_id: tenantId,
            chatbot_id: (chatbot as any).id,
            kind,
            content: content ? content : null,
            source: source ? source : null,
            embedding_ref: null,
          }
        })
        .filter(Boolean)
      if (rows.length) {
        const createdData = await (svc as any).createMarketingChatbotData(rows)
        data = Array.isArray(createdData) ? createdData : [createdData]
      }
    }

    res.status(201).json({ chatbot, data })
  } catch (e: any) {
    res.status(500).json({
      message: e?.message ?? "Failed to create chatbot",
    })
  }
}
