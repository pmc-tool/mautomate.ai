import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resolveMerchant } from "../../../_helpers"
import { toCannedResponseDto } from "../_dto"
import { first, marketing } from "../_ops"
import {
  SHORTCUT_CONFLICT,
  isUniqueViolation,
  shortcutTaken,
  validateCanned,
  type CannedFields,
} from "./_shared"

/**
 * GET /merchant/marketing/conversations/canned-responses
 *
 * This tenant's saved replies, for the composer's shortcut picker. Optional
 * `category` filter and free-text `q` (shortcut / title / content).
 * Response: { canned_responses, count }
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const tenantId = ctx.tenant.id

  try {
    const mk = marketing(req.scope)

    const category =
      typeof req.query.category === "string" && req.query.category.trim()
        ? req.query.category.trim()
        : undefined
    const q =
      typeof req.query.q === "string" && req.query.q.trim()
        ? req.query.q.trim().toLowerCase()
        : undefined

    const filter: Record<string, any> = { tenant_id: tenantId }
    if (category) filter.category = category

    const rows = await mk.listMarketingCannedResponses(filter, {
      order: { shortcut: "ASC" },
      take: 500,
    })
    let list = Array.isArray(rows) ? rows : []

    if (q) {
      const matches = (v: any) =>
        typeof v === "string" && v.toLowerCase().includes(q)
      list = list.filter(
        (r: any) => matches(r.shortcut) || matches(r.title) || matches(r.content)
      )
    }

    const canned_responses = list.map(toCannedResponseDto)
    res.json({ canned_responses, count: canned_responses.length })
  } catch (e: any) {
    res.status(500).json({
      message: e?.message ?? "Failed to list canned responses",
    })
  }
}

/**
 * POST /merchant/marketing/conversations/canned-responses
 *
 * Create a saved reply.
 * Body: { shortcut, title, content, category? }
 * Response: { canned_response } (201) — 409 when the shortcut is already used.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const tenantId = ctx.tenant.id

  try {
    const mk = marketing(req.scope)

    const parsed = validateCanned(req.body ?? {}, false)
    if (!parsed.ok) {
      res.status(400).json({ message: parsed.message })
      return
    }
    const value = parsed.value as CannedFields

    if (await shortcutTaken(mk, tenantId, value.shortcut)) {
      res.status(409).json(SHORTCUT_CONFLICT)
      return
    }

    let created: any
    try {
      created = await mk.createMarketingCannedResponses({
        tenant_id: tenantId,
        shortcut: value.shortcut,
        title: value.title,
        content: value.content,
        category: value.category ?? null,
      } as any)
    } catch (e: any) {
      if (isUniqueViolation(e)) {
        res.status(409).json(SHORTCUT_CONFLICT)
        return
      }
      throw e
    }

    res
      .status(201)
      .json({ canned_response: toCannedResponseDto(first<any>(created)) })
  } catch (e: any) {
    res.status(500).json({
      message: e?.message ?? "Failed to create canned response",
    })
  }
}
