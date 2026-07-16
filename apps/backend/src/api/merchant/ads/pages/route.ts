import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../modules/marketing"
import { ensurePlatformEnv } from "../../../../modules/marketing/platform-credentials"
import {
  getAdsProvider,
  requireAccountContext,
} from "../../../../modules/marketing/ads"
import { resolveMerchant } from "../../_helpers"
import { adsStatusFor } from "../_helpers"

/**
 * GET /merchant/ads/pages?platform=meta — the pages/identities ads can
 * publish as (the wizard's "publish as" picker; Meta: the user's Facebook
 * Pages via pages_show_list).
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    await ensurePlatformEnv(req.scope)
  } catch {
    /* non-blocking */
  }
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const platform = (req.query.platform as string) || "meta"
  const mk: any = req.scope.resolve(MARKETING_MODULE)
  try {
    const provider = getAdsProvider(platform)
    if (!provider) {
      return res.json({ pages: [] })
    }
    const { creds } = await requireAccountContext(mk, ctx.tenant.id, platform)
    const pages = await provider.listPages(creds)
    res.json({ pages })
  } catch (e: any) {
    res
      .status(adsStatusFor(e))
      .json({ message: e?.message ?? "Could not load your pages" })
  }
}
