import { resolveTenantId } from "../../../../../../lib/tenant-context"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { MARKETING_MODULE } from "../../../../../../modules/marketing"
import { refreshOAuth } from "../../../../../../modules/marketing/oauth/service"

const TENANT_ID = resolveTenantId("MARKETING_DEFAULT_TENANT")

const isNotFound = (e: any): boolean =>
  e?.type === MedusaError.Types.NOT_FOUND ||
  e?.type === "not_found" ||
  /was not found|not found/i.test(e?.message ?? "")

/**
 * POST /admin/marketing/accounts/:id/refresh
 *
 * Attempt to refresh the account's access token (when it has a refresh_token
 * and is near/past expiry). Tenant-scoped.
 * Response: { refreshed: boolean }
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params

  try {
    const mk: any = req.scope.resolve(MARKETING_MODULE)

    const account = await mk.retrieveMarketingSocialAccount(id)
    if (!account || account.tenant_id !== TENANT_ID) {
      res.status(404).json({ message: `Account ${id} was not found` })
      return
    }

    const refreshed = await refreshOAuth(mk, TENANT_ID, id)

    res.json({ refreshed })
  } catch (e: any) {
    res.status(isNotFound(e) ? 404 : 500).json({
      message: e?.message ?? "Failed to refresh account",
    })
  }
}
