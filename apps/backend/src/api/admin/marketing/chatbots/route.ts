import { resolveTenantId } from "../../../../lib/tenant-context"
import crypto from "crypto"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { MARKETING_MODULE } from "../../../../modules/marketing"

const TENANT_ID = resolveTenantId("MARKETING_DEFAULT_TENANT")

const REPLY_MODES = ["draft", "auto"] as const

/**
 * GET /admin/marketing/chatbots
 *
 * Paginated list of chatbots, tenant-scoped.
 * Response: { chatbots, count, limit, offset }
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const svc: any = req.scope.resolve(MARKETING_MODULE)

    const limit = parseInt((req.query.limit as string) ?? "50")
    const offset = parseInt((req.query.offset as string) ?? "0")

    const [chatbots, count] = await svc.listAndCountMarketingChatbots(
      { tenant_id: TENANT_ID },
      { take: limit, skip: offset, order: { created_at: "DESC" } }
    )

    res.json({ chatbots, count, limit, offset })
  } catch (e: any) {
    res.status(500).json({
      message: e?.message ?? "Failed to list chatbots",
    })
  }
}

/**
 * POST /admin/marketing/chatbots
 *
 * Create a chatbot with a freshly generated `public_key` (24 hex chars).
 * Body: { name, greeting?, agent_id?, reply_mode?, channel_config? }
 * Response: { chatbot }
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const b = (req.body ?? {}) as {
    name?: string
    greeting?: string
    agent_id?: string
    reply_mode?: string
    channel_config?: any
  }

  try {
    const name = b.name?.trim()
    if (!name) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "A chatbot `name` is required."
      )
    }

    const replyMode = (b.reply_mode ?? "draft").trim()
    if (!(REPLY_MODES as readonly string[]).includes(replyMode)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Chatbot \`reply_mode\` must be one of: ${REPLY_MODES.join(", ")}.`
      )
    }

    const svc: any = req.scope.resolve(MARKETING_MODULE)

    const created = await svc.createMarketingChatbots({
      tenant_id: TENANT_ID,
      name,
      greeting: b.greeting?.trim() ? b.greeting.trim() : null,
      agent_id: b.agent_id ?? null,
      reply_mode: replyMode,
      channel_config: b.channel_config ?? null,
      public_key: crypto.randomBytes(12).toString("hex"),
      active: true,
    })

    const chatbot = Array.isArray(created) ? created[0] : created

    res.status(201).json({ chatbot })
  } catch (e: any) {
    const status = e?.type === MedusaError.Types.INVALID_DATA ? 400 : 500
    res.status(status).json({
      message: e?.message ?? "Failed to create chatbot",
    })
  }
}
