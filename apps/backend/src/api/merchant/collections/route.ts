import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { resolveMerchant } from "../_helpers"
import { z } from "zod"

const CreateCollectionSchema = z.object({
  title: z.string().min(1),
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
 * GET /merchant/collections
 *
 * Product collections have no sales-channel link, so they are scoped by
 * metadata.tenant_id: rows are tagged at creation and only this tenant's rows
 * are returned. Pre-existing untagged collections are intentionally invisible
 * (fail-closed) — no untagged fallback is exposed.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const productModule: any = req.scope.resolve(Modules.PRODUCT)
  const all = await productModule.listProductCollections(
    {},
    { take: 500, skip: 0 }
  )
  const collections = (all || []).filter(
    (c: any) => c.metadata?.tenant_id === ctx.tenant.id
  )

  res.json({
    collections: collections.map((c: any) => ({
      id: c.id,
      title: c.title,
      handle: c.handle,
    })),
    count: collections.length,
  })
}

/**
 * POST /merchant/collections
 *
 * Create a product collection for the tenant, tagged with metadata.tenant_id.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const parsed = CreateCollectionSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: "invalid input", issues: parsed.error.issues })
  }

  const productModule: any = req.scope.resolve(Modules.PRODUCT)
  const [collection] = await productModule.createProductCollections([
    {
      title: parsed.data.title,
      handle: parsed.data.handle || slugify(parsed.data.title),
      metadata: { tenant_id: ctx.tenant.id },
    },
  ])

  res.status(201).json({ collection })
}
