import { resolveTenantId } from "../../../../../../lib/tenant-context"
/**
 * POST /admin/marketing/conversations/:id/suggest
 *
 * Draft a grounded AI reply for a conversation. The suggestion is on-brand and
 * grounded in the recent thread + the contact's Customer360 facts; it is never
 * sent, only returned for the agent to edit and send.
 *
 * Response: { suggestion: string, needs_ai: boolean }
 *   needs_ai:true means no AI provider is configured (empty suggestion).
 */

import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../../../modules/marketing"
import { suggestReply } from "../../../../../../modules/marketing/messaging/ai-reply"

const TENANT_ID = resolveTenantId("MARKETING_DEFAULT_TENANT")

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const mk: any = req.scope.resolve(MARKETING_MODULE)
    const { id } = req.params

    const conversation = await mk
      .retrieveMarketingConversation(id)
      .catch(() => null)
    if (!conversation || conversation.tenant_id !== TENANT_ID) {
      res.status(404).json({ message: `Conversation ${id} not found` })
      return
    }

    const { suggestion, needs_ai } = await suggestReply(req.scope, {
      conversationId: id,
      tenantId: TENANT_ID,
    })

    res.json({ suggestion, needs_ai })
  } catch (e: any) {
    res.status(500).json({
      message: e?.message ?? "Failed to generate suggestion",
    })
  }
}
