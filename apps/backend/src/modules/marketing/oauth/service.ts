/**
 * OAuth flow helpers for the marketing connect subsystem. Pure functions that
 * take the resolved marketing module service (`mk`, typed `any` per the
 * codebase's service-access pattern) — they do NOT touch HTTP req/res, so the
 * public callback route and the admin connect route can both drive them.
 *
 * Responsibilities:
 *  - startOAuth: mint state (+ PKCE when required), persist a one-time
 *    marketing_oauth_state row, and return the provider authorize URL.
 *  - completeOAuth: validate the state, exchange the code for tokens, best-effort
 *    fetch a profile, upsert the social account, seal the credentials.
 *  - refreshOAuth: exchange a refresh_token for a fresh access token when near
 *    expiry, tolerating providers that do not support refresh.
 */

import crypto from "crypto"
import { MedusaError } from "@medusajs/framework/utils"
import { sealSecret, openSecret } from "../crypto"
import { getPublishProvider, sealCredentials, openCredentials } from "../publish"
import { getOAuthConfig, buildRedirectUri } from "./config"

const STATE_TTL_MS = 10 * 60 * 1000
const REFRESH_SKEW_MS = 5 * 60 * 1000

const base64url = (buf: Buffer): string =>
  buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")

const first = <T>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null)

type ProfileInfo = {
  external_id: string | null
  handle: string | null
  display_name: string | null
  avatar_url: string | null
}

type TokenResponse = {
  access_token: string | null
  refresh_token: string | null
  token_type: string | null
  expires_in: number | null
}

export type StartOAuthInput = {
  tenantId: string
  platform: string
  userId?: string | null
}

export type CompleteOAuthInput = {
  platform: string
  code: string
  state: string
}

/**
 * Begin an OAuth connect: persist a single-use state row and return the
 * provider's authorize URL. Throws NOT_ALLOWED when the platform's app-level
 * integration is not configured.
 */
export const startOAuth = async (
  mk: any,
  input: StartOAuthInput
): Promise<{ auth_url: string }> => {
  const provider = getPublishProvider(input.platform)
  const config = getOAuthConfig(input.platform)

  if (!provider || !config || !provider.isConfigured()) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `Platform "${input.platform}" is not configured for OAuth connect.`
    )
  }

  const clientId = process.env[config.clientIdEnv]
  if (!clientId) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `Missing ${config.clientIdEnv} for ${input.platform} OAuth.`
    )
  }

  const state = base64url(crypto.randomBytes(32))
  const redirectUri = buildRedirectUri(input.platform)

  let codeVerifier: string | null = null
  let codeChallenge: string | null = null
  if (config.usePkce) {
    codeVerifier = base64url(crypto.randomBytes(32))
    codeChallenge = base64url(
      crypto.createHash("sha256").update(codeVerifier).digest()
    )
  }

  await mk.createMarketingOauthStates({
    tenant_id: input.tenantId,
    state,
    platform: input.platform,
    user_id: input.userId ?? null,
    code_verifier_enc: codeVerifier ? sealSecret(codeVerifier) : null,
    redirect_uri: redirectUri,
    expires_at: new Date(Date.now() + STATE_TTL_MS),
  } as any)

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: config.scopes.join(" "),
    state,
  })
  if (config.usePkce && codeChallenge) {
    params.set("code_challenge", codeChallenge)
    params.set("code_challenge_method", "S256")
  }

  return { auth_url: `${config.authUrl}?${params.toString()}` }
}

const exchangeToken = async (
  tokenUrl: string,
  form: Record<string, string>
): Promise<TokenResponse> => {
  let res: Response
  try {
    res = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams(form).toString(),
    })
  } catch (e) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Could not reach the token endpoint: ${(e as Error).message}`
    )
  }

  let data: any = null
  try {
    data = await res.json()
  } catch {
    data = null
  }

  if (!res.ok || !data?.access_token) {
    const message =
      data?.error_description ??
      data?.error ??
      `Token exchange failed with status ${res.status}`
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      typeof message === "string" ? message : "Token exchange failed"
    )
  }

  return {
    access_token: data.access_token ?? null,
    refresh_token: data.refresh_token ?? null,
    token_type: data.token_type ?? null,
    expires_in:
      typeof data.expires_in === "number" ? data.expires_in : null,
  }
}

const emptyProfile = (): ProfileInfo => ({
  external_id: null,
  handle: null,
  display_name: null,
  avatar_url: null,
})

/** Best-effort profile lookup; never throws — connect works without it. */
const fetchProfile = async (
  platform: string,
  accessToken: string
): Promise<ProfileInfo> => {
  try {
    if (platform === "facebook" || platform === "instagram") {
      const res = await fetch(
        `https://graph.facebook.com/v19.0/me?fields=id,name,picture&access_token=${encodeURIComponent(
          accessToken
        )}`
      )
      const data: any = await res.json()
      if (!res.ok) return emptyProfile()
      return {
        external_id: data?.id != null ? String(data.id) : null,
        handle: data?.name ?? null,
        display_name: data?.name ?? null,
        avatar_url: data?.picture?.data?.url ?? null,
      }
    }

    if (platform === "x") {
      const res = await fetch(
        "https://api.twitter.com/2/users/me?user.fields=profile_image_url,username,name",
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      const data: any = await res.json()
      const u = data?.data
      if (!res.ok || !u) return emptyProfile()
      return {
        external_id: u?.id != null ? String(u.id) : null,
        handle: u?.username ?? null,
        display_name: u?.name ?? null,
        avatar_url: u?.profile_image_url ?? null,
      }
    }

    if (platform === "linkedin") {
      const res = await fetch("https://api.linkedin.com/v2/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const data: any = await res.json()
      if (!res.ok) return emptyProfile()
      return {
        external_id: data?.sub != null ? String(data.sub) : null,
        handle: data?.email ?? data?.name ?? null,
        display_name: data?.name ?? null,
        avatar_url: data?.picture ?? null,
      }
    }
  } catch {
    return emptyProfile()
  }
  return emptyProfile()
}

/**
 * Finish an OAuth connect: validate the persisted state, exchange the code,
 * upsert the social account (matched by tenant+platform+external_id), seal the
 * tokens, and mark the state consumed. Returns the account row.
 */
export const completeOAuth = async (
  mk: any,
  input: CompleteOAuthInput
): Promise<any> => {
  const config = getOAuthConfig(input.platform)
  if (!config) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `Platform "${input.platform}" does not support OAuth connect.`
    )
  }

  const row = first(
    await mk.listMarketingOauthStates({ state: input.state })
  )
  if (!row) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Invalid or unknown OAuth state."
    )
  }
  if (row.platform !== input.platform) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "OAuth state does not match the callback platform."
    )
  }
  if (row.consumed_at) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "This OAuth state has already been used."
    )
  }
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "This OAuth request has expired. Please try connecting again."
    )
  }

  const tenantId = row.tenant_id
  const clientId = process.env[config.clientIdEnv] ?? ""
  const clientSecret = process.env[config.clientSecretEnv] ?? ""
  const redirectUri = row.redirect_uri ?? buildRedirectUri(input.platform)

  const form: Record<string, string> = {
    grant_type: "authorization_code",
    code: input.code,
    client_id: clientId,
    redirect_uri: redirectUri,
  }
  if (clientSecret) {
    form.client_secret = clientSecret
  }
  if (config.usePkce && row.code_verifier_enc) {
    try {
      form.code_verifier = openSecret(row.code_verifier_enc)
    } catch {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Could not recover the PKCE verifier for this OAuth request."
      )
    }
  }

  const tokens = await exchangeToken(config.tokenUrl, form)

  const profile = await fetchProfile(
    input.platform,
    tokens.access_token as string
  )

  const existing = first(
    await mk.listMarketingSocialAccounts({
      tenant_id: tenantId,
      platform: input.platform,
      ...(profile.external_id ? { external_id: profile.external_id } : {}),
    })
  )

  const accountPayload = {
    tenant_id: tenantId,
    platform: input.platform,
    external_id: profile.external_id,
    handle: profile.handle,
    display_name: profile.display_name,
    avatar_url: profile.avatar_url,
    scopes: config.scopes,
    status: "connected",
    connected_by_user_id: row.user_id ?? null,
  }

  let account: any
  if (existing?.id) {
    account = await mk.updateMarketingSocialAccounts({
      id: existing.id,
      ...accountPayload,
    } as any)
    account = first(account) ?? account
  } else {
    account = await mk.createMarketingSocialAccounts(accountPayload as any)
    account = first(account) ?? account
  }

  await sealCredentials(mk, {
    tenantId,
    socialAccountId: account.id,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    tokenType: tokens.token_type,
    expiresAt: tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : null,
  })

  await mk.updateMarketingOauthStates({
    id: row.id,
    consumed_at: new Date(),
  } as any)

  return account
}

/**
 * Refresh an account's access token when it has a refresh_token and is near or
 * past expiry. Returns whether a refresh actually happened; tolerates providers
 * that do not support refresh (returns false rather than throwing).
 */
export const refreshOAuth = async (
  mk: any,
  tenantId: string,
  socialAccountId: string
): Promise<boolean> => {
  const creds = await openCredentials(mk, tenantId, socialAccountId)
  if (!creds?.refreshToken) {
    return false
  }

  const notNearExpiry =
    creds.expiresAt &&
    creds.expiresAt.getTime() - Date.now() > REFRESH_SKEW_MS
  if (notNearExpiry) {
    return false
  }

  let account: any
  try {
    account = await mk.retrieveMarketingSocialAccount(socialAccountId)
  } catch {
    return false
  }
  if (!account || account.tenant_id !== tenantId) {
    return false
  }

  const config = getOAuthConfig(account.platform)
  if (!config) {
    return false
  }

  const clientId = process.env[config.clientIdEnv] ?? ""
  const clientSecret = process.env[config.clientSecretEnv] ?? ""

  const form: Record<string, string> = {
    grant_type: "refresh_token",
    refresh_token: creds.refreshToken,
    client_id: clientId,
  }
  if (clientSecret) {
    form.client_secret = clientSecret
  }

  let tokens: TokenResponse
  try {
    tokens = await exchangeToken(config.tokenUrl, form)
  } catch {
    return false
  }

  await sealCredentials(mk, {
    tenantId,
    socialAccountId,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? creds.refreshToken,
    tokenType: tokens.token_type ?? creds.tokenType,
    expiresAt: tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : null,
  })

  return true
}
