import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../../modules/marketing"
import MarketingModuleService from "../../../../../modules/marketing/service"
import { resolveMerchant } from "../../../_helpers"
import { isNotFound, loadOwnedChatbot, parseChatbotFields } from "../_shared"

/**
 * GET /merchant/marketing/chatbots/:id
 *
 * Retrieve a chatbot plus its knowledge sources (newest first), tenant-scoped.
 * Response: { chatbot, data }
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
 * Update a chatbot (tenant-scoped). Only the fields present in the body change,
 * which is what makes the studio's per-step autosave safe: saving step 2 cannot
 * blank a value owned by step 1. Accepts the full editable surface — persona
 * (instructions / dont_go_beyond / language / messages), appearance (avatar /
 * color / position / logo / datetime / dimensions), feature toggles and
 * reply_mode / active. `training_status` is NOT settable here: only /train moves it.
 *
 * Response: { chatbot }
 */
export const PUT = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const tenantId = ctx.tenant.id
  const { id } = req.params

  try {
    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)

    const current = await loadOwnedChatbot(svc, id, tenantId, res)
    if (!current) return

    const parsed = parseChatbotFields((req.body ?? {}) as Record<string, any>)
    if (!parsed.ok) {
      return res.status(400).json({ message: parsed.message })
    }

    const updated = await (svc as any).updateMarketingChatbots({
      id,
      ...parsed.data,
    })
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
 * Delete a chatbot (tenant-scoped), its knowledge sources, and the embedded
 * chunks those sources produced — otherwise a deleted bot's vectors would
 * outlive it in marketing_knowledge_chunk.
 * Response: { id, object, deleted }
 */
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const tenantId = ctx.tenant.id
  const { id } = req.params

  try {
    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)

    const current = await loadOwnedChatbot(svc, id, tenantId, res)
    if (!current) return

    const rows = await (svc as any).listMarketingChatbotData(
      { tenant_id: tenantId, chatbot_id: id },
      { take: 1000 }
    )
    const rowIds = (Array.isArray(rows) ? rows : []).map((r: any) => r.id)
    if (rowIds.length) {
      await (svc as any).deleteMarketingChatbotData(rowIds)
    }

    // The bot's channel bindings die with it. Leaving them behind would keep an
    // "active" binding pointing at a bot that no longer exists — noise in the
    // channel map, and a channel that looks answered but is not.
    const channels = await (svc as any)
      .listMarketingChatbotChannels(
        { tenant_id: tenantId, chatbot_id: id },
        { take: 100 }
      )
      .catch(() => [])
    const channelIds = (Array.isArray(channels) ? channels : []).map(
      (c: any) => c.id
    )
    if (channelIds.length) {
      await (svc as any).deleteMarketingChatbotChannels(channelIds)
    }

    // The bot's embedded knowledge is owned by the bot (owner_id = its id).
    const chunks = await (svc as any)
      .listMarketingKnowledgeChunks(
        { tenant_id: tenantId, owner_id: id },
        { take: 5000 }
      )
      .catch(() => [])
    const chunkIds = (Array.isArray(chunks) ? chunks : []).map((c: any) => c.id)
    if (chunkIds.length) {
      await (svc as any).deleteMarketingKnowledgeChunks(chunkIds).catch(() => {})
    }

    await (svc as any).deleteMarketingChatbots(id)

    res.json({ id, object: "marketing_chatbot", deleted: true })
  } catch (e: any) {
    res.status(isNotFound(e) ? 404 : 500).json({
      message: e?.message ?? "Failed to delete chatbot",
    })
  }
}
