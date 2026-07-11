import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { z } from "zod"
import { resolveMerchant } from "../../_helpers"

const UpdateCollectionSchema = z.object({
  title: z.string().min(1).optional(),
  handle: z.string().optional(),
})

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "")
}

/**
 * Retrieve a collection only if it belongs to this tenant (metadata.tenant_id).
 * Returns null for missing collections and for other tenants' collections so
 * callers can 404 uniformly. The null-safe `!==` guard means untagged rows
 * (metadata.tenant_id undefined) never match a real tenant id.
 */
async function findOwnedCollection(
  req: MedusaRequest,
  tenantId: string,
  id: string
) {
  const productModule: any = req.scope.resolve(Modules.PRODUCT)
  const collection = await productModule
    .retrieveProductCollection(id)
    .catch(() => null)
  if (!collection || collection.metadata?.tenant_id !== tenantId) return null
  return collection
}

/**
 * GET /merchant/collections/:id
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const { id } = req.params
  const collection = await findOwnedCollection(req, ctx.tenant.id, id)
  if (!collection) return res.status(404).json({ message: "collection not found" })

  const productModule: any = req.scope.resolve(Modules.PRODUCT)
  const products = await productModule.listProducts(
    { collection_id: id },
    { take: 0, select: ["id"] }
  )

  res.json({
    collection: {
      id: collection.id,
      title: collection.title,
      handle: collection.handle,
      product_count: products?.length ?? 0,
    },
  })
}

/**
 * PUT /merchant/collections/:id
 */
export const PUT = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const parsed = UpdateCollectionSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: "invalid input", issues: parsed.error.issues })
  }

  const { id } = req.params
  const existing = await findOwnedCollection(req, ctx.tenant.id, id)
  if (!existing) return res.status(404).json({ message: "collection not found" })

  const update: any = { id }
  if (parsed.data.title !== undefined) update.title = parsed.data.title
  if (parsed.data.handle !== undefined) update.handle = slugify(parsed.data.handle)

  const productModule: any = req.scope.resolve(Modules.PRODUCT)
  const [collection] = await productModule.updateProductCollections([update])

  res.json({
    collection: {
      id: collection.id,
      title: collection.title,
      handle: collection.handle,
    },
  })
}

/**
 * DELETE /merchant/collections/:id
 */
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const { id } = req.params
  const existing = await findOwnedCollection(req, ctx.tenant.id, id)
  if (!existing) return res.status(404).json({ message: "collection not found" })

  const productModule: any = req.scope.resolve(Modules.PRODUCT)
  await productModule.deleteProductCollections([id])
  res.status(204).send()
}
