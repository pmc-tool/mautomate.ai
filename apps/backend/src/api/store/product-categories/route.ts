import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { storeTenant } from "../_tenant"

/**
 * GET /store/product-categories  (tenant-scoped override of the built-in route)
 *
 * Product categories are global entities in Medusa (no sales-channel link), so
 * the stock /store/product-categories endpoint returns EVERY tenant's
 * categories to any publishable key. This override scopes the listing to the
 * caller's tenant via metadata.tenant_id.
 *
 * FAIL CLOSED: if the caller's tenant cannot be resolved, an EMPTY list is
 * returned. Legacy untagged categories (tenant_id missing) belong to no tenant
 * and are never exposed. Internal categories (is_internal) are excluded to
 * preserve stock store behaviour.
 *
 * Supported query params (preserved for SDK compatibility): handle,
 * parent_category_id, limit, offset. Response shape
 * { product_categories, count, offset, limit }. `metadata` is stripped.
 *
 * Uses query.graph so metadata is actually returned — the module-service list
 * omits it when relations are requested, which made the owner filter match
 * nothing.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const offset = Number(req.query.offset ?? 0) || 0
  const rawLimit = req.query.limit != null ? Number(req.query.limit) : undefined
  const limit = rawLimit && rawLimit > 0 ? rawLimit : undefined
  const handle = (req.query.handle as string | undefined)?.trim()
  const parentCategoryId =
    req.query.parent_category_id != null
      ? (req.query.parent_category_id as string)
      : undefined

  const tenant = await storeTenant(req)
  if (!tenant) {
    return res.json({ product_categories: [], count: 0, offset, limit: limit ?? 0 })
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product_category",
    fields: [
      "id",
      "name",
      "handle",
      "description",
      "is_active",
      "is_internal",
      "rank",
      "parent_category_id",
      "metadata",
      "created_at",
      "updated_at",
      "parent_category.id",
      "parent_category.name",
      "parent_category.handle",
      "category_children.id",
      "category_children.name",
      "category_children.handle",
      "category_children.is_active",
      "category_children.is_internal",
    ],
    pagination: { take: 1000, skip: 0 } as any,
  })

  let owned = (data || []).filter(
    (c: any) => c.metadata?.tenant_id === tenant.id && c.is_internal !== true
  )
  if (handle) owned = owned.filter((c: any) => c.handle === handle)
  if (parentCategoryId !== undefined) {
    const target = parentCategoryId === "null" || parentCategoryId === "" ? null : parentCategoryId
    owned = owned.filter((c: any) => (c.parent_category_id ?? null) === target)
  }
  owned.sort((a: any, b: any) => (a.rank ?? 0) - (b.rank ?? 0) || (a.name || "").localeCompare(b.name || ""))

  const count = owned.length
  const paged =
    limit != null ? owned.slice(offset, offset + limit) : owned.slice(offset)

  res.json({
    product_categories: paged.map(({ metadata, ...rest }: any) => rest),
    count,
    offset,
    limit: limit ?? count,
  })
}
