import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  createTaxRegionsWorkflow,
  createTaxRatesWorkflow,
} from "@medusajs/core-flows"
import { z } from "zod"
import { resolveMerchant } from "../../../_helpers"

/**
 * POST /merchant/tax-regions/:id/provinces — create a sublevel (province) tax
 * region under a tenant-owned country region. The child inherits the parent's
 * country_code, carries the province_code, and is tagged metadata.tenant_id.
 * An optional default tax rate (with combinable flag) is created afterwards.
 */

const CreateSchema = z.object({
  province_code: z.string().trim().min(1),
  is_combinable: z.boolean().optional().default(false),
  default_tax_rate: z
    .object({
      name: z.string().trim().min(1),
      code: z.string().trim().optional(),
      rate: z.number().optional(),
    })
    .optional(),
})

async function ownedRegion(req: MedusaRequest, tenantId: string, id: string) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "tax_region",
    filters: { id } as any,
    fields: ["id", "country_code", "parent_id", "metadata"],
  })
  const r = (data || [])[0]
  if (!r || r.metadata?.tenant_id !== tenantId) return null
  return r
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const { id } = req.params
  const parent = await ownedRegion(req, ctx.tenant.id, id)
  if (!parent) return res.status(404).json({ message: "tax region not found" })
  if (parent.parent_id) {
    return res.status(400).json({
      message: "provinces can only be created under a top-level tax region",
    })
  }

  const parsed = CreateSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    return res
      .status(400)
      .json({ message: "invalid input", issues: parsed.error.issues })
  }

  const { province_code, is_combinable, default_tax_rate } = parsed.data

  let child: any
  try {
    const { result } = await createTaxRegionsWorkflow(req.scope).run({
      input: [
        {
          country_code: parent.country_code,
          province_code: province_code.toLowerCase(),
          parent_id: parent.id,
          metadata: { tenant_id: ctx.tenant.id },
        },
      ],
    })
    child = (result as any[])[0]
  } catch (e: any) {
    const msg = String(e?.message || "")
    if (/unique|already|duplicate/i.test(msg)) {
      return res.status(409).json({
        message:
          "A tax region for this province is already configured on the platform.",
      })
    }
    return res.status(400).json({ message: msg || "failed to create province" })
  }

  if (default_tax_rate) {
    await createTaxRatesWorkflow(req.scope).run({
      input: [
        {
          tax_region_id: child.id,
          name: default_tax_rate.name,
          code: default_tax_rate.code || null,
          rate: default_tax_rate.rate ?? null,
          is_default: true,
          is_combinable,
          metadata: { tenant_id: ctx.tenant.id },
        },
      ],
    })
  }

  res.status(201).json({
    tax_region: {
      id: child.id,
      country_code: child.country_code,
      province_code: child.province_code ?? null,
      parent_id: child.parent_id ?? null,
      created_at: child.created_at,
      updated_at: child.updated_at,
    },
  })
}
