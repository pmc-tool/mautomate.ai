/**
 * Email provider registry. The transport self-registers (side-effect on import);
 * consumers reach it through `./index`. `getEmailProvider()` returns the first
 * configured transport (or null → email subsystem dormant).
 */

import type { EmailProvider } from "./types"

const providers = new Map<string, EmailProvider>()

export const registerEmailProvider = (p: EmailProvider): void => {
  providers.set(p.name, p)
}

export const listEmailProviders = (): EmailProvider[] =>
  Array.from(providers.values())

/** The active transport: the first configured provider, else null. */
export const getEmailProvider = (): EmailProvider | null =>
  listEmailProviders().find((p) => p.isConfigured()) ?? null

export const isEmailConfigured = (): boolean => !!getEmailProvider()

export type { EmailProvider }
