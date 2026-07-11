import { listProducts } from "@lib/data/products"
import { HttpTypes } from "@medusajs/types"
import LeartsProductActions from "@modules/products/components/learts-product-actions"

/**
 * Fetches real-time pricing + categories/tags for the product and renders the
 * Learts-styled product summary + actions.
 */
export default async function LeartsActionsWrapper({
  id,
  region,
}: {
  id: string
  region: HttpTypes.StoreRegion
}) {
  const product = await listProducts({
    queryParams: {
      id: [id],
      fields:
        "*variants.calculated_price,+variants.inventory_quantity,*variants.options,*options,*options.values,*categories,+tags,*images,description,title,handle",
    } as any,
    regionId: region.id,
  }).then(({ response }) => response.products[0])

  if (!product) {
    return null
  }

  return <LeartsProductActions product={product} region={region} />
}
