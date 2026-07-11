import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../../modules/marketing"
import MarketingModuleService from "../../../../../modules/marketing/service"
import { resolveMerchant } from "../../../_helpers"

const REPLY_MODES = ["draft", "auto"] as const

const isNotFound = (e: any): boolean =>
  e?.type === "not_found" || /was not found|not found/i.test(e?.message ?? "")

/**
 * Load a chatbot and assert it belongs to the caller's tenant. Fail-closed and
 * null-safe: a missing row OR any tenant_id that is not strictly equal to the
 * caller's tenant (incl. null/undefined) 404s and returns null.
 */
const loadOwned = async (
  svc: MarketingModuleService,
  id: string,
  tenantId: string,
  res: MedusaResponse
): Promise<any | null> => {
  const chatbot = await (svc as any)
    .retrieveMarketingChatbot(id)
    .catch(() => null)
  if (!chatbot || chatbot.tenant_id !== tenantId) {
    res.status(404).json({ message: `Chatbot ${id} was not found` })
    return null
  }
  return chatbot
}

/**
 * GET /merchant/marketing/chatbots/:id
 *
 * Retrieve a chatbot plus its knowledge-base data rows (newest first).
 * Tenant-scoped. Response: { chatbot, data }
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const tenantId = ctx.tenant.id
  const { id } = req.params

  try {
    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)

    const chatbot = await loadOwned(svc, id, tenantId, res)
    if (!chatbot) return

    const data = await (svc as any).listMarketingChatbotData(
      { tenant_id: tenantId, chatbot_id: id },
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
 * PUT /merchant/marketing/chatbots/:id
 *
 * Update a chatbot (tenant-scoped). Only provided fields change.
 * Body: { name?, greeting?, agent_id?, reply_mode?, channel_config?, active? }
 * Response: { chatbot }
 */
export const PUT = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const tenantId = ctx.tenant.id
  const { id } = req.params
  const b = (req.body ?? {}) as Record<string, any>

  try {
    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)

    const current = await loadOwned(svc, id, tenantId, res)
    if (!current) return

    const data: Record<string, any> = {}
    if (b.name !== undefined) {
      const name = String(b.name).trim()
      if (!name) {
        return res
          .status(400)
          .json({ message: "Chatbot `name` cannot be empty." })
      }
      data.name = name
    }
    if (b.greeting !== undefined) data.greeting = b.greeting ?? null
    if (b.agent_id !== undefined) data.agent_id = b.agent_id ?? null
    if (b.reply_mode !== undefined) {
      const replyMode = String(b.reply_mode).trim()
      if (!(REPLY_MODES as readonly string[]).includes(replyMode)) {
        return res.status(400).json({
          message: `Chatbot \`reply_mode\` must be one of: ${REPLY_MODES.join(", ")}.`,
        })
      }
      data.reply_mode = replyMode
    }
    if (b.channel_config !== undefined) {
      data.channel_config = b.channel_config ?? null
    }
    if (b.active !== undefined) data.active = b.active === true

    const updated = await (svc as any).updateMarketingChatbots({ id, ...data })
    const chatbot = Array.isArray(updated) ? updated[0] : updated

    res.json({ chatbot })
  } catch (e: any) {
    res.status(isNotFound(e) ? 404 : 500).json({
      message: e?.message ?? "Failed to update chatbot",
    })
  }
}

/**
 * DELETE /merchant/marketing/chatbots/:id
 *
 * Delete a chatbot (tenant-scoped) and its knowledge-base data rows.
 * Response: { id, object, deleted }
 */
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const tenantId = ctx.tenant.id
  const { id } = req.params

  try {
    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)

    const current = await loadOwned(svc, id, tenantId, res)
    if (!current) return

    const rows = await (svc as any).listMarketingChatbotData(
      { tenant_id: tenantId, chatbot_id: id },
      { take: 1000 }
    )
    const rowIds = (Array.isArray(rows) ? rows : []).map((r: any) => r.id)
    if (rowIds.length) {
      await (svc as any).deleteMarketingChatbotData(rowIds)
    }

    await (svc as any).deleteMarketingChatbots(id)

    res.json({ id, object: "marketing_chatbot", deleted: true })
  } catch (e: any) {
    res.status(isNotFound(e) ? 404 : 500).json({
      message: e?.message ?? "Failed to delete chatbot",
    })
  }
}
