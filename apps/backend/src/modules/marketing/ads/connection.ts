import crypto from "crypto"
import { MedusaError } from "@medusajs/framework/utils"
import { sealSecret } from "../crypto"
import { buildRedirectUri } from "../oauth/config"
import { getAdsProvider } from "./registry"
import { syncConnectionAccounts } from "./sync"

/**
 * Ads connection lifecycle — the OAuth flow that authorizes the Advertising
 * panel on a merchant's ad platform identity, plus sealing/opening its tokens.
 *
 * Deliberately parallel to oauth/service.ts rather than reusing it: the social
 * flow upserts marketing_social_account (a publishing destination) while this
 * flow upserts ads_connection (an advertising principal with far more powerful
 * scopes). Both share the same primitives: marketing_oauth_state rows for
 * CSRF, sealSecret/openSecret (AES-256-GCM, MARKETING_SECRET_KEY) for tokens,
 * and the /marketing-oauth/:platform/callback route — ads flows use the
 * platform key "ads_<platform>" there (e.g. ads_meta), which is how the
 * callback knows to route here instead of the social completer.
 */

const STATE_TTL_MS = 10 * 60 * 1000
const GRAPH = "https://graph.facebook.com/v25.0"

export const ADS_OAUTH_PLATFORM_PREFIX = "ads_"

/** "ads_meta" -> "meta"; null when the key is not an ads OAuth key. */
export const adsPlatformFromOAuthKey = (key: string): string | null =>
  key.startsWith(ADS_OAUTH_PLATFORM_PREFIX)
    ? key.slice(ADS_OAUTH_PLATFORM_PREFIX.length)
    : null

/**
 * The ads consent configuration per OAuth platform. Meta reuses the same app
 * as social publishing (one Meta app, one App Review covering both surfaces);
 * the ads consent adds the ads_* + catalog scopes. catalog_management is
 * requested now so the Phase-2 catalog sync will not force a re-consent.
 */
const ADS_OAUTH: Record<
  string,
  {
    authUrl: string
    tokenUrl: string
    scopes: string[]
    clientIdEnv: string
    clientSecretEnv: string
  }
> = {
  meta: {
    authUrl: "https://www.facebook.com/v25.0/dialog/oauth",
    tokenUrl: `${GRAPH}/oauth/access_token`,
    scopes: [
      "ads_management",
      "ads_read",
      "business_management",
      "pages_show_list",
      "pages_read_engagement",
      "catalog_management",
    ],
    clientIdEnv: "MARKETING_FACEBOOK_APP_ID",
    clientSecretEnv: "MARKETING_FACEBOOK_APP_SECRET",
  },
}

const base64url = (buf: Buffer): string =>
  buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")

const first = <T>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null)

export type StartAdsOAuthInput = {
  tenantId: string
  platform: string
  userId?: string | null
}

/**
 * Begin an ads OAuth connect: persist a single-use state row (platform key
 * "ads_<platform>") and return the consent URL. Fails closed when the
 * platform's app credentials are absent.
 */
export const startAdsOAuth = async (
  mk: any,
  input: StartAdsOAuthInput
): Promise<{ auth_url: string }> => {
  const provider = getAdsProvider(input.platform)
  const config = ADS_OAUTH[input.platform]
  if (!provider || !config || !provider.isConfigured()) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `Advertising on "${input.platform}" is not configured yet. The platform app keys must be set by the operator first.`
    )
  }
  const clientId = process.env[config.clientIdEnv]
  if (!clientId) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `Missing ${config.clientIdEnv} for ${input.platform} ads OAuth.`
    )
  }

  const oauthKey = `${ADS_OAUTH_PLATFORM_PREFIX}${input.platform}`
  const state = base64url(crypto.randomBytes(32))
  const redirectUri = buildRedirectUri(oauthKey)

  await mk.createMarketingOauthStates({
    tenant_id: input.tenantId,
    state,
    platform: oauthKey,
    user_id: input.userId ?? null,
    code_verifier_enc: null,
    redirect_uri: redirectUri,
    expires_at: new Date(Date.now() + STATE_TTL_MS),
  } as any)

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: config.scopes.join(","),
    state,
  })

  return { auth_url: `${config.authUrl}?${params.toString()}` }
}

type TokenResult = {
  access_token: string
  token_type: string | null
  expires_in: number | null
}

const exchangeMetaToken = async (
  form: Record<string, string>
): Promise<TokenResult> => {
  let res: Response
  try {
    res = await fetch(
      `${ADS_OAUTH.meta.tokenUrl}?${new URLSearchParams(form).toString()}`
    )
  } catch (e: any) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Could not reach Meta's token endpoint: ${e?.message ?? "network error"}`
    )
  }
  let data: any = null
  try {
    data = await res.json()
  } catch {
    data = null
  }
  if (!res.ok || !data?.access_token) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      data?.error?.message ?? `Meta token exchange failed (${res.status})`
    )
  }
  return {
    access_token: data.access_token,
    token_type: data.token_type ?? null,
    expires_in: typeof data.expires_in === "number" ? data.expires_in : null,
  }
}

/**
 * Finish an ads OAuth connect: validate the state, exchange the code, upgrade
 * to a long-lived token (Meta short-lived user tokens die within hours; the
 * long-lived exchange buys ~60 days), fetch the identity, upsert the
 * ads_connection with sealed tokens, then best-effort discover its ad
 * accounts so the Connect screen has something to select immediately.
 */
export const completeAdsOAuth = async (
  mk: any,
  input: { platform: string; code: string; state: string }
): Promise<any> => {
  const platform = adsPlatformFromOAuthKey(input.platform) ?? input.platform
  const config = ADS_OAUTH[platform]
  if (!config) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `Platform "${platform}" does not support ads OAuth.`
    )
  }

  const row = first(await mk.listMarketingOauthStates({ state: input.state }))
  if (!row) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Invalid or unknown OAuth state."
    )
  }
  if (row.platform !== `${ADS_OAUTH_PLATFORM_PREFIX}${platform}`) {
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
      "This connect request has expired. Please try again."
    )
  }

  const tenantId = row.tenant_id
  const clientId = process.env[config.clientIdEnv] ?? ""
  const clientSecret = process.env[config.clientSecretEnv] ?? ""
  const redirectUri =
    row.redirect_uri ?? buildRedirectUri(`${ADS_OAUTH_PLATFORM_PREFIX}${platform}`)

  let tokens = await exchangeMetaToken({
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code: input.code,
  })

  // Long-lived upgrade — best-effort: a failure leaves the short token, which
  // still works for the immediate account discovery below.
  try {
    tokens = await exchangeMetaToken({
      grant_type: "fb_exchange_token",
      client_id: clientId,
      client_secret: clientSecret,
      fb_exchange_token: tokens.access_token,
    })
  } catch {
    /* keep the short-lived token */
  }

  // Identity, best-effort — connect works without a display name.
  let externalUserId: string | null = null
  let displayName: string | null = null
  try {
    const res = await fetch(
      `${GRAPH}/me?fields=id,name&access_token=${encodeURIComponent(
        tokens.access_token
      )}`
    )
    const me: any = await res.json()
    if (res.ok) {
      externalUserId = me?.id != null ? String(me.id) : null
      displayName = me?.name ?? null
    }
  } catch {
    /* ignore */
  }

  const existing = first(
    await mk.listAdsConnections({
      tenant_id: tenantId,
      platform,
      ...(externalUserId ? { external_user_id: externalUserId } : {}),
    })
  )

  const payload = {
    tenant_id: tenantId,
    platform,
    external_user_id: externalUserId,
    display_name: displayName,
    scopes: config.scopes,
    access_token_enc: sealSecret(tokens.access_token),
    refresh_token_enc: null,
    token_type: tokens.token_type,
    expires_at: tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : null,
    status: "connected",
    connected_by_user_id: row.user_id ?? null,
  }

  let connection: any
  if (existing?.id) {
    connection = first(
      await mk.updateAdsConnections({ id: existing.id, ...payload } as any)
    )
  } else {
    connection = first(await mk.createAdsConnections(payload as any))
  }

  await mk.updateMarketingOauthStates({
    id: row.id,
    consumed_at: new Date(),
  } as any)

  await mk.createAdsActionLogs({
    tenant_id: tenantId,
    actor: "merchant",
    action: "connection.connected",
    level: "connection",
    object_id: connection.id,
    reason: `Connected ${platform} advertising${
      displayName ? ` as ${displayName}` : ""
    }`,
  } as any)

  // Discover ad accounts now so the Connect screen is immediately useful.
  try {
    await syncConnectionAccounts(mk, connection)
  } catch {
    /* the hourly sweep (or a manual sync) will retry */
  }

  return connection
}

/**
 * Connect the demo platform without OAuth — dev/demo environments only
 * (registration-gated by MARKETING_ADS_MOCK).
 */
export const connectMockAds = async (
  mk: any,
  input: { tenantId: string; userId?: string | null }
): Promise<any> => {
  const provider = getAdsProvider("mock")
  if (!provider || !provider.isConfigured()) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "The demo ads platform is not enabled on this environment."
    )
  }
  const existing = first(
    await mk.listAdsConnections({ tenant_id: input.tenantId, platform: "mock" })
  )
  const payload = {
    tenant_id: input.tenantId,
    platform: "mock",
    external_user_id: "mock-user",
    display_name: "Demo advertiser",
    scopes: [],
    access_token_enc: sealSecret("mock-token"),
    status: "connected",
    connected_by_user_id: input.userId ?? null,
  }
  const connection = existing?.id
    ? first(await mk.updateAdsConnections({ id: existing.id, ...payload } as any))
    : first(await mk.createAdsConnections(payload as any))
  await syncConnectionAccounts(mk, connection)
  return connection
}

/**
 * Disconnect: revoke locally (tokens erased, status flipped) and disable the
 * connection's ad accounts. Rows are kept — history and the action log stay
 * honest — but nothing can authenticate with the platform afterwards.
 */
export const disconnectAdsConnection = async (
  mk: any,
  tenantId: string,
  connectionId: string
): Promise<void> => {
  const connection = first(
    await mk.listAdsConnections({ id: connectionId, tenant_id: tenantId })
  )
  if (!connection) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "This ad platform connection was not found."
    )
  }

  await mk.updateAdsConnections({
    id: connection.id,
    status: "revoked",
    access_token_enc: null,
    refresh_token_enc: null,
    expires_at: null,
  } as any)

  const accounts = await mk.listAdsAccounts(
    { tenant_id: tenantId, connection_id: connection.id },
    { take: 500 }
  )
  for (const account of accounts ?? []) {
    await mk.updateAdsAccounts({
      id: account.id,
      status: "disabled",
      selected: false,
    } as any)
  }

  await mk.createAdsActionLogs({
    tenant_id: tenantId,
    actor: "merchant",
    action: "connection.disconnected",
    level: "connection",
    object_id: connection.id,
    reason: `Disconnected ${connection.platform} advertising`,
  } as any)
}
