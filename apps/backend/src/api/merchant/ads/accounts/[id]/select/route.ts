import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { MARKETING_MODULE } from "../../../../../../modules/marketing"
import { resolveMerchant } from "../../../../_helpers"
import { adsStatusFor, toAdAccountDto } from "../../../_helpers"

/**
 * POST /merchant/ads/accounts/:id/select — mark an ad account as used by the
 * panel (or stop using it). Campaign mirroring, insight syncs, and later
 * campaign creation only touch selected accounts.
 *
 * Body: { selected: boolean }
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const b = (req.body ?? {}) as Record<string, any>
  const selected = Boolean(b.selected)
  const mk: any = req.scope.resolve(MARKETING_MODULE)

  try {
    const rows = await mk.listAdsAccounts({
      id: req.params.id,
      tenant_id: ctx.tenant.id,
    })
    const account = Array.isArray(rows) ? rows[0] : rows
    if (!account) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        "This ad account was not found."
      )
    }
    if (selected && account.status !== "active") {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "This ad account is disabled on the platform and cannot be used."
      )
    }

    const updatedRows = await mk.updateAdsAccounts({
      id: account.id,
      selected,
    } as any)
    const updated = Array.isArray(updatedRows) ? updatedRows[0] : updatedRows

    await mk.createAdsActionLogs({
      tenant_id: ctx.tenant.id,
      actor: "merchant",
      action: selected ? "account.selected" : "account.deselected",
      level: "account",
      object_id: account.id,
      external_id: account.external_id,
    } as any)

    res.json({ account: toAdAccountDto(updated ?? account) })
  } catch (e: any) {
    res
      .status(adsStatusFor(e))
      .json({ message: e?.message ?? "Failed to update the ad account" })
  }
}
