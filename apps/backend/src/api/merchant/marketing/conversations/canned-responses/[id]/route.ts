import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resolveMerchant } from "../../../../_helpers"
import { toCannedResponseDto } from "../../_dto"
import { first, marketing } from "../../_ops"
import {
  SHORTCUT_CONFLICT,
  isUniqueViolation,
  shortcutTaken,
  validateCanned,
} from "../_shared"

/** Load a canned response and assert tenant ownership; null when missing/foreign. */
const loadCanned = async (
  mk: any,
  id: string,
  tenantId: string
): Promise<any | null> => {
  try {
    const rows = await mk.listMarketingCannedResponses(
      { id, tenant_id: tenantId },
      { take: 1 }
    )
    return first<any>(rows)
  } catch {
    return null
  }
}

/**
 * PUT /merchant/marketing/conversations/canned-responses/:id
 *
 * Update a saved reply (partial: any of shortcut / title / content / category).
 * Response: { canned_response } — 404 when it is not this tenant's, 409 when the
 * new shortcut is already used.
 */
export const PUT = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const tenantId = ctx.tenant.id
  const { id } = req.params

  try {
    const mk = marketing(req.scope)

    const existing = await loadCanned(mk, id, tenantId)
    if (!existing) {
      res.status(404).json({ message: `Canned response ${id} not found` })
      return
    }

    const parsed = validateCanned(req.body ?? {}, true)
    if (!parsed.ok) {
      res.status(400).json({ message: parsed.message })
      return
    }
    const patch = parsed.value
    if (!Object.keys(patch).length) {
      res.status(400).json({ message: "No fields to update" })
      return
    }

    if (patch.shortcut && patch.shortcut !== existing.shortcut) {
      if (await shortcutTaken(mk, tenantId, patch.shortcut, id)) {
        res.status(409).json(SHORTCUT_CONFLICT)
        return
      }
    }

    try {
      await mk.updateMarketingCannedResponses({ id, ...patch } as any)
    } catch (e: any) {
      if (isUniqueViolation(e)) {
        res.status(409).json(SHORTCUT_CONFLICT)
        return
      }
      throw e
    }

    const updated = (await loadCanned(mk, id, tenantId)) ?? existing
    res.json({ canned_response: toCannedResponseDto(updated) })
  } catch (e: any) {
    res.status(500).json({
      message: e?.message ?? "Failed to update canned response",
    })
  }
}

/**
 * DELETE /merchant/marketing/conversations/canned-responses/:id
 *
 * Response: { id, object: "canned_response", deleted: true }
 */
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const tenantId = ctx.tenant.id
  const { id } = req.params

  try {
    const mk = marketing(req.scope)

    const existing = await loadCanned(mk, id, tenantId)
    if (!existing) {
      res.status(404).json({ message: `Canned response ${id} not found` })
      return
    }

    await mk.deleteMarketingCannedResponses([id])

    res.json({ id, object: "canned_response", deleted: true })
  } catch (e: any) {
    res.status(500).json({
      message: e?.message ?? "Failed to delete canned response",
    })
  }
}
