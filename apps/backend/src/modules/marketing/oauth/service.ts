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
  form: Record<string, string>,
  basicAuth?: { clientId: string; clientSecret: string } | null
): Promise<TokenResponse> => {
  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
    Accept: "application/json",
  }
  if (basicAuth) {
    headers.Authorization = `Basic ${Buffer.from(
      `${basicAuth.clientId}:${basicAuth.clientSecret}`
    ).toString("base64")}`
  }
  let res: Response
  try {
    res = await fetch(tokenUrl, {
      method: "POST",
      headers,
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
    // Providers disagree on error shape: OAuth2 spec uses error/
    // error_description STRINGS, but Facebook nests an OBJECT under `error`
    // ({message, type, code}). The old extraction treated the object as
    // unusable and collapsed every Facebook failure into a bare "Token
    // exchange failed", hiding the real reason (used code, redirect
    // mismatch, app restriction, ...).
    const raw =
      data?.error_description ??
      (typeof data?.error === "string" ? data.error : null) ??
      data?.error?.message ??
      null
    const message =
      typeof raw === "string" && raw
        ? raw
        : `Token exchange failed with status ${res.status}`
    // eslint-disable-next-line no-console
    console.error(
      `[marketing-oauth] token exchange failed (${res.status}):`,
      JSON.stringify(data ?? {}).slice(0, 500)
    )
    // The single most common failure is a reused single-use code (browser
    // refresh / double navigation of the callback URL) — say so plainly.
    const friendly = /authorization code has been used|code was already redeemed|invalid_grant/i.test(
      message
    )
      ? "This sign-in link was already used. Click Connect again to restart."
      : message
    throw new MedusaError(MedusaError.Types.INVALID_DATA, friendly)
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

/** Subscribe a Page to the app's webhooks so Meta DELIVERS its Messenger /
 * Instagram messages. Best-effort: a login without messaging permissions
 * still connects for publishing; the failure is logged. */
const subscribePageWebhooks = async (
  pageId: string,
  pageToken: string
): Promise<void> => {
  try {
    const sub = await fetch(
      `https://graph.facebook.com/v19.0/${pageId}/subscribed_apps`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          subscribed_fields: "messages,messaging_postbacks",
          access_token: pageToken,
        }).toString(),
      }
    )
    const body: any = await sub.json().catch(() => null)
    if (!sub.ok || body?.success !== true) {
      // eslint-disable-next-line no-console
      console.error(
        `[marketing-oauth] page ${pageId} webhook subscription failed:`,
        JSON.stringify(body ?? {}).slice(0, 300)
      )
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(
      `[marketing-oauth] page ${pageId} webhook subscription errored:`,
      (e as Error).message
    )
  }
}

/** List the Pages a Meta user token manages (paginated, with the requested
 * fields). Throws INVALID_DATA with Meta's own explanation on failure. */
const listUserPages = async (
  userToken: string,
  fields: string
): Promise<any[]> => {
  const pages: any[] = []
  let url: string | null =
    `https://graph.facebook.com/v19.0/me/accounts?fields=${encodeURIComponent(
      fields
    )}&limit=100&access_token=${encodeURIComponent(userToken)}`
  for (let i = 0; i < 5 && url; i++) {
    let res: Response
    try {
      res = await fetch(url)
    } catch (e) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Could not reach Facebook to list your Pages: ${(e as Error).message}`
      )
    }
    const data: any = await res.json().catch(() => null)
    if (!res.ok) {
      const err = data?.error
      // eslint-disable-next-line no-console
      console.error(
        `[marketing-oauth] listing Pages failed (${res.status}):`,
        JSON.stringify(err ?? {}).slice(0, 400)
      )
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        String(
          err?.error_user_msg ??
            err?.message ??
            "Could not list your Facebook Pages."
        )
      )
    }
    pages.push(...(data?.data ?? []))
    url = data?.paging?.next ?? null
  }
  return pages
}

/**
 * Turn a Facebook login into connected PAGE accounts — one row per Page the
 * login manages, each sealed with its own Page access token (Page tokens
 * from /me/accounts do not expire while the underlying user session lives).
 * Existing rows for the same Page are updated in place, so reconnecting or
 * adding Pages never disconnects the ones already there. The legacy
 * user-identity row (pre-pages model) is retired afterwards — it was never
 * a publishable destination.
 */
const connectFacebookPages = async (
  mk: any,
  input: {
    tenantId: string
    scopes: string[]
    connectedByUserId: string | null
    userToken: string
    userProfile: ProfileInfo
  }
): Promise<any> => {
  const pages = await listUserPages(
    input.userToken,
    "id,name,access_token,picture"
  )

  if (!pages.length) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "This Facebook login does not manage any Pages. Create a Page (or get admin access to one), then connect again — and make sure you keep the Pages selected in Facebook's permission screen."
    )
  }

  let firstAccount: any = null
  for (const page of pages) {
    if (!page?.id || !page?.access_token) continue
    const existing = first(
      await mk.listMarketingSocialAccounts({
        tenant_id: input.tenantId,
        platform: "facebook",
        external_id: String(page.id),
      })
    )
    const payload = {
      tenant_id: input.tenantId,
      platform: "facebook",
      external_id: String(page.id),
      handle: page.name ?? null,
      display_name: page.name ?? null,
      avatar_url: page?.picture?.data?.url ?? null,
      scopes: input.scopes,
      status: "connected",
      connected_by_user_id: input.connectedByUserId,
      meta: {
        ...((existing?.meta as Record<string, unknown>) ?? {}),
        kind: "page",
        page_id: String(page.id),
        via_user_id: input.userProfile.external_id,
        via_user_name: input.userProfile.display_name,
      },
    }
    let account: any
    if (existing?.id) {
      account = await mk.updateMarketingSocialAccounts({
        id: existing.id,
        ...payload,
      } as any)
      account = first(account) ?? account
    } else {
      account = await mk.createMarketingSocialAccounts(payload as any)
      account = first(account) ?? account
    }
    await sealCredentials(mk, {
      tenantId: input.tenantId,
      socialAccountId: account.id,
      accessToken: page.access_token,
      refreshToken: null,
      tokenType: "bearer",
      expiresAt: null,
    })

    // Subscribe the Page to the app so Facebook DELIVERS its Messenger
    // messages to our webhook — without this, the inbox never receives
    // anything for the page.
    await subscribePageWebhooks(String(page.id), page.access_token)
    firstAccount = firstAccount ?? account
  }

  if (!firstAccount) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Facebook returned Pages without access tokens — grant the Pages permissions on the consent screen and try again."
    )
  }

  // Retire the legacy USER-identity row so it stops masquerading as a
  // destination (best-effort; a failure here never breaks the connect).
  if (input.userProfile.external_id) {
    try {
      const stale = await mk.listMarketingSocialAccounts({
        tenant_id: input.tenantId,
        platform: "facebook",
        external_id: input.userProfile.external_id,
      })
      for (const s of Array.isArray(stale) ? stale : []) {
        await mk.softDeleteMarketingSocialAccounts([s.id])
      }
    } catch {
      /* legacy row cleanup only */
    }
  }

  return firstAccount
}

/**
 * Turn an Instagram (Meta) login into connected IG BUSINESS accounts — one
 * row per Instagram professional account linked to the login's Facebook
 * Pages, keyed by ig user id (what the publisher and the DM inbox address)
 * and sealed with the linked Page's token (which IG publishing and the IG
 * Send API both use). The linked Page is also subscribed to the app so IG
 * Direct messages are delivered.
 */
const connectInstagramAccounts = async (
  mk: any,
  input: {
    tenantId: string
    scopes: string[]
    connectedByUserId: string | null
    userToken: string
    userProfile: ProfileInfo
  }
): Promise<any> => {
  const pages = await listUserPages(
    input.userToken,
    "id,name,access_token,instagram_business_account{id,username,profile_picture_url}"
  )
  const linked = pages.filter(
    (p: any) => p?.instagram_business_account?.id && p?.access_token
  )

  if (!linked.length) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "No Instagram professional account is linked to your Facebook Pages. In Instagram: Settings, switch to a Professional account and connect it to your Facebook Page — then connect again."
    )
  }

  let firstAccount: any = null
  for (const page of linked) {
    const ig = page.instagram_business_account
    const igId = String(ig.id)
    const existing = first(
      await mk.listMarketingSocialAccounts({
        tenant_id: input.tenantId,
        platform: "instagram",
        external_id: igId,
      })
    )
    const payload = {
      tenant_id: input.tenantId,
      platform: "instagram",
      external_id: igId,
      handle: ig.username ?? null,
      display_name: ig.username ?? null,
      avatar_url: ig.profile_picture_url ?? null,
      scopes: input.scopes,
      status: "connected",
      connected_by_user_id: input.connectedByUserId,
      meta: {
        ...((existing?.meta as Record<string, unknown>) ?? {}),
        kind: "ig_business",
        ig_user_id: igId,
        page_id: String(page.id),
        via_user_id: input.userProfile.external_id,
        via_user_name: input.userProfile.display_name,
      },
    }
    let account: any
    if (existing?.id) {
      account = await mk.updateMarketingSocialAccounts({
        id: existing.id,
        ...payload,
      } as any)
      account = first(account) ?? account
    } else {
      account = await mk.createMarketingSocialAccounts(payload as any)
      account = first(account) ?? account
    }
    await sealCredentials(mk, {
      tenantId: input.tenantId,
      socialAccountId: account.id,
      accessToken: page.access_token,
      refreshToken: null,
      tokenType: "bearer",
      expiresAt: null,
    })
    await subscribePageWebhooks(String(page.id), page.access_token)
    firstAccount = firstAccount ?? account
  }

  // Retire the legacy IG user-identity row (same pre-pages defect as
  // facebook) — best-effort.
  if (input.userProfile.external_id) {
    try {
      const stale = await mk.listMarketingSocialAccounts({
        tenant_id: input.tenantId,
        platform: "instagram",
        external_id: input.userProfile.external_id,
      })
      for (const s of Array.isArray(stale) ? stale : []) {
        await mk.softDeleteMarketingSocialAccounts([s.id])
      }
    } catch {
      /* legacy row cleanup only */
    }
  }

  return firstAccount
}

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

  const useBasic = !!config.tokenAuthBasic && !!clientId && !!clientSecret
  const form: Record<string, string> = {
    grant_type: "authorization_code",
    code: input.code,
    client_id: clientId,
    redirect_uri: redirectUri,
  }
  if (clientSecret && !useBasic) {
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

  const tokens = await exchangeToken(
    config.tokenUrl,
    form,
    useBasic ? { clientId, clientSecret } : null
  )

  // The provider code is single-use and is now SPENT — consume the state
  // immediately so a callback refresh/retry gets the clear "already used"
  // message instead of re-exchanging the burned code and surfacing a
  // confusing provider error. (Previously the state was consumed only after
  // every downstream step succeeded, so any late failure created exactly
  // that retry trap.)
  await mk.updateMarketingOauthStates({
    id: row.id,
    consumed_at: new Date(),
  } as any)

  const profile = await fetchProfile(
    input.platform,
    tokens.access_token as string
  )

  // Facebook connects PAGES, not the login: a user token cannot publish
  // anywhere, and the publisher/inbox address accounts BY PAGE ID. Every
  // Page this login manages becomes its own connected account row (with its
  // own Page token), so a merchant can run 1, 5 or all of their Pages at
  // once — connecting again upserts rather than replacing.
  if (input.platform === "facebook") {
    const account = await connectFacebookPages(mk, {
      tenantId,
      scopes: config.scopes,
      connectedByUserId: row.user_id ?? null,
      userToken: tokens.access_token as string,
      userProfile: profile,
    })
    return account
  }

  // Instagram likewise connects the IG BUSINESS ACCOUNTS linked to the
  // login's Pages: the publisher addresses accounts by ig user id and the
  // DM inbox attributes by the receiving IG account id — a user-identity
  // row satisfies neither.
  if (input.platform === "instagram") {
    const account = await connectInstagramAccounts(mk, {
      tenantId,
      scopes: config.scopes,
      connectedByUserId: row.user_id ?? null,
      userToken: tokens.access_token as string,
      userProfile: profile,
    })
    return account
  }

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

  const useBasic = !!config.tokenAuthBasic && !!clientId && !!clientSecret
  const form: Record<string, string> = {
    grant_type: "refresh_token",
    refresh_token: creds.refreshToken,
    client_id: clientId,
  }
  if (clientSecret && !useBasic) {
    form.client_secret = clientSecret
  }

  let tokens: TokenResponse
  try {
    tokens = await exchangeToken(
      config.tokenUrl,
      form,
      useBasic ? { clientId, clientSecret } : null
    )
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
