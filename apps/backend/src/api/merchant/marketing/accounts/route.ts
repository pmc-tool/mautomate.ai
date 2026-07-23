import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../modules/marketing"
import { listPublishProviders } from "../../../../modules/marketing/publish"
import { resolveMerchant } from "../../_helpers"
import { ensurePlatformEnv } from "../../../../modules/marketing/platform-credentials"

/**
 * Serialize a marketing_social_account row into the shape the merchant Connect
 * UI consumes. Kept local to the merchant tree so it never leaks the sealed
 * credential columns.
 */
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
 * GET /merchant/marketing/accounts
 *
 * List THIS merchant tenant's connected social accounts, plus the provider
 * catalog (with `connected` computed) so the Connect screen can render every
 * platform. Tenant-scoped: only accounts for ctx.tenant.id are returned.
 * Response: { accounts, providers }
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  // Load the platform social APP keys the super-admin saved (encrypted
  // vault -> process.env) BEFORE computing provider.isConfigured(), so the
  // Connect panel reflects the operator setup instead of a cold process
  // (matches accounts/connect + the ads routes). Non-blocking.
  try {
    await ensurePlatformEnv(req.scope)
  } catch {
    /* non-blocking */
  }
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const tenantId = ctx.tenant.id
  const mk: any = req.scope.resolve(MARKETING_MODULE)

  try {
    const rows = await mk.listMarketingSocialAccounts(
      { tenant_id: tenantId },
      { take: 1000, order: { created_at: "DESC" } }
    )
    const accounts = (Array.isArray(rows) ? rows : []).map(toAccountDto)
    const connectedPlatforms = new Set(accounts.map((a: any) => a.platform))

    const providers = listPublishProviders().map((p: any) => ({
      platform: p.platform,
      label: p.label,
      configured: p.isConfigured(),
      connect: p.capabilities.connect,
      connected: connectedPlatforms.has(p.platform),
    }))

    res.json({ accounts, providers })
  } catch (e: any) {
    res.status(500).json({
      message: e?.message ?? "Failed to list social accounts",
    })
  }
}
