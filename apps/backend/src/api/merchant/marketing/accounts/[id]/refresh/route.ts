import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { MARKETING_MODULE } from "../../../../../../modules/marketing"
import { refreshOAuth } from "../../../../../../modules/marketing/oauth/service"
import { resolveMerchant } from "../../../../_helpers"

const isNotFound = (e: any): boolean =>
  e?.type === MedusaError.Types.NOT_FOUND ||
  e?.type === "not_found" ||
  /was not found|not found/i.test(e?.message ?? "")

/**
 * POST /merchant/marketing/accounts/:id/refresh
 *
 * Refresh the account's access token when it has a refresh_token and is near or
 * past expiry. Tenant-scoped; verifies ownership first.
 * Response: { refreshed: boolean }
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const tenantId = ctx.tenant.id
  const { id } = req.params

  try {
    const mk: any = req.scope.resolve(MARKETING_MODULE)

    const account = await mk
      .retrieveMarketingSocialAccount(id)
      .catch(() => null)
    if (!account || account.tenant_id !== tenantId) {
      res.status(404).json({ message: `Account ${id} was not found` })
      return
    }

    const refreshed = await refreshOAuth(mk, tenantId, id)
    res.json({ refreshed })
  } catch (e: any) {
    res.status(isNotFound(e) ? 404 : 500).json({
      message: e?.message ?? "Failed to refresh account",
    })
  }
}
