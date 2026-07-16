import { MedusaError } from "@medusajs/framework/utils"
import { openAdsConnectionCredentials } from "./credentials"
import type { AdsCredentials } from "./types"

/**
 * Meta Pixel setup for a tenant — discover the pixels on the selected ad
 * account (or create one) and record the active pixel row that drives both
 * the storefront base-pixel injection (via /tenant-config) and the
 * server-side Conversions API sender (capi.ts).
 */

const GRAPH = "https://graph.facebook.com/v25.0"

const first = <T>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null)

const graphJson = async (res: Response): Promise<any> => {
  let data: any = null
  try {
    data = await res.json()
  } catch {
    data = null
  }
  if (!res.ok) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      data?.error?.message ?? `Meta request failed (${res.status})`
    )
  }
  return data
}

/** The pixels that exist on an ad account. */
export const listAccountPixels = async (
  creds: AdsCredentials,
  externalAccountId: string
): Promise<{ id: string; name: string | null }[]> => {
  const res = await fetch(
    `${GRAPH}/${externalAccountId}/adspixels?fields=id,name&limit=50&access_token=${encodeURIComponent(
      creds.accessToken
    )}`
  )
  const data = await graphJson(res)
  return (data?.data ?? []).map((r: any) => ({
    id: String(r.id),
    name: r.name ?? null,
  }))
}

/** Create a pixel on an ad account. */
export const createAccountPixel = async (
  creds: AdsCredentials,
  externalAccountId: string,
  name: string
): Promise<{ id: string; name: string }> => {
  const res = await fetch(`${GRAPH}/${externalAccountId}/adspixels`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      name,
      access_token: creds.accessToken,
    }).toString(),
  })
  const data = await graphJson(res)
  return { id: String(data.id), name }
}

/** The tenant's connected meta connection + a selected active account, or a
 *  clear MedusaError explaining exactly what is missing. */
export const requireMetaAccountContext = async (
  mk: any,
  tenantId: string
): Promise<{ connection: any; account: any; creds: AdsCredentials }> => {
  const connection = first(
    await mk.listAdsConnections({
      tenant_id: tenantId,
      platform: "meta",
      status: "connected",
    })
  )
  if (!connection) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Connect Meta advertising first — the pixel and catalog live on your Meta ad account."
    )
  }
  const account = first(
    await mk.listAdsAccounts({
      tenant_id: tenantId,
      platform: "meta",
      selected: true,
      status: "active",
    })
  )
  if (!account) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      'Choose an ad account first ("Use this account" on the Ad accounts page).'
    )
  }
  const creds = openAdsConnectionCredentials(connection)
  if (!creds) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Your Meta connection has expired — please reconnect."
    )
  }
  return { connection, account, creds }
}

/**
 * Set up the tenant's Meta pixel: use `pixelId` when given (validated against
 * the account), else the account's first existing pixel, else create one named
 * after the store. Upserts the ads_pixel row and returns it.
 */
export const setupTenantPixel = async (
  mk: any,
  tenantId: string,
  opts: { pixelId?: string | null; storeName?: string | null } = {}
): Promise<any> => {
  const { connection, account, creds } = await requireMetaAccountContext(
    mk,
    tenantId
  )

  const existing = await listAccountPixels(creds, account.external_id)

  let chosen: { id: string; name: string | null } | null = null
  if (opts.pixelId) {
    chosen = existing.find((p) => p.id === String(opts.pixelId)) ?? null
    if (!chosen) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "That pixel does not exist on the selected ad account."
      )
    }
  } else if (existing.length > 0) {
    chosen = existing[0]
  } else {
    chosen = await createAccountPixel(
      creds,
      account.external_id,
      `${opts.storeName ?? "Store"} pixel`
    )
  }

  const row = first(
    await mk.listAdsPixels({
      tenant_id: tenantId,
      platform: "meta",
      external_id: chosen.id,
    })
  )
  const payload = {
    tenant_id: tenantId,
    connection_id: connection.id,
    account_id: account.id,
    platform: "meta",
    external_id: chosen.id,
    name: chosen.name,
    status: "active",
  }
  const pixel = row?.id
    ? first(await mk.updateAdsPixels({ id: row.id, ...payload } as any))
    : first(await mk.createAdsPixels(payload as any))

  // One active pixel per tenant/platform: disable any other rows.
  const others = await mk.listAdsPixels(
    { tenant_id: tenantId, platform: "meta", status: "active" },
    { take: 20 }
  )
  for (const other of others ?? []) {
    if (other.id !== pixel.id) {
      await mk.updateAdsPixels({ id: other.id, status: "disabled" } as any)
    }
  }

  await mk.createAdsActionLogs({
    tenant_id: tenantId,
    actor: "merchant",
    action: "pixel.configured",
    level: "pixel",
    object_id: pixel.id,
    external_id: pixel.external_id,
    reason: `Meta pixel ${pixel.external_id} is now installed on the storefront`,
  } as any)

  return pixel
}
