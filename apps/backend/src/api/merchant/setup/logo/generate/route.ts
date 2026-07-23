import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import { resolveMerchant } from "../../../_helpers"
import { generateSetupLogos } from "../../../../../modules/marketing/ai/logo-generator"
import { getLedger, withCredits } from "../../../../../modules/platform/credits/metering"

/**
 * POST /merchant/setup/logo/generate
 *
 * Generate a couple of logo options with AI for the setup wizard's brand step.
 * Metered through the credit ledger (ai_logo = image + background removal): the
 * reservation is released automatically if generation throws, so a failed run is
 * never charged. Returns permanent, tenant-namespaced PNG URLs; the merchant
 * picks one and saves it via PATCH /merchant/setup { logo_url }.
 */

const Schema = z.object({
  prompt: z.string().max(400).optional(),
  count: z.number().int().min(1).max(4).optional(),
})

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  if (process.env.AI_EDITOR_ENABLED === "0") {
    return res.status(503).json({ message: "AI is disabled." })
  }
  if (!process.env.NOVITA_API_KEY) {
    return res.status(503).json({ message: "Logo generation is not configured." })
  }

  const parsed = Schema.safeParse(req.body ?? {})
  if (!parsed.success) {
    return res.status(400).json({ message: "invalid input", issues: parsed.error.issues })
  }
  const count = parsed.data.count ?? 2

  const meta = (ctx.tenant.meta ?? {}) as Record<string, any>
  const ledger = getLedger(req.scope)

  try {
    const outcome = await withCredits(
      ledger,
      ctx.tenant.id,
      "ai_logo",
      count,
      async () => {
        const logos = await generateSetupLogos(req.scope, ctx.tenant.id, {
          brandName: ctx.tenant.name || undefined,
          category: (meta.business as any)?.category || undefined,
          prompt: parsed.data.prompt,
          count,
        })
        // Charge for what was actually produced, not what was estimated.
        return { result: logos, actualUnits: logos.length }
      }
    )

    if (!outcome.ok) {
      return res.status(402).json({
        message: "You're out of AI credits for logo generation. Top up in Billing.",
      })
    }
    res.json({ logos: outcome.result, credits_used: outcome.credits })
  } catch (err: any) {
    res.status(400).json({ message: err?.message || "Logo generation failed." })
  }
}
