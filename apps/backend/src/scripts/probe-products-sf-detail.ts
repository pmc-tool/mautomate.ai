import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/core-flows"

export default async function probe({ container }: { container: any }) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  // Validate the query.graph entities/field lists used by the route (read-only).
  await query.graph({
    entity: "product_sales_channel",
    fields: ["product_id"],
    pagination: { skip: 0, take: 1 },
  })

  await query.graph({
    entity: "product_variant_price_set",
    fields: ["variant_id", "price_set_id"],
    pagination: { skip: 0, take: 1 },
  })

  // Validate the workflow import (do not run it).
  if (typeof updateProductsWorkflow !== "function") {
    throw new Error("updateProductsWorkflow is not importable from @medusajs/core-flows")
  }

  // Validate the extended PUT fields exist on the product DTO (read-only).
  const productModule: any = container.resolve(Modules.PRODUCT)
  const [sample] = await productModule.listProducts({}, { take: 1 })
  if (sample) {
    const fields = [
      "subtitle",
      "discountable",
      "thumbnail",
      "type_id",
      "width",
      "height",
      "length",
      "weight",
      "mid_code",
      "hs_code",
      "origin_country",
      "material",
      "metadata",
    ]
    const missing = fields.filter((f) => !(f in sample))
    if (missing.length) {
      throw new Error(`product DTO missing fields: ${missing.join(", ")}`)
    }
  }

  // Validate the fulfillment module is resolvable (shipping_profile_id linking).
  const fulfillmentModule: any = container.resolve(Modules.FULFILLMENT)
  await fulfillmentModule.listShippingProfiles({}, { take: 1 })

  console.log(
    "probe ok: query graphs, updateProductsWorkflow import, extended product fields, and fulfillment module validated"
  )
}