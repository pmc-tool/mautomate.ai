import { openSecret } from "../crypto"
import type { AdsCredentials } from "./types"

/**
 * Decrypt an ads_connection's sealed tokens for provider calls. Lives in its
 * own file because both the connect flow (connection.ts) and the sync sweep
 * (sync.ts) need it — importing it from either would make them circular.
 *
 * Returns null when tokens are absent or undecryptable (key rotation): the
 * caller treats that as "reconnect required", never as an error to retry.
 */
export const openAdsConnectionCredentials = (
  connection: any
): AdsCredentials | null => {
  if (!connection?.access_token_enc) return null
  try {
    return {
      accessToken: openSecret(connection.access_token_enc),
      refreshToken: connection.refresh_token_enc
        ? openSecret(connection.refresh_token_enc)
        : null,
      expiresAt: connection.expires_at ? new Date(connection.expires_at) : null,
    }
  } catch {
    return null
  }
}
