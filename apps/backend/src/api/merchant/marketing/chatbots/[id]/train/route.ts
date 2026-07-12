import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../../../modules/marketing"
import MarketingModuleService from "../../../../../../modules/marketing/service"
import { embedChatbotSources } from "../../../../../../modules/marketing/knowledge/rag"
import { resolveMerchant } from "../../../../_helpers"
import { isNotFound, loadOwnedChatbot } from "../../_shared"

/**
 * POST /merchant/marketing/chatbots/:id/train
 *
 * Train (or re-train) ONE chatbot: chunk + embed all of its knowledge sources
 * into `marketing_knowledge_chunk`, so the reply pipeline can retrieve them.
 * This is the merchant-facing door onto `embedChatbotSources` — the same
 * pipeline the auto-reply engine reads from; nothing here is a simulation.
 *
 * SYNCHRONOUS by design. A bot's source count is small (the studio adds them one
 * at a time) and `embedChatbotSources` is idempotent — it drops a source's old
 * chunks before writing fresh ones, so a retry can never duplicate context.
 * Running it inline keeps the studio honest: when the call returns, the counts it
 * reports are the counts that are actually in the database.
 *
 * It never throws: a source that cannot be embedded is marked `failed` with the
 * reason on its row, and the bot ends `trained` if at least one source embedded,
 * else `not_trained`. A whole-run failure (for example: no embedding API key)
 * comes back as `error` with 0 embedded — a 200 carrying an honest failure, not
 * a lie about success.
 *
 * Tenant-scoped: a bot outside the caller's tenant 404s.
 * Response: { chatbot, training: { sources, embedded, failed, chunks,
 *             training_status, error? }, data }
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const tenantId = ctx.tenant.id
  const { id } = req.params

  try {
    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)

    const owned = await loadOwnedChatbot(svc, id, tenantId, res)
    if (!owned) return

    // embedChatbotSources flips training_status to "training" while it runs and
    // to trained/not_trained when it finishes; it re-verifies tenant ownership
    // itself, so this is fail-closed twice over.
    const training = await embedChatbotSources(req.scope, tenantId, id)

    // Report the persisted truth, not the in-flight guess.
    const chatbot = await (svc as any)
      .retrieveMarketingChatbot(id)
      .catch(() => owned)
    const data = await (svc as any)
      .listMarketingChatbotData(
        { tenant_id: tenantId, chatbot_id: id },
        { take: 1000, order: { created_at: "DESC" } }
      )
      .catch(() => [])

    res.json({ chatbot, training, data })
  } catch (e: any) {
    res.status(isNotFound(e) ? 404 : 500).json({
      message: e?.message ?? "Failed to train chatbot",
    })
  }
}
