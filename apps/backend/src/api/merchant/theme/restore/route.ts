import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resolveMerchant } from "../../_helpers"
import {
  restorePreviousHome,
  hasRestorableHome,
  restoreStoreChrome,
  hasRestorableChrome,
} from "../../_theme-content"

/**
 * GET  /merchant/theme/restore  — is there a previous design to roll back to?
 * POST /merchant/theme/restore  — roll the storefront home back to the design
 *                                 that was live before the last theme switch /
 *                                 reset (re-promotes the most recent demoted
 *                                 home snapshot from history).
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  const [home, chrome] = await Promise.all([
    hasRestorableHome(req.scope, ctx.tenant.id).catch(() => false),
    hasRestorableChrome(req.scope, ctx.tenant.id).catch(() => false),
  ])
  res.json({ restorable: home || chrome })
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  try {
    const [home, chrome] = await Promise.all([
      restorePreviousHome(req.scope, ctx.tenant.id),
      restoreStoreChrome(req.scope, ctx.tenant.id),
    ])
    if (!home && !chrome) {
      return res.status(404).json({ message: "no previous design to restore" })
    }
    res.json({ restored: true })
  } catch (err: any) {
    res.status(400).json({ message: err?.message || "could not restore the previous design" })
  }
}
