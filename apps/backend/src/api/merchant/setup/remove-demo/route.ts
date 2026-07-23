import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { resolveMerchant } from "../../_helpers"

/**
 * POST /merchant/setup/remove-demo
 *
 * Delete the demo/sample product(s) the store was provisioned with (the ones
 * tagged metadata.is_sample = true, scoped to this tenant's sales channel). A
 * merchant clicks this once they've added their own products and no longer want
 * the placeholder. Soft-delete, tenant-scoped, idempotent (returns removed: 0 if
 * there is nothing to remove).
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const scId = (ctx.tenant.meta as any)?.sales_channel_id
  if (!scId) return res.json({ removed: 0 })

  try {
    const pg: any = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
    const rows = await pg
      .select("psc.product_id")
      .from("product_sales_channel as psc")
      .join("product as p", "p.id", "psc.product_id")
      .where("psc.sales_channel_id", scId)
      .whereNull("p.deleted_at")
      .whereRaw("coalesce(p.metadata->>'is_sample','') = 'true'")

    const ids = (Array.isArray(rows) ? rows : [])
      .map((r: any) => r.product_id)
      .filter(Boolean)

    if (!ids.length) return res.json({ removed: 0 })

    const productModule: any = req.scope.resolve(Modules.PRODUCT)
    await productModule.softDeleteProducts(ids)

    res.json({ removed: ids.length })
  } catch (err: any) {
    res.status(400).json({ message: err?.message || "Could not remove demo data." })
  }
}
