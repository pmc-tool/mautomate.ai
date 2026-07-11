import { resolveTenantId } from "../../../../lib/tenant-context"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { getContentEngine } from "../_content"

const TENANT_ID = resolveTenantId("MARKETING_DEFAULT_TENANT")

/**
 * POST /admin/marketing/generate-text
 *
 * Stateless "sparkle" text helper for inline editor actions (improve, shorten,
 * expand, fix grammar, translate, ...). Returns generated text without touching
 * any post. `prompt` is required; `action` selects the sparkle behaviour.
 * Body: { prompt, brand_voice_id?, product_ids?, action? }
 * Response: { text }
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const b = (req.body ?? {}) as {
    prompt?: string
    brand_voice_id?: string
    product_ids?: string[]
    action?: string
  }

  try {
    const prompt = b.prompt?.trim()
    if (!prompt) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "A `prompt` is required to generate text."
      )
    }

    const engine = getContentEngine()
    const text = await engine.generateText(req.scope, {
      tenant_id: TENANT_ID,
      prompt,
      brand_voice_id: b.brand_voice_id,
      product_ids: Array.isArray(b.product_ids) ? b.product_ids : undefined,
      action: b.action?.trim(),
    })

    res.json({ text })
  } catch (e: any) {
    const status = e?.type === MedusaError.Types.INVALID_DATA ? 400 : 500
    res.status(status).json({
      message: e?.message ?? "Failed to generate text",
    })
  }
}
