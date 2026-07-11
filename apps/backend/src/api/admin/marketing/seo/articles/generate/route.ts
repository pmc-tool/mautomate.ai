import { resolveTenantId } from "../../../../../../lib/tenant-context"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { generateArticle } from "../../../../../../modules/marketing/seo/seo-service"

const TENANT_ID = resolveTenantId("MARKETING_DEFAULT_TENANT")

/**
 * POST /admin/marketing/seo/articles/generate
 *
 * Generate a full, product-grounded blog article from a brief. Persists a draft
 * article, caches the markdown body + meta on the source brief, and returns the
 * body for immediate rendering. Degrades to `needs_ai` when no AI provider is
 * configured (never 500).
 * Body: { brief_id, brand_voice_id?, product_ids? }
 * Response: { article, body, meta_description, seo_score, needs_ai }
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const b = (req.body ?? {}) as {
    brief_id?: string
    brand_voice_id?: string
    product_ids?: string[]
  }

  try {
    if (!b.brief_id) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "A `brief_id` is required to generate an article."
      )
    }

    const result = await generateArticle(req.scope, {
      tenantId: TENANT_ID,
      briefId: b.brief_id,
      brandVoiceId: b.brand_voice_id,
      productIds: Array.isArray(b.product_ids) ? b.product_ids : undefined,
    })

    if (!result.article) {
      res.status(404).json({ message: `Brief ${b.brief_id} was not found` })
      return
    }

    res.status(201).json({
      article: result.article,
      body: result.body,
      meta_description: result.meta_description,
      seo_score: result.seo_score,
      needs_ai: result.needs_ai ?? false,
    })
  } catch (e: any) {
    const status = e?.type === MedusaError.Types.INVALID_DATA ? 400 : 500
    res.status(status).json({
      message: e?.message ?? "Failed to generate article",
    })
  }
}
