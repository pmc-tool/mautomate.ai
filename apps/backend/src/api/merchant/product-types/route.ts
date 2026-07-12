import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createProductTypesWorkflow } from "@medusajs/core-flows"
import { z } from "zod"
import { resolveMerchant } from "../_helpers"

/**
 * GET /merchant/product-types — tenant-scoped product types with per-type
 * products_count (products in the tenant's sales channel that reference the
 * type). POST creates a tenant-owned type (metadata.tenant_id tagged).
 *
 * Types are GLOBAL in Medusa; we scope via metadata.tenant_id, fail-closed on
 * read. products_count is computed by walking from the OWNING side (product,
 * which carries the real type_id column) — never by filtering a type by a
 * relation FK.
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

async function typeCounts(
  query: any,
  pids: string[]
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {}
  if (!pids.length) return counts
  const { data } = await query.graph({
    entity: "product",
    filters: { id: pids } as any,
    fields: ["id", "type_id"],
    pagination: { take: 10000, skip: 0 } as any,
  })
  for (const p of data || []) {
    if (p.type_id) counts[p.type_id] = (counts[p.type_id] || 0) + 1
  }
  return counts
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    filters: { metadata: { tenant_id: ctx.tenant.id } },
    entity: "product_type",
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
  const counts = await typeCounts(query, pids)

  res.json({
    types: page.map((t: any) => ({
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

  const { result } = await createProductTypesWorkflow(req.scope).run({
    input: {
      product_types: [
        { value: parsed.data.value, metadata: { tenant_id: ctx.tenant.id } },
      ],
    },
  })

  const t = (result as any[])[0]
  res.status(201).json({
    type: {
      id: t.id,
      value: t.value,
      products_count: 0,
      created_at: t.created_at,
      updated_at: t.updated_at,
    },
  })
}
