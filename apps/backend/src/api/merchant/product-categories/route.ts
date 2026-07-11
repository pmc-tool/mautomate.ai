import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { z } from "zod"
import { resolveMerchant } from "../_helpers"

const CreateCategorySchema = z.object({
  name: z.string().min(1),
  handle: z.string().optional(),
  description: z.string().optional(),
  parent_id: z.string().optional().nullable(),
  status: z.enum(["active", "inactive"]).optional().default("active"),
  visibility: z.enum(["public", "internal"]).optional().default("public"),
})

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "")
}

function serializeCategory(c: any): any {
  return {
    id: c.id,
    name: c.name,
    handle: c.handle,
    description: c.description ?? null,
    status: c.is_active ? "active" : "inactive",
    visibility: c.is_internal ? "internal" : "public",
    parent: c.parent_category
      ? {
          id: c.parent_category.id,
          name: c.parent_category.name,
          handle: c.parent_category.handle,
          status: c.parent_category.is_active ? "active" : "inactive",
          visibility: c.parent_category.is_internal ? "internal" : "public",
        }
      : null,
    children: (c.category_children || []).map(serializeCategory),
  }
}

/**
 * GET /merchant/product-categories
 *
 * List product categories for this tenant. Categories are global in Medusa;
 * scope to this tenant via metadata.tenant_id. Fail-closed: rows without a
 * matching tenant_id (including legacy untagged categories) are invisible.
 *
 * Uses query.graph so metadata is actually returned — the module-service list
 * with `relations` omits it, which made the owner filter match nothing.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
      filters: { metadata: { tenant_id: ctx.tenant.id } },

    entity: "product_category",
    fields: [
      "id",
      "name",
      "handle",
      "description",
      "is_active",
      "is_internal",
      "metadata",
      "parent_category.id",
      "parent_category.name",
      "parent_category.handle",
      "parent_category.is_active",
      "parent_category.is_internal",
      "category_children.id",
      "category_children.name",
      "category_children.handle",
      "category_children.is_active",
      "category_children.is_internal",
      "category_children.metadata",
    ],
    pagination: { take: 500, skip: 0 } as any,
  })

  const owned = (data || [])
    .filter((c: any) => c.metadata?.tenant_id === ctx.tenant.id)
    .sort((a: any, b: any) => (a.name || "").localeCompare(b.name || ""))

  res.json({
    categories: owned.map(serializeCategory),
    count: owned.length,
  })
}

/**
 * POST /merchant/product-categories
 *
 * Create a product category, tagged with this tenant's metadata.tenant_id.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const parsed = CreateCategorySchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: "invalid input", issues: parsed.error.issues })
  }

  const { name, handle, description, parent_id, status, visibility } = parsed.data

  const productModule: any = req.scope.resolve(Modules.PRODUCT)
  const [category] = await productModule.createProductCategories([
    {
      name,
      handle: handle || slugify(name),
      description,
      parent_category_id: parent_id || undefined,
      is_active: status === "active",
      is_internal: visibility === "internal",
      metadata: { tenant_id: ctx.tenant.id },
    },
  ])

  res.status(201).json({ category: serializeCategory(category) })
}
