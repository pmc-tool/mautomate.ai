import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createShippingProfilesWorkflow } from "@medusajs/core-flows"
import { z } from "zod"
import { resolveMerchant } from "../_helpers"

/**
 * GET /merchant/shipping-profiles
 * Lists this tenant's shipping profiles plus the shared platform default.
 * Profiles are global rows tagged with metadata.tenant_id on creation.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "shipping_profile",
    fields: ["id", "name", "type", "metadata"],
    pagination: { take: 200, skip: 0 } as any,
  })

  const profiles = (data || [])
    .filter((p: any) => p.type === "default" || p.metadata?.tenant_id === ctx.tenant.id)
    .map((p: any) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      is_default: p.type === "default",
      is_own: p.metadata?.tenant_id === ctx.tenant.id,
    }))

  res.json({ shipping_profiles: profiles, count: profiles.length })
}

const CreateSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.string().min(1).max(100).default("default"),
})

/**
 * POST /merchant/shipping-profiles
 * Create a profile tagged to this tenant.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const parsed = CreateSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: "invalid input", issues: parsed.error.issues })
  }

  try {
    const { result } = await createShippingProfilesWorkflow(req.scope).run({
      input: {
        data: [
          {
            name: parsed.data.name,
            type: parsed.data.type,
            metadata: { tenant_id: ctx.tenant.id },
          },
        ],
      },
    })
    res.status(201).json({ shipping_profile: { id: (result as any)?.[0]?.id } })
  } catch (err: any) {
    res.status(400).json({ message: err?.message || "failed to create shipping profile" })
  }
}
