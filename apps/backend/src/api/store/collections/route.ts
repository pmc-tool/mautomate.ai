import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { storeTenant } from "../_tenant"

/**
 * GET /store/collections  (tenant-scoped override of the built-in route)
 *
 * Product collections have no sales-channel link, so the stock
 * /store/collections endpoint returns EVERY tenant's collections to any
 * publishable key. This override scopes the listing to the caller's tenant via
 * metadata.tenant_id.
 *
 * FAIL CLOSED: if the caller's tenant cannot be resolved, an EMPTY list is
 * returned. Legacy untagged collections are never exposed.
 *
 * Supported query params (preserved for SDK compatibility): handle, limit,
 * offset. Response shape { collections, count, offset, limit }. `metadata` is
 * stripped.
 *
 * Uses query.graph so metadata is actually returned.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const offset = Number(req.query.offset ?? 0) || 0
  const rawLimit = req.query.limit != null ? Number(req.query.limit) : undefined
  const limit = rawLimit && rawLimit > 0 ? rawLimit : undefined
  const handle = (req.query.handle as string | undefined)?.trim()

  const tenant = await storeTenant(req)
  if (!tenant) {
    return res.json({ collections: [], count: 0, offset, limit: limit ?? 0 })
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product_collection",
    fields: [
      "id",
      "title",
      "handle",
      "metadata",
      "created_at",
      "updated_at",
    ],
    pagination: { take: 1000, skip: 0 } as any,
  })

  let owned = (data || []).filter(
    (c: any) => c.metadata?.tenant_id === tenant.id
  )
  if (handle) owned = owned.filter((c: any) => c.handle === handle)
  owned.sort((a: any, b: any) => (a.title || "").localeCompare(b.title || ""))

  const count = owned.length
  const paged =
    limit != null ? owned.slice(offset, offset + limit) : owned.slice(offset)

  res.json({
    collections: paged.map(({ metadata, ...rest }: any) => rest),
    count,
    offset,
    limit: limit ?? count,
  })
}
