import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import {
  adProductContext,
  generateAdCopy,
} from "../../../../../modules/marketing/ads/ai"
import { meterAction } from "../../../../../modules/platform/integration/metering-guard"
import { creditsFor } from "../../../../../modules/platform/pricing/price-book"
import { resolveMerchant } from "../../../_helpers"
import { adsStatusFor } from "../../_helpers"

/**
 * POST /merchant/ads/ai/copy — draft the complete ad copy package (headline,
 * primary text, alternatives, an image-scene prompt, an audience hint) for a
 * product + goal via the live text engine.
 *
 * Credits: first draft bills `ai_ad_campaign` (the full campaign draft);
 * `regen: true` re-rolls bill only `ai_text`. Nothing is charged when
 * generation fails.
 *
 * Body: { product_id?, goal, instructions?, regen? }
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const b = (req.body ?? {}) as Record<string, any>
  const goal = b.goal
  try {
    if (!["sales", "traffic", "awareness"].includes(goal)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "`goal` must be sales, traffic, or awareness."
      )
    }
    const product = await adProductContext(
      req.scope,
      ctx.tenant.id,
      b.product_id ?? null,
      ctx.tenant.name ?? "Store"
    )

    const action = b.regen ? "ai_text" : "ai_ad_campaign"
    const metered = await meterAction(
      req.scope,
      ctx.tenant.id,
      action,
      1,
      async () => {
        const draft = await generateAdCopy(req.scope, ctx.tenant.id, {
          product,
          goal,
          instructions: b.instructions ?? null,
          storeName: ctx.tenant.name ?? "Store",
        })
        return { result: draft, actualUnits: 1 }
      }
    )
    if (!metered.ok) {
      return res.status(402).json({
        message: `You're out of AI credits (this needs ${creditsFor(action)}). Top up in Billing.`,
        code: "insufficient_credits",
      })
    }

    res.json({
      draft: metered.result,
      product: {
        id: product.id,
        title: product.title,
        thumbnail: product.thumbnail,
        handle: product.handle,
      },
      credits: creditsFor(action),
    })
  } catch (e: any) {
    res
      .status(adsStatusFor(e))
      .json({ message: e?.message ?? "Ad drafting failed" })
  }
}
