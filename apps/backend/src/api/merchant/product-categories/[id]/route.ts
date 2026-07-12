import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { updateProductCategoriesWorkflow } from "@medusajs/core-flows"
import { z } from "zod"
import { resolveMerchant } from "../../_helpers"

const UpdateCategorySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  handle: z.string().optional(),
  is_active: z.boolean().optional(),
  is_internal: z.boolean().optional(),
  parent_category_id: z.string().nullable().optional(),
  rank: z.number().int().min(0).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
})

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "")
}

/**
 * Fetch a category (with parent + children) via query.graph so metadata is
 * returned — the module-service retrieve omits it, and the tenant guard needs
 * it. Returns null unless the row belongs to this tenant. The null-safe `!==`
 * guard means untagged rows never match a real tenant id (fail-closed).
 */
async function loadOwnedCategory(
  req: MedusaRequest,
  tenantId: string,
  id: string
) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product_category",
    filters: { id } as any,
    fields: [
      "id",
      "name",
      "description",
      "handle",
      "is_active",
      "is_internal",
      "rank",
      "metadata",
      "parent_category.id",
      "parent_category.name",
      "parent_category.metadata",
      "category_children.id",
      "category_children.name",
      "category_children.rank",
      "category_children.is_active",
      "category_children.metadata",
    ],
  })
  const category = (data || [])[0]
  if (!category || category.metadata?.tenant_id !== tenantId) return null
  return category
}

/**
 * Count products that are BOTH linked to this category AND to the tenant's sales
 * channel. Products outside the tenant channel are never counted so the number
 * a merchant sees is exactly their own catalog.
 */
async function countTenantProductsInCategory(
  req: MedusaRequest,
  scId: string | undefined,
  id: string
): Promise<number> {
  if (!scId) return 0
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: scLinks } = await query.graph({
    entity: "product_sales_channel",
    filters: { sales_channel_id: scId } as any,
    fields: ["product_id"],
  })
  const scProductIds = new Set(
    (scLinks || []).map((l: any) => l.product_id).filter(Boolean)
  )
  if (!scProductIds.size) return 0

  const { data: catData } = await query.graph({
    entity: "product_category",
    filters: { id } as any,
    fields: ["id", "products.id"],
  })
  const products = ((catData?.[0] as any)?.products || []) as any[]
  return products.filter((p: any) => scProductIds.has(p.id)).length
}

/**
 * Serialize a tenant-owned category to the detail contract. Parent and children
 * are filtered to this tenant so cross-tenant hierarchy never leaks.
 */
function serializeDetail(category: any, tenantId: string, productsCount: number) {
  const parent =
    category.parent_category &&
    category.parent_category.metadata?.tenant_id === tenantId
      ? { id: category.parent_category.id, name: category.parent_category.name }
      : null

  const children = (category.category_children || [])
    .filter((c: any) => c.metadata?.tenant_id === tenantId)
    .sort(
      (a: any, b: any) =>
        (a.rank ?? 0) - (b.rank ?? 0) ||
        (a.name || "").localeCompare(b.name || "")
    )
    .map((c: any) => ({
      id: c.id,
      name: c.name,
      rank: c.rank ?? 0,
      is_active: !!c.is_active,
    }))

  return {
    id: category.id,
    name: category.name,
    description: category.description ?? null,
    handle: category.handle,
    is_active: !!category.is_active,
    is_internal: !!category.is_internal,
    rank: category.rank ?? 0,
    parent_category: parent,
    category_children: children,
    products_count: productsCount,
    metadata: category.metadata ?? {},
  }
}

/**
 * GET /merchant/product-categories/:id
 *
 * Category detail with parent, children, tenant-scoped products_count and
 * metadata. 404 for missing categories and other tenants' categories.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const { id } = req.params
  const category = await loadOwnedCategory(req, ctx.tenant.id, id)
  if (!category) return res.status(404).json({ message: "product category not found" })

  const productsCount = await countTenantProductsInCategory(
    req,
    ctx.tenant.meta?.sales_channel_id,
    id
  )

  res.json({ category: serializeDetail(category, ctx.tenant.id, productsCount) })
}

/**
 * POST /merchant/product-categories/:id
 *
 * Update a tenant-owned category (name, description, handle, status, visibility,
 * rank, parent). Re-parenting is rejected unless the new parent is also owned by
 * this tenant, so a merchant can never nest under another tenant's category.
 * Metadata writes re-stamp tenant_id to preserve ownership.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const parsed = UpdateCategorySchema.safeParse(req.body)
  if (!parsed.success) {
    return res
      .status(400)
      .json({ message: "invalid input", issues: parsed.error.issues })
  }

  const { id } = req.params
  const owned = await loadOwnedCategory(req, ctx.tenant.id, id)
  if (!owned) return res.status(404).json({ message: "product category not found" })

  const {
    name,
    description,
    handle,
    is_active,
    is_internal,
    parent_category_id,
    rank,
    metadata,
  } = parsed.data

  const update: any = {}
  if (name !== undefined) update.name = name
  if (description !== undefined) update.description = description
  if (handle !== undefined) update.handle = slugify(handle)
  if (is_active !== undefined) update.is_active = is_active
  if (is_internal !== undefined) update.is_internal = is_internal
  if (rank !== undefined) update.rank = rank
  if (metadata !== undefined) {
    update.metadata = { ...metadata, tenant_id: ctx.tenant.id }
  }
  if (parent_category_id !== undefined) {
    if (parent_category_id === null) {
      update.parent_category_id = null
    } else {
      if (parent_category_id === id) {
        return res
          .status(400)
          .json({ message: "a category cannot be its own parent" })
      }
      const parent = await loadOwnedCategory(req, ctx.tenant.id, parent_category_id)
      if (!parent) {
        return res.status(400).json({ message: "parent category not found" })
      }
      update.parent_category_id = parent_category_id
    }
  }

  await updateProductCategoriesWorkflow(req.scope).run({
    input: { selector: { id }, update },
  })

  const reloaded = await loadOwnedCategory(req, ctx.tenant.id, id)
  const productsCount = await countTenantProductsInCategory(
    req,
    ctx.tenant.meta?.sales_channel_id,
    id
  )
  res.json({ category: serializeDetail(reloaded, ctx.tenant.id, productsCount) })
}

/**
 * DELETE /merchant/product-categories/:id
 *
 * Delete a tenant-owned category. Blocked with 400 when the category still has
 * (tenant-owned) child categories — the merchant must move or delete children
 * first. Other tenants' rows return 404.
 */
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const { id } = req.params
  const owned = await loadOwnedCategory(req, ctx.tenant.id, id)
  if (!owned) return res.status(404).json({ message: "product category not found" })

  const children = (owned.category_children || []).filter(
    (c: any) => c.metadata?.tenant_id === ctx.tenant.id
  )
  if (children.length) {
    return res.status(400).json({
      message:
        "Cannot delete a category that has child categories. Move or delete the child categories first.",
    })
  }

  const productModule: any = req.scope.resolve(Modules.PRODUCT)
  await productModule.deleteProductCategories([id])
  res.json({ id, object: "product_category", deleted: true })
}
