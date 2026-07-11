import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { resolveMerchant } from "../_helpers"

/**
 * GET /merchant/product-tags
 *
 * List product tags for this tenant. Tags are global in Medusa; scope to this
 * tenant via metadata.tenant_id. Fail-closed: rows without a matching tenant_id
 * (including legacy untagged tags) are invisible to this merchant.
 *
 * Uses query.graph so metadata is actually returned — the product module-service
 * list omits it, which made the owner filter match nothing.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({
      filters: { metadata: { tenant_id: ctx.tenant.id } },

      entity: "product_tag",
      fields: ["id", "value", "metadata"],
      pagination: { take: 500, skip: 0 } as any,
    })

    const owned = (data || []).filter(
      (t: any) => t.metadata?.tenant_id === ctx.tenant.id
    )
    res.json({
      tags: owned.map((t: any) => ({ id: t.id, value: t.value })),
      count: owned.length,
    })
  } catch (e: any) {
    res.status(500).json({ message: e?.message ?? "Failed to load product tags" })
  }
}
