import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createRefundReasonsWorkflow } from "@medusajs/core-flows"
import { z } from "zod"
import { resolveMerchant } from "../_helpers"

/**
 * /merchant/refund-reasons — tenant-scoped refund reasons.
 *
 * Refund reasons are GLOBAL entities in the pooled DB. We scope them to this
 * tenant via metadata.tenant_id (tagged at create, fail-closed filter on read),
 * exactly like product tags/types and promotions. Legacy untagged rows are
 * invisible to every merchant.
 */

const CreateSchema = z.object({
  label: z.string().trim().min(1),
  code: z.string().trim().min(1).optional(),
  description: z.string().trim().optional(),
})

function slugCode(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
}

function format(r: any) {
  return {
    id: r.id,
    label: r.label,
    code: r.code,
    description: r.description ?? null,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "refund_reason",
    fields: [
      "id",
      "label",
      "code",
      "description",
      "metadata",
      "created_at",
      "updated_at",
    ],
    pagination: { take: 2000, skip: 0, order: { label: "ASC" } } as any,
  })

  // Fail-closed: only rows tagged with THIS tenant id are visible.
  const owned = (data || []).filter(
    (r: any) => r.metadata?.tenant_id === ctx.tenant.id
  )

  const q =
    typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : ""
  const filtered = q
    ? owned.filter((r: any) =>
        [r.label, r.code, r.description].some(
          (v) => typeof v === "string" && v.toLowerCase().includes(q)
        )
      )
    : owned

  res.json({ refund_reasons: filtered.map(format), count: filtered.length })
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

  const { label, description } = parsed.data
  const code = parsed.data.code?.length
    ? slugCode(parsed.data.code)
    : slugCode(label)
  if (!code) return res.status(400).json({ message: "code is required" })

  const { result } = await createRefundReasonsWorkflow(req.scope).run({
    input: {
      data: [
        {
          label,
          code,
          description: description || null,
          metadata: { tenant_id: ctx.tenant.id },
        },
      ],
    },
  })

  res.status(201).json({ refund_reason: format((result as any[])[0]) })
}
