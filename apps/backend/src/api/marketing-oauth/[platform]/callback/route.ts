import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resolveTenantId } from "../../../../lib/tenant-context"
import { MARKETING_MODULE } from "../../../../modules/marketing"
import { completeOAuth } from "../../../../modules/marketing/oauth/service"
import {
  adsPlatformFromOAuthKey,
  completeAdsOAuth,
} from "../../../../modules/marketing/ads"

/**
 * GET /marketing-oauth/:platform/callback
 *
 * The provider's OAuth redirect target. This route is intentionally OPEN (no
 * admin/merchant auth) — trust is established by validating the single-use
 * `state` in-handler. On success or failure it redirects the browser back to
 * the Connect screen; tokens are NEVER placed in the redirect URL.
 *
 * Serves BOTH connect flows, split by the platform key:
 *   - social keys (facebook, instagram, x, linkedin) → completeOAuth
 *     (marketing_social_account, publishing destinations)
 *   - ads keys ("ads_<platform>", e.g. ads_meta) → completeAdsOAuth
 *     (ads_connection, the Advertising panel) — redirects to the merchant
 *     dashboard's Advertising connect page.
 *
 * MULTI-TENANT: the account is attributed to the tenant recorded on the
 * oauth_state row (set at start time), NOT a hardwired default. We read that
 * tenant from the state up front so BOTH the success and error redirects land
 * on the correct Connect screen:
 *   - platform-admin default tenant → the admin app Connect page
 *   - a merchant tenant             → the merchant admin Connect page
 */

/** The platform-admin default tenant (env MARKETING_DEFAULT_TENANT, else "default"). */
const DEFAULT_TENANT = resolveTenantId("MARKETING_DEFAULT_TENANT")

const stripSlash = (s: string): string => s.replace(/\/$/, "")

const merchantBase = (): string =>
  stripSlash(process.env.MERCHANT_ADMIN_URL ?? "https://merchant.mautomate.ai")

/** Build the Connect URL for a resolved tenant + flow. */
const connectPathForTenant = (
  tenantId: string | null,
  isAdsFlow: boolean
): string => {
  // Ads connects only exist in the merchant dashboard.
  if (isAdsFlow) {
    return `${merchantBase()}/dashboard/advertising/connect`
  }

  // Merchant tenant → the merchant admin Connect page.
  if (tenantId && tenantId !== DEFAULT_TENANT) {
    return `${merchantBase()}/dashboard/marketing/connect`
  }

  // Platform-admin default tenant → the admin app Connect page.
  const adminBase = stripSlash(
    process.env.MARKETING_ADMIN_URL ?? process.env.MEDUSA_BACKEND_URL ?? ""
  )
  return `${adminBase}/app/marketing/connect`
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const platform = req.params.platform
  const code = req.query.code as string | undefined
  const state = req.query.state as string | undefined
  const providerError = req.query.error as string | undefined

  const adsPlatform = adsPlatformFromOAuthKey(platform)
  const mk: any = req.scope.resolve(MARKETING_MODULE)

  // Resolve the tenant from the state BEFORE completing (completion consumes
  // the state); this drives the redirect target for both success and failure.
  let stateTenantId: string | null = null
  if (state) {
    try {
      const rows = await mk.listMarketingOauthStates({ state })
      const row = Array.isArray(rows) ? rows[0] : rows
      stateTenantId = row?.tenant_id ?? null
    } catch {
      stateTenantId = null
    }
  }

  const connectPath = connectPathForTenant(stateTenantId, Boolean(adsPlatform))
  const redirect = (query: string): void => {
    res.redirect(`${connectPath}?${query}`)
  }

  if (providerError) {
    redirect(`error=${encodeURIComponent(providerError)}`)
    return
  }

  if (!code || !state) {
    redirect(`error=${encodeURIComponent("missing_code_or_state")}`)
    return
  }

  try {
    if (adsPlatform) {
      await completeAdsOAuth(mk, { platform, code, state })
      redirect(`connected=${encodeURIComponent(adsPlatform)}`)
    } else {
      await completeOAuth(mk, { platform, code, state })
      redirect(`connected=${encodeURIComponent(platform)}`)
    }
  } catch (e: any) {
    redirect(`error=${encodeURIComponent(e?.message ?? "connect_failed")}`)
  }
}
