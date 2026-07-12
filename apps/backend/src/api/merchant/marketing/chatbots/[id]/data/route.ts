import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../../../modules/marketing"
import MarketingModuleService from "../../../../../../modules/marketing/service"
import { fetchUrlText } from "../../../../../../modules/marketing/knowledge/fetch-url"
import { resolveMerchant } from "../../../../_helpers"
import { DATA_KINDS, isNotFound, loadOwnedChatbot } from "../../_shared"

/** Hard cap on a pasted source, so one paste cannot blow up the embedding bill. */
const MAX_CONTENT = 200_000

/**
 * GET /merchant/marketing/chatbots/:id/data
 *
 * List a chatbot's knowledge sources (newest first), tenant-scoped. Each row
 * carries its embedding `status` (pending | embedded | failed) and, on failure,
 * the `error` that explains it.
 * Response: { data, count }
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const tenantId = ctx.tenant.id
  const { id } = req.params

  try {
    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)

    if (!(await loadOwnedChatbot(svc, id, tenantId, res))) return

    const [data, count] = await (svc as any).listAndCountMarketingChatbotData(
      { tenant_id: tenantId, chatbot_id: id },
      { take: 1000, order: { created_at: "DESC" } }
    )

    res.json({ data, count })
  } catch (e: any) {
    res.status(isNotFound(e) ? 404 : 500).json({
      message: e?.message ?? "Failed to list chatbot knowledge",
    })
  }
}

/**
 * POST /merchant/marketing/chatbots/:id/data
 *
 * Add ONE knowledge source to a chatbot (tenant-scoped).
 *
 * `kind: "url"` is fetched here, not at train time: the training pipeline embeds
 * a source's literal text, so storing a bare URL would embed the string
 * "https://…" and teach the bot nothing. The page is fetched through the
 * SSRF-guarded `fetchUrlText` (public hosts only, redirects re-validated), its
 * readable text becomes the row's `content`, and the URL stays in `source`. A
 * fetch failure is a 400 with the reason — never a silently useless row.
 *
 * Every new row starts `pending`: it becomes real knowledge only once /train
 * embeds it. Adding a source therefore also drops the bot back to `not_trained`
 * so the studio cannot claim a bot is trained on something it has not embedded.
 *
 * Body: { kind, content?, source? }
 * Response: { data }
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const tenantId = ctx.tenant.id
  const { id } = req.params
  const b = (req.body ?? {}) as { kind?: string; content?: string; source?: string }

  try {
    const kind = (b.kind ?? "faq").trim()
    if (!(DATA_KINDS as readonly string[]).includes(kind)) {
      return res.status(400).json({
        message: `Knowledge \`kind\` must be one of: ${DATA_KINDS.join(", ")}.`,
      })
    }

    let content = b.content?.trim() ? b.content.trim().slice(0, MAX_CONTENT) : null
    let source = b.source?.trim() ? b.source.trim() : null

    if (!content && !source) {
      return res
        .status(400)
        .json({ message: "A knowledge source needs `content` or a `source`." })
    }

    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)

    if (!(await loadOwnedChatbot(svc, id, tenantId, res))) return

    // A URL is only worth embedding once its page has been read.
    if (kind === "url") {
      if (!source) {
        return res
          .status(400)
          .json({ message: "A website source needs the page URL in `source`." })
      }
      try {
        const page = await fetchUrlText(source)
        source = page.url
        content = [page.title, page.text]
          .filter(Boolean)
          .join("\n\n")
          .slice(0, MAX_CONTENT)
      } catch (e: any) {
        return res
          .status(400)
          .json({ message: e?.message ?? "That page could not be imported." })
      }
    }

    const created = await (svc as any).createMarketingChatbotData({
      tenant_id: tenantId,
      chatbot_id: id,
      kind,
      content,
      source,
      status: "pending",
      error: null,
      embedding_ref: null,
    })

    const data = Array.isArray(created) ? created[0] : created

    // New knowledge invalidates the "trained" claim until it is embedded.
    await (svc as any)
      .updateMarketingChatbots({ id, training_status: "not_trained" })
      .catch(() => {})

    res.status(201).json({ data })
  } catch (e: any) {
    res.status(isNotFound(e) ? 404 : 500).json({
      message: e?.message ?? "Failed to add knowledge source",
    })
  }
}

/**
 * DELETE /merchant/marketing/chatbots/:id/data?data_id=...
 *
 * Delete one knowledge source and the embedded chunks it produced, so a removed
 * source can no longer ground an answer. Tenant-scoped: the row must belong to
 * this bot AND this tenant.
 * Response: { id, object, deleted, chunks_deleted }
 */
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const tenantId = ctx.tenant.id
  const { id } = req.params
  const dataId = (req.query.data_id as string) ?? ""

  try {
    if (!dataId) {
      return res
        .status(400)
        .json({ message: "A `data_id` query param is required." })
    }

    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)

    if (!(await loadOwnedChatbot(svc, id, tenantId, res))) return

    const rows = await (svc as any).listMarketingChatbotData(
      { tenant_id: tenantId, chatbot_id: id, id: dataId },
      { take: 1 }
    )
    const row = Array.isArray(rows) ? rows[0] : null
    if (!row) {
      return res
        .status(404)
        .json({ message: `Knowledge source ${dataId} was not found` })
    }

    const chunks = await (svc as any)
      .listMarketingKnowledgeChunks(
        { tenant_id: tenantId, owner_id: id, source_id: dataId },
        { take: 5000 }
      )
      .catch(() => [])
    const chunkIds = (Array.isArray(chunks) ? chunks : []).map((c: any) => c.id)
    if (chunkIds.length) {
      await (svc as any).deleteMarketingKnowledgeChunks(chunkIds).catch(() => {})
    }

    await (svc as any).deleteMarketingChatbotData(dataId)

    res.json({
      id: dataId,
      object: "marketing_chatbot_data",
      deleted: true,
      chunks_deleted: chunkIds.length,
    })
  } catch (e: any) {
    res.status(isNotFound(e) ? 404 : 500).json({
      message: e?.message ?? "Failed to delete knowledge source",
    })
  }
}
