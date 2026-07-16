import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { MARKETING_MODULE } from "../../../../../modules/marketing"
import { ensurePlatformEnv } from "../../../../../modules/marketing/platform-credentials"
import {
  connectMockAds,
  getAdsProvider,
  startAdsOAuth,
} from "../../../../../modules/marketing/ads"
import { resolveMerchant } from "../../../_helpers"
import { adsStatusFor, toConnectionDto } from "../../_helpers"

/**
 * POST /merchant/ads/accounts/connect
 *
 * Start connecting an ad platform for THIS merchant's tenant.
 *   - oauth (meta)  → { auth_url } for the platform consent screen; the state
 *                     row carries ctx.tenant.id so the public callback
 *                     attributes the connection to this merchant.
 *   - direct (mock) → connects immediately (dev/demo environments only).
 *
 * Body: { platform }
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    await ensurePlatformEnv(req.scope)
  } catch {
    /* non-blocking */
  }
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const b = (req.body ?? {}) as Record<string, any>
  const platform = b.platform as string
  const userId = (req as any).auth_context?.actor_id ?? null
  const mk: any = req.scope.resolve(MARKETING_MODULE)

  try {
    if (!platform) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "`platform` is required."
      )
    }
    const provider = getAdsProvider(platform)
    if (!provider) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Advertising on "${platform}" is not available yet.`
      )
    }

    if (provider.capabilities.connect === "oauth") {
      const { auth_url } = await startAdsOAuth(mk, {
        tenantId: ctx.tenant.id,
        platform,
        userId,
      })
      res.json({ auth_url })
      return
    }

    const connection = await connectMockAds(mk, {
      tenantId: ctx.tenant.id,
      userId,
    })
    res.status(201).json({ connection: toConnectionDto(connection) })
  } catch (e: any) {
    res
      .status(adsStatusFor(e))
      .json({ message: e?.message ?? "Failed to start the connection" })
  }
}
