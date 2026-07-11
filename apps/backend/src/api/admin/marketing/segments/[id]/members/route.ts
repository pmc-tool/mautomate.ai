import { resolveTenantId } from "../../../../../../lib/tenant-context"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../../../modules/marketing"

const TENANT_ID = resolveTenantId("MARKETING_DEFAULT_TENANT")

/**
 * GET /admin/marketing/segments/:id/members
 *
 * Paginated list of a segment's materialized members, each joined to its
 * contact's email + display name via a single batched contact lookup.
 * Response: { members, count, limit, offset }
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const svc: any = req.scope.resolve(MARKETING_MODULE)

    const limit = parseInt((req.query.limit as string) ?? "20")
    const offset = parseInt((req.query.offset as string) ?? "0")

    const [rows, count] = await svc.listAndCountMarketingSegmentMembers(
      { tenant_id: TENANT_ID, segment_id: req.params.id },
      { take: limit, skip: offset, order: { added_at: "DESC" } }
    )

    const members = Array.isArray(rows) ? rows : []
    const contactIds = Array.from(
      new Set(members.map((m: any) => m?.contact_id).filter(Boolean))
    )

    // Batched contact join: one query resolves email + name for the page.
    const contactMap = new Map<string, { email: string | null; name: string | null }>()
    if (contactIds.length) {
      try {
        const contacts = await svc.listMarketingContacts(
          { tenant_id: TENANT_ID, id: contactIds },
          { take: contactIds.length }
        )
        for (const c of Array.isArray(contacts) ? contacts : []) {
          contactMap.set(c.id, {
            email: c?.email ?? null,
            name: c?.display_name ?? null,
          })
        }
      } catch {
        // Non-fatal — members still render without joined contact fields.
      }
    }

    const enriched = members.map((m: any) => {
      const c = contactMap.get(m?.contact_id)
      return {
        id: m?.id,
        contact_id: m?.contact_id,
        source: m?.source ?? null,
        added_at: m?.added_at ?? null,
        email: c?.email ?? null,
        name: c?.name ?? null,
      }
    })

    res.json({ members: enriched, count, limit, offset })
  } catch (e: any) {
    res.status(500).json({
      message: e?.message ?? "Failed to list segment members",
    })
  }
}
