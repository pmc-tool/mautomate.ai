import { resolveTenantId } from "../../../../../lib/tenant-context"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { MARKETING_MODULE } from "../../../../../modules/marketing"
import { toAccountDto } from "../_dto"

const TENANT_ID = resolveTenantId("MARKETING_DEFAULT_TENANT")

const isNotFound = (e: any): boolean =>
  e?.type === MedusaError.Types.NOT_FOUND ||
  e?.type === "not_found" ||
  /was not found|not found/i.test(e?.message ?? "")

/**
 * GET /admin/marketing/accounts/:id
 *
 * Retrieve one connected account as an AccountDto. Tenant-scoped.
 */
export const GET = async (
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

    res.json({ account: toAccountDto(account) })
  } catch (e: any) {
    res.status(isNotFound(e) ? 404 : 500).json({
      message: e?.message ?? "Failed to retrieve account",
    })
  }
}

/**
 * DELETE /admin/marketing/accounts/:id
 *
 * Disconnect an account: soft-delete the account row and any sealed credential
 * rows for it. Tenant-scoped; verifies ownership first.
 */
export const DELETE = async (
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

    const creds = await mk.listMarketingSocialCredentials({
      tenant_id: TENANT_ID,
      social_account_id: id,
    })
    const credIds = (Array.isArray(creds) ? creds : [])
      .map((c: any) => c?.id)
      .filter(Boolean)
    if (credIds.length) {
      await mk.deleteMarketingSocialCredentials(credIds)
    }

    await mk.deleteMarketingSocialAccounts(id)

    res.json({ id, object: "marketing_social_account", deleted: true })
  } catch (e: any) {
    res.status(isNotFound(e) ? 404 : 500).json({
      message: e?.message ?? "Failed to delete account",
    })
  }
}
