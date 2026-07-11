import { resolveTenantId } from "../../../../../lib/tenant-context"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { MARKETING_MODULE } from "../../../../../modules/marketing"

const TENANT_ID = resolveTenantId("MARKETING_DEFAULT_TENANT")

const REPLY_MODES = ["draft", "auto"] as const

const isNotFound = (e: any): boolean =>
  e?.type === "not_found" || /was not found|not found/i.test(e?.message ?? "")

/** Load a chatbot + verify tenant. Returns null (and 404s) on miss/mismatch. */
const loadChatbot = async (
  svc: any,
  id: string,
  res: MedusaResponse
): Promise<any | null> => {
  const chatbot = await svc.retrieveMarketingChatbot(id)
  if (chatbot.tenant_id !== TENANT_ID) {
    res.status(404).json({ message: `Chatbot ${id} was not found` })
    return null
  }
  return chatbot
}

/**
 * GET /admin/marketing/chatbots/:id
 *
 * Retrieve a chatbot plus its knowledge-base data rows (newest first).
 * Response: { chatbot, data }
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params

  try {
    const svc: any = req.scope.resolve(MARKETING_MODULE)

    const chatbot = await loadChatbot(svc, id, res)
    if (!chatbot) {
      return
    }

    const data = await svc.listMarketingChatbotData(
      { tenant_id: TENANT_ID, chatbot_id: id },
      { take: 1000, order: { created_at: "DESC" } }
    )

    res.json({ chatbot, data })
  } catch (e: any) {
    res.status(isNotFound(e) ? 404 : 500).json({
      message: e?.message ?? "Failed to retrieve chatbot",
    })
  }
}

/**
 * POST /admin/marketing/chatbots/:id
 *
 * Update a chatbot (tenant-scoped).
 * Body: { name?, greeting?, agent_id?, reply_mode?, channel_config?, active? }
 * Response: { chatbot }
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params
  const b = (req.body ?? {}) as Record<string, any>

  try {
    const svc: any = req.scope.resolve(MARKETING_MODULE)

    const current = await loadChatbot(svc, id, res)
    if (!current) {
      return
    }

    const data: Record<string, any> = {}
    if (b.name !== undefined) {
      const name = String(b.name).trim()
      if (!name) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "Chatbot `name` cannot be empty."
        )
      }
      data.name = name
    }
    if (b.greeting !== undefined) {
      data.greeting = b.greeting ?? null
    }
    if (b.agent_id !== undefined) {
      data.agent_id = b.agent_id ?? null
    }
    if (b.reply_mode !== undefined) {
      const replyMode = String(b.reply_mode).trim()
      if (!(REPLY_MODES as readonly string[]).includes(replyMode)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Chatbot \`reply_mode\` must be one of: ${REPLY_MODES.join(", ")}.`
        )
      }
      data.reply_mode = replyMode
    }
    if (b.channel_config !== undefined) {
      data.channel_config = b.channel_config ?? null
    }
    if (b.active !== undefined) {
      data.active = b.active === true
    }

    const updated = await svc.updateMarketingChatbots({ id, ...data })
    const chatbot = Array.isArray(updated) ? updated[0] : updated

    res.json({ chatbot })
  } catch (e: any) {
    const status = e?.type === MedusaError.Types.INVALID_DATA ? 400 : 500
    res.status(isNotFound(e) ? 404 : status).json({
      message: e?.message ?? "Failed to update chatbot",
    })
  }
}

/**
 * DELETE /admin/marketing/chatbots/:id
 *
 * Delete a chatbot (tenant-scoped) and its knowledge-base data rows.
 * Response: { id, object, deleted }
 */
export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params

  try {
    const svc: any = req.scope.resolve(MARKETING_MODULE)

    const current = await loadChatbot(svc, id, res)
    if (!current) {
      return
    }

    const rows = await svc.listMarketingChatbotData(
      { tenant_id: TENANT_ID, chatbot_id: id },
      { take: 1000 }
    )
    const rowIds = (Array.isArray(rows) ? rows : []).map((r: any) => r.id)
    if (rowIds.length) {
      await svc.deleteMarketingChatbotData(rowIds)
    }

    await svc.deleteMarketingChatbots(id)

    res.json({ id, object: "marketing_chatbot", deleted: true })
  } catch (e: any) {
    res.status(isNotFound(e) ? 404 : 500).json({
      message: e?.message ?? "Failed to delete chatbot",
    })
  }
}
