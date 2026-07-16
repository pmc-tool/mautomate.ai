/**
 * Advertising subsystem bootstrap — registers every ads adapter (side-effect
 * imports, mirroring publish/index.ts) and re-exports the surface the routes
 * and jobs use. To add a platform: write the adapter under providers/ and
 * import it here.
 */
import { registerAdsProvider } from "./registry"
import { metaAdsProvider } from "./providers/meta"
import { mockAdsProvider } from "./providers/mock"

registerAdsProvider(metaAdsProvider)
// Demo adapter is registration-gated, not just isConfigured-gated: without the
// env it does not exist at all, so production can never list it.
if (process.env.MARKETING_ADS_MOCK === "1") {
  registerAdsProvider(mockAdsProvider)
}

export {
  getAdsProvider,
  listAdsProviders,
  listConfiguredAdsProviders,
} from "./registry"
export * from "./types"
export {
  startAdsOAuth,
  completeAdsOAuth,
  connectMockAds,
  disconnectAdsConnection,
  ADS_OAUTH_PLATFORM_PREFIX,
  adsPlatformFromOAuthKey,
} from "./connection"
export { openAdsConnectionCredentials } from "./credentials"
export {
  syncConnectionAccounts,
  syncAccountCampaigns,
  syncAccountInsights,
  runAdsSyncForTenant,
  getAdsOverview,
} from "./sync"
export {
  listAccountPixels,
  createAccountPixel,
  requireMetaAccountContext,
  setupTenantPixel,
} from "./pixel"
export { sendPurchaseEvent, buildPurchaseEvent, hashPii } from "./capi"
export {
  buildCatalogFeed,
  syncTenantCatalog,
  storeBaseUrl,
} from "./catalog"
export {
  launchCampaign,
  setCampaignStatus,
  setCampaignBudget,
  requireAccountContext,
} from "./launch"
export {
  getAutopilotSettings,
  runAutopilotForTenant,
  setSetting as setAdsSetting,
} from "./autopilot"
