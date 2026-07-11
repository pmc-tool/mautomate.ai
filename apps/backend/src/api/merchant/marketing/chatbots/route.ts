import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import crypto from "crypto"
import { MARKETING_MODULE } from "../../../../modules/marketing"
import MarketingModuleService from "../../../../modules/marketing/service"
import { resolveMerchant } from "../../_helpers"

const REPLY_MODES = ["draft", "auto"] as const
const DATA_KINDS = ["faq", "url", "product_catalog", "file", "blog"] as const

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
 * Optionally seed knowledge sources via `data` (array of { kind, content?,
 * source? }). Every created row is tagged with the caller's tenant_id.
 * Body: { name, greeting?, agent_id?, reply_mode?, channel_config?, data? }
 * Response: { chatbot, data }
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const tenantId = ctx.tenant.id
  const b = (req.body ?? {}) as {
    name?: string
    greeting?: string
    agent_id?: string
    reply_mode?: string
    channel_config?: any
    data?: Array<{ kind?: string; content?: string; source?: string }>
  }

  try {
    const name = b.name?.trim()
    if (!name) {
      return res.status(400).json({ message: "A chatbot `name` is required." })
    }

    const replyMode = (b.reply_mode ?? "draft").trim()
    if (!(REPLY_MODES as readonly string[]).includes(replyMode)) {
      return res.status(400).json({
        message: `Chatbot \`reply_mode\` must be one of: ${REPLY_MODES.join(", ")}.`,
      })
    }

    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)

    const created = await svc.createMarketingChatbots({
      tenant_id: tenantId,
      name,
      greeting: b.greeting?.trim() ? b.greeting.trim() : null,
      agent_id: b.agent_id ?? null,
      reply_mode: replyMode,
      channel_config: b.channel_config ?? null,
      public_key: crypto.randomBytes(12).toString("hex"),
      active: true,
    } as any)

    const chatbot = Array.isArray(created) ? created[0] : created

    // Optionally seed knowledge sources. Each row is tenant-tagged.
    let data: any[] = []
    if (Array.isArray(b.data) && b.data.length) {
      const rows = b.data
        .map((d) => {
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
