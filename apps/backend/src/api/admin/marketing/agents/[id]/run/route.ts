import { resolveTenantId } from "../../../../../../lib/tenant-context"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { MARKETING_MODULE } from "../../../../../../modules/marketing"
import { runAgent } from "../../../../../../modules/marketing/agents/run-agent"

const TENANT_ID = resolveTenantId("MARKETING_DEFAULT_TENANT")

const isNotFound = (e: any): boolean =>
  e?.type === "not_found" || /was not found|not found/i.test(e?.message ?? "")

/**
 * POST /admin/marketing/agents/:id/run
 *
 * "Test in playground" endpoint: run the agent (grounded in brand context and,
 * when a `chatbot_id` is given, that chatbot's knowledge base) against `input`.
 * Body: { input, product_ids?, chatbot_id? }
 * Response: { output, needs_ai, used_knowledge }
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params
  const b = (req.body ?? {}) as {
    input?: string
    product_ids?: string[]
    chatbot_id?: string
  }

  try {
    const input = b.input?.trim()
    if (!input) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "An `input` is required to run the agent."
      )
    }

    const svc: any = req.scope.resolve(MARKETING_MODULE)

    // Verify the agent exists and belongs to this tenant before running.
    const agent = await svc.retrieveMarketingAgent(id)
    if (agent.tenant_id !== TENANT_ID) {
      res.status(404).json({ message: `Agent ${id} was not found` })
      return
    }

    const result = await runAgent(req.scope, {
      tenantId: TENANT_ID,
      agentId: id,
      input,
      chatbotId: b.chatbot_id?.trim() || undefined,
      productIds: Array.isArray(b.product_ids) ? b.product_ids : undefined,
    })

    res.json({
      output: result.output,
      needs_ai: result.needs_ai,
      used_knowledge: result.used_knowledge ?? [],
    })
  } catch (e: any) {
    const status = e?.type === MedusaError.Types.INVALID_DATA ? 400 : 500
    res.status(isNotFound(e) ? 404 : status).json({
      message: e?.message ?? "Failed to run agent",
    })
  }
}
