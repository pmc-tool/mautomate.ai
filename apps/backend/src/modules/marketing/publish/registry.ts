/**
 * Publish provider registry. Adapters register themselves here (side-effect on
 * import); consumers resolve by platform. The bootstrap file `./index.ts` is
 * the ONE place that imports every adapter, guaranteeing registration has run
 * before any getter is called — so import THIS module's getters via `./index`,
 * never directly, unless you have separately ensured the adapters are loaded.
 */

import type { PublishPlatform, PublishProvider } from "./types"

const providers = new Map<string, PublishProvider>()

/** Register an adapter. Last registration for a platform wins. */
export const registerProvider = (provider: PublishProvider): void => {
  providers.set(provider.platform, provider)
}

/** Resolve the adapter for a platform, or null if none is registered. */
export const getPublishProvider = (
  platform: string
): PublishProvider | null => providers.get(platform) ?? null

/** All registered adapters. */
export const listPublishProviders = (): PublishProvider[] =>
  Array.from(providers.values())

/** Adapters whose APP-level integration is configured (ready to connect). */
export const listConfiguredProviders = (): PublishProvider[] =>
  listPublishProviders().filter((p) => p.isConfigured())

/** Whether a platform has a configured adapter (drives connect UI gating). */
export const isPlatformConfigured = (platform: string): boolean => {
  const p = providers.get(platform)
  return !!p && p.isConfigured()
}

export type { PublishPlatform, PublishProvider }
