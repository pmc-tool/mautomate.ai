import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { resolveMerchant } from "../_helpers"

type RegistryEntry = {
  title: string
  values: Set<string>
  productIds: Set<string>
  products: { id: string; title: string }[]
}

/**
 * GET /merchant/product-options
 *
 * In Medusa admin, /product-options is a global option registry. Our DB is
 * pooled and options belong to individual products, so this is a tenancy
 * adaptation: it aggregates DISTINCT option titles across THIS tenant's products
 * (products linked to the tenant sales channel), returning each title's union of
 * values, how many products use it, and up to five owning products. Read-only —
 * option mutations happen per-product via the products domain routes.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  const scId = ctx.tenant.meta?.sales_channel_id
  if (!scId) return res.json({ options: [] })

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: scLinks } = await query.graph({
    entity: "product_sales_channel",
    filters: { sales_channel_id: scId } as any,
    fields: ["product_id"],
  })
  const productIds = (scLinks || [])
    .map((l: any) => l.product_id)
    .filter(Boolean)
  if (!productIds.length) return res.json({ options: [] })

  const productModule: any = req.scope.resolve(Modules.PRODUCT)
  const products = await productModule.listProducts(
    { id: productIds },
    { take: productIds.length, relations: ["options", "options.values"] }
  )

  const registry = new Map<string, RegistryEntry>()
  for (const product of products || []) {
    for (const option of product.options || []) {
      const title = option.title
      if (!title) continue
      let entry = registry.get(title)
      if (!entry) {
        entry = {
          title,
          values: new Set<string>(),
          productIds: new Set<string>(),
          products: [],
        }
        registry.set(title, entry)
      }
      for (const v of option.values || []) {
        if (v?.value) entry.values.add(v.value)
      }
      if (!entry.productIds.has(product.id)) {
        entry.productIds.add(product.id)
        if (entry.products.length < 5) {
          entry.products.push({ id: product.id, title: product.title })
        }
      }
    }
  }

  const options = Array.from(registry.values())
    .map((e) => ({
      title: e.title,
      values: Array.from(e.values).sort((a, b) => a.localeCompare(b)),
      product_count: e.productIds.size,
      products: e.products,
    }))
    .sort((a, b) => a.title.localeCompare(b.title))

  res.json({ options })
}
