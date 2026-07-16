import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../modules/marketing"
import { ensurePlatformEnv } from "../../../../modules/marketing/platform-credentials"
import { listAdsProviders } from "../../../../modules/marketing/ads"
import { resolveMerchant } from "../../_helpers"
import { adsStatusFor, toAdAccountDto, toConnectionDto } from "../_helpers"

/**
 * GET /merchant/ads/accounts
 *
 * The Connect screen's data: this tenant's ad-platform connections and the ad
 * accounts discovered under them, plus which platforms exist and whether each
 * is configured at the app level (drives the honest "not switched on yet"
 * state instead of a broken connect button).
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    await ensurePlatformEnv(req.scope)
  } catch {
    /* non-blocking */
  }
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const mk: any = req.scope.resolve(MARKETING_MODULE)
  try {
    const [connections, accounts] = await Promise.all([
      mk.listAdsConnections(
        { tenant_id: ctx.tenant.id },
        { take: 20, order: { created_at: "DESC" } }
      ),
      mk.listAdsAccounts(
        { tenant_id: ctx.tenant.id },
        { take: 200, order: { created_at: "DESC" } }
      ),
    ])

    res.json({
      connections: (connections ?? []).map(toConnectionDto),
      accounts: (accounts ?? []).map(toAdAccountDto),
      platforms: listAdsProviders().map((p) => ({
        platform: p.platform,
        label: p.capabilities.label,
        connect: p.capabilities.connect,
        configured: p.isConfigured(),
      })),
    })
  } catch (e: any) {
    res
      .status(adsStatusFor(e))
      .json({ message: e?.message ?? "Failed to load ad accounts" })
  }
}
