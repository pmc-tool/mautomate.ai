import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createProductTagsWorkflow } from "@medusajs/core-flows"
import { z } from "zod"
import { resolveMerchant } from "../_helpers"

/**
 * GET /merchant/product-tags — tenant-scoped product tags with per-tag
 * products_count (products in the tenant's sales channel carrying the tag).
 * POST creates a tenant-owned tag (metadata.tenant_id tagged).
 *
 * Tags are GLOBAL and linked to products many-to-many, so we tally counts by
 * reading product.tags.id from the OWNING product side — never by filtering a
 * tag by a relation FK.
 */

const CreateSchema = z.object({ value: z.string().trim().min(1) })

function toInt(v: unknown, fallback: number): number {
  const n = parseInt(String(Array.isArray(v) ? v[0] : v ?? ""), 10)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

async function tenantProductIds(query: any, scId?: string): Promise<string[]> {
  if (!scId) return []
  const { data } = await query.graph({
    entity: "product_sales_channel",
    filters: { sales_channel_id: scId } as any,
    fields: ["product_id"],
    pagination: { take: 10000, skip: 0 } as any,
  })
  return (data || []).map((l: any) => l.product_id).filter(Boolean)
}

async function tagCounts(
  query: any,
  pids: string[]
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {}
  if (!pids.length) return counts
  const { data } = await query.graph({
    entity: "product",
    filters: { id: pids } as any,
    fields: ["id", "tags.id"],
    pagination: { take: 10000, skip: 0 } as any,
  })
  for (const p of data || []) {
    for (const t of p.tags || []) {
      if (t?.id) counts[t.id] = (counts[t.id] || 0) + 1
    }
  }
  return counts
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    filters: { metadata: { tenant_id: ctx.tenant.id } },
    entity: "product_tag",
    fields: ["id", "value", "metadata", "created_at", "updated_at"],
    pagination: { take: 1000, skip: 0, order: { value: "ASC" } } as any,
  })

  let owned = (data || []).filter(
    (t: any) => t.metadata?.tenant_id === ctx.tenant.id
  )

  const q =
    typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : ""
  if (q) owned = owned.filter((t: any) => t.value.toLowerCase().includes(q))

  const count = owned.length
  const offset = toInt(req.query.offset, 0)
  const limit = toInt(req.query.limit, owned.length)
  const page = owned.slice(offset, offset + (limit || owned.length))

  const pids = await tenantProductIds(query, ctx.tenant.meta?.sales_channel_id)
  const counts = await tagCounts(query, pids)

  res.json({
    tags: page.map((t: any) => ({
      id: t.id,
      value: t.value,
      products_count: counts[t.id] || 0,
      created_at: t.created_at,
      updated_at: t.updated_at,
    })),
    count,
  })
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const parsed = CreateSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    return res
      .status(400)
      .json({ message: "invalid input", issues: parsed.error.issues })
  }

  const { result } = await createProductTagsWorkflow(req.scope).run({
    input: {
      product_tags: [
        { value: parsed.data.value, metadata: { tenant_id: ctx.tenant.id } },
      ],
    },
  })

  const t = (result as any[])[0]
  res.status(201).json({
    tag: {
      id: t.id,
      value: t.value,
      products_count: 0,
      created_at: t.created_at,
      updated_at: t.updated_at,
    },
  })
}
