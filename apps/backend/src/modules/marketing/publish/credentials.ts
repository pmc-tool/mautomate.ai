/**
 * Credential vault — the single place OAuth/app-password tokens are encrypted
 * to and decrypted from the `marketing_social_credential` row. Wraps the AES
 * primitives in `../crypto`. Token plaintext NEVER leaves this module except as
 * a decrypted `ProviderCredentials` handed straight to an adapter.
 */

import { sealSecret, openSecret } from "../crypto"
import type { ProviderCredentials } from "./types"

const SEALED_ALG = "aes-256-gcm"

const sealMaybe = (v: string | null | undefined): string | null =>
  v ? sealSecret(v) : null

const openMaybe = (v: string | null | undefined): string | null => {
  if (!v) {
    return null
  }
  try {
    return openSecret(v)
  } catch {
    // A credential we can't decrypt (rotated key, corruption) is treated as
    // absent so the runner marks the account for reconnection rather than crash.
    return null
  }
}

export type SealCredentialsInput = {
  tenantId: string
  socialAccountId: string
  accessToken?: string | null
  refreshToken?: string | null
  tokenType?: string | null
  expiresAt?: Date | null
}

/**
 * Upsert the encrypted credential for an account. `mk` is the marketing module
 * service (typed `any` to match the codebase's service-access pattern).
 */
export const sealCredentials = async (
  mk: any,
  input: SealCredentialsInput
): Promise<void> => {
  const row = {
    tenant_id: input.tenantId,
    social_account_id: input.socialAccountId,
    access_token_enc: sealMaybe(input.accessToken),
    refresh_token_enc: sealMaybe(input.refreshToken),
    token_type: input.tokenType ?? null,
    expires_at: input.expiresAt ?? null,
    sealed_alg: SEALED_ALG,
  }

  const existing = await mk.listMarketingSocialCredentials({
    tenant_id: input.tenantId,
    social_account_id: input.socialAccountId,
  })
  const prior = Array.isArray(existing) ? existing[0] : existing

  if (prior?.id) {
    await mk.updateMarketingSocialCredentials({ id: prior.id, ...row } as any)
  } else {
    await mk.createMarketingSocialCredentials(row as any)
  }
}

/**
 * Load + decrypt the credentials for an account, merging the account's `meta`
 * (site_url, page_id, ig_user_id, …) into `ProviderCredentials.meta`. Returns
 * null when no credential row exists.
 */
export const openCredentials = async (
  mk: any,
  tenantId: string,
  socialAccountId: string
): Promise<ProviderCredentials | null> => {
  const rows = await mk.listMarketingSocialCredentials({
    tenant_id: tenantId,
    social_account_id: socialAccountId,
  })
  const cred = Array.isArray(rows) ? rows[0] : rows
  if (!cred) {
    return null
  }

  let meta: Record<string, any> | null = null
  try {
    const account = await mk.retrieveMarketingSocialAccount(socialAccountId)
    meta = (account?.meta as Record<string, any>) ?? null
  } catch {
    meta = null
  }

  return {
    accessToken: openMaybe(cred.access_token_enc),
    refreshToken: openMaybe(cred.refresh_token_enc),
    tokenType: cred.token_type ?? null,
    expiresAt: cred.expires_at ? new Date(cred.expires_at) : null,
    meta,
  }
}
