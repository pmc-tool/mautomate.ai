import type { AdsPlatform, AdsProvider } from "./types"

/**
 * In-memory ads provider registry — mirrors publish/registry.ts. Adapters
 * self-register via the side-effect imports in ads/index.ts; everything else
 * looks providers up here and never imports an adapter directly.
 */

const providers = new Map<AdsPlatform, AdsProvider>()

export const registerAdsProvider = (provider: AdsProvider): void => {
  providers.set(provider.platform, provider)
}

export const getAdsProvider = (platform: string): AdsProvider | null =>
  providers.get(platform as AdsPlatform) ?? null

export const listAdsProviders = (): AdsProvider[] =>
  Array.from(providers.values())

/** Providers whose platform-level app credentials are actually present. */
export const listConfiguredAdsProviders = (): AdsProvider[] =>
  listAdsProviders().filter((p) => p.isConfigured())
