import { resolveTenantId } from "../../../../lib/tenant-context"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../modules/marketing"
import { listPublishProviders } from "../../../../modules/marketing/publish"
import { toAccountDto } from "./_dto"

const TENANT_ID = resolveTenantId("MARKETING_DEFAULT_TENANT")

/** Per-platform connect info for the Connect UI (independent of accounts). */
type ProviderInfoDto = {
  platform: string
  label: string
  configured: boolean
  connect: string
  connected: boolean
}

/**
 * GET /admin/marketing/accounts
 *
 * The Connect screen's payload: every tenant social account serialized as an
 * AccountDto, plus the full provider catalog as ProviderInfoDto (with
 * `connected` computed from the accounts).
 * Response: { accounts: AccountDto[], providers: ProviderInfoDto[] }
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const mk: any = req.scope.resolve(MARKETING_MODULE)

    const rows = await mk.listMarketingSocialAccounts({
      tenant_id: TENANT_ID,
    })
    const accounts = (Array.isArray(rows) ? rows : []).map(toAccountDto)

    const connectedPlatforms = new Set(accounts.map((a) => a.platform))

    const providers: ProviderInfoDto[] = listPublishProviders().map((p) => ({
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
