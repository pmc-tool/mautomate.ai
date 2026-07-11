/**
 * Messaging provider registry. Adapters self-register (side-effect on import);
 * the bootstrap `./index.ts` imports every adapter, so reach these getters
 * through `./index`, not directly.
 */

import type { MessagingChannel, MessagingProvider } from "./types"

const providers = new Map<string, MessagingProvider>()

export const registerMessagingProvider = (p: MessagingProvider): void => {
  providers.set(p.channel, p)
}

export const getMessagingProvider = (
  channel: string
): MessagingProvider | null => providers.get(channel) ?? null

export const listMessagingProviders = (): MessagingProvider[] =>
  Array.from(providers.values())

export const listConfiguredMessagingProviders = (): MessagingProvider[] =>
  listMessagingProviders().filter((p) => p.isConfigured())

export type { MessagingChannel, MessagingProvider }
