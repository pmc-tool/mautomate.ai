import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { MARKETING_MODULE } from "../../../../../modules/marketing"
import { resolveMerchant } from "../../../_helpers"

const isNotFound = (e: any): boolean =>
  e?.type === MedusaError.Types.NOT_FOUND ||
  e?.type === "not_found" ||
  /was not found|not found/i.test(e?.message ?? "")

const toAccountDto = (row: any) => ({
  id: row.id,
  platform: row.platform,
  handle: row.handle ?? null,
  display_name: row.display_name ?? null,
  avatar_url: row.avatar_url ?? null,
  status: row.status,
  external_id: row.external_id ?? null,
  connected_at: row.created_at ? new Date(row.created_at).toISOString() : null,
})

/**
 * Load a social account and assert it belongs to the caller's tenant. A missing
 * row OR a foreign tenant_id 404s (fail-closed) and returns null.
 */
const loadOwned = async (
  mk: any,
  id: string,
  tenantId: string,
  res: MedusaResponse
): Promise<any | null> => {
  const account = await mk.retrieveMarketingSocialAccount(id).catch(() => null)
  if (!account || account.tenant_id !== tenantId) {
    res.status(404).json({ message: `Account ${id} was not found` })
    return null
  }
  return account
}

/**
 * GET /merchant/marketing/accounts/:id
 * Retrieve one connected account. Tenant-scoped.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const tenantId = ctx.tenant.id
  const { id } = req.params

  try {
    const mk: any = req.scope.resolve(MARKETING_MODULE)
    const account = await loadOwned(mk, id, tenantId, res)
    if (!account) return
    res.json({ account: toAccountDto(account) })
  } catch (e: any) {
    res.status(isNotFound(e) ? 404 : 500).json({
      message: e?.message ?? "Failed to retrieve account",
    })
  }
}

/**
 * DELETE /merchant/marketing/accounts/:id
 *
 * Disconnect an account: delete the account row and any sealed credential rows
 * for it. Tenant-scoped; verifies ownership first.
 * Response: { id, object, deleted }
 */
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const tenantId = ctx.tenant.id
  const { id } = req.params

  try {
    const mk: any = req.scope.resolve(MARKETING_MODULE)
    const account = await loadOwned(mk, id, tenantId, res)
    if (!account) return

    const creds = await mk.listMarketingSocialCredentials({
      tenant_id: tenantId,
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
