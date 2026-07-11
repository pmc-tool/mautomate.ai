import { resolveTenantId } from "../../../../../../lib/tenant-context"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { MARKETING_MODULE } from "../../../../../../modules/marketing"

const TENANT_ID = resolveTenantId("MARKETING_DEFAULT_TENANT")

const DATA_KINDS = ["faq", "url", "product_catalog", "file", "blog"] as const

const isNotFound = (e: any): boolean =>
  e?.type === "not_found" || /was not found|not found/i.test(e?.message ?? "")

/** Verify the chatbot exists and is in this tenant. 404s and returns false on miss. */
const assertChatbot = async (
  svc: any,
  id: string,
  res: MedusaResponse
): Promise<boolean> => {
  const chatbot = await svc.retrieveMarketingChatbot(id)
  if (chatbot.tenant_id !== TENANT_ID) {
    res.status(404).json({ message: `Chatbot ${id} was not found` })
    return false
  }
  return true
}

/**
 * GET /admin/marketing/chatbots/:id/data
 *
 * List a chatbot's knowledge-base data rows (newest first), tenant-scoped.
 * Response: { data, count }
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params

  try {
    const svc: any = req.scope.resolve(MARKETING_MODULE)

    if (!(await assertChatbot(svc, id, res))) {
      return
    }

    const [data, count] = await svc.listAndCountMarketingChatbotData(
      { tenant_id: TENANT_ID, chatbot_id: id },
      { take: 1000, order: { created_at: "DESC" } }
    )

    res.json({ data, count })
  } catch (e: any) {
    res.status(isNotFound(e) ? 404 : 500).json({
      message: e?.message ?? "Failed to list chatbot data",
    })
  }
}

/**
 * POST /admin/marketing/chatbots/:id/data
 *
 * Add a knowledge-base entry to a chatbot.
 * Body: { kind, content, source? }
 * Response: { data }
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params
  const b = (req.body ?? {}) as {
    kind?: string
    content?: string
    source?: string
  }

  try {
    const kind = (b.kind ?? "faq").trim()
    if (!(DATA_KINDS as readonly string[]).includes(kind)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Data \`kind\` must be one of: ${DATA_KINDS.join(", ")}.`
      )
    }

    const content = b.content?.trim()
    const source = b.source?.trim()
    if (!content && !source) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "A knowledge entry needs `content` or a `source`."
      )
    }

    const svc: any = req.scope.resolve(MARKETING_MODULE)

    if (!(await assertChatbot(svc, id, res))) {
      return
    }

    const created = await svc.createMarketingChatbotData({
      tenant_id: TENANT_ID,
      chatbot_id: id,
      kind,
      content: content ? content : null,
      source: source ? source : null,
      embedding_ref: null,
    })

    const data = Array.isArray(created) ? created[0] : created

    res.status(201).json({ data })
  } catch (e: any) {
    const status = e?.type === MedusaError.Types.INVALID_DATA ? 400 : 500
    res.status(isNotFound(e) ? 404 : status).json({
      message: e?.message ?? "Failed to add chatbot data",
    })
  }
}

/**
 * DELETE /admin/marketing/chatbots/:id/data?data_id=...
 *
 * Delete a single knowledge-base entry from a chatbot (tenant-scoped).
 * Response: { id, object, deleted }
 */
export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params
  const dataId = (req.query.data_id as string) ?? ""

  try {
    if (!dataId) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "A `data_id` query param is required to delete a knowledge entry."
      )
    }

    const svc: any = req.scope.resolve(MARKETING_MODULE)

    if (!(await assertChatbot(svc, id, res))) {
      return
    }

    // Confirm the row belongs to this chatbot + tenant before deleting.
    const rows = await svc.listMarketingChatbotData(
      { tenant_id: TENANT_ID, chatbot_id: id, id: dataId },
      { take: 1 }
    )
    const row = Array.isArray(rows) ? rows[0] : null
    if (!row) {
      res.status(404).json({ message: `Chatbot data ${dataId} was not found` })
      return
    }

    await svc.deleteMarketingChatbotData(dataId)

    res.json({ id: dataId, object: "marketing_chatbot_data", deleted: true })
  } catch (e: any) {
    const status = e?.type === MedusaError.Types.INVALID_DATA ? 400 : 500
    res.status(isNotFound(e) ? 404 : status).json({
      message: e?.message ?? "Failed to delete chatbot data",
    })
  }
}
