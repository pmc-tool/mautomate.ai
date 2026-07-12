import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../../../modules/marketing"
import MarketingModuleService from "../../../../../../modules/marketing/service"
import { generateTestReply } from "../../../../../../modules/marketing/messaging/ai-reply"
import type { TestReplyTurn } from "../../../../../../modules/marketing/messaging/ai-reply"
import { withTenant } from "../../../../../../lib/tenant-context"
import { resolveMerchant } from "../../../../_helpers"
import { isNotFound, loadOwnedChatbot } from "../../_shared"

/** Mirrors the public widget's per-message ceiling. */
const MAX_TEXT_LENGTH = 2000
const MAX_HISTORY = 20

/**
 * POST /merchant/marketing/chatbots/:id/test-chat
 *
 * Ask the bot a question from inside the dashboard and get its REAL answer: the
 * same persona, the same brand voice, the same scope lock, and the same trained
 * knowledge retrieval the live pipeline uses (`generateTestReply` shares
 * `personaSection` / `buildReplySystem` / `retrieveContext` with
 * `generateAutoReply`).
 *
 * The deliberate difference from the public widget: this creates NOTHING. No
 * conversation, no message rows, no contact — so a merchant can test a bot fifty
 * times without polluting their inbox, and a test can never be mistaken for a
 * customer thread. The conversation history is therefore supplied by the caller
 * rather than read from the database.
 *
 * Tenant-scoped: a bot outside the caller's tenant 404s. The generation runs
 * inside `withTenant` so brand-context / knowledge lookups resolve to the
 * merchant's own tenant and nothing else.
 *
 * Body: { message, history?: [{ role: "user" | "assistant", text }] }
 * Response: { reply, used_knowledge, needs_ai, training_status }
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const tenantId = ctx.tenant.id
  const { id } = req.params
  const b = (req.body ?? {}) as {
    message?: string
    history?: Array<{ role?: string; text?: string }>
  }

  try {
    const message = (b.message ?? "").toString().trim().slice(0, MAX_TEXT_LENGTH)
    if (!message) {
      return res.status(400).json({ message: "A `message` is required." })
    }

    const history: TestReplyTurn[] = (Array.isArray(b.history) ? b.history : [])
      .slice(-MAX_HISTORY)
      .map((t) => ({
        role: t?.role === "assistant" ? ("assistant" as const) : ("user" as const),
        text: (t?.text ?? "").toString().slice(0, MAX_TEXT_LENGTH),
      }))
      .filter((t) => t.text.trim().length > 0)

    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)

    const chatbot = await loadOwnedChatbot(svc, id, tenantId, res)
    if (!chatbot) return

    const result = await withTenant(tenantId, () =>
      generateTestReply(req.scope, {
        tenantId,
        chatbot,
        message,
        history,
      })
    )

    res.json({
      reply: result.reply,
      used_knowledge: result.used_knowledge,
      needs_ai: result.needs_ai,
      training_status: chatbot.training_status ?? "not_trained",
    })
  } catch (e: any) {
    res.status(isNotFound(e) ? 404 : 500).json({
      message: e?.message ?? "Failed to generate a test reply",
    })
  }
}
