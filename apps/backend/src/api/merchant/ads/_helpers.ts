import { MedusaError } from "@medusajs/framework/utils"

/** Shared error → HTTP status mapping for the /merchant/ads routes. */
export const adsStatusFor = (e: any): number => {
  if (e?.type === MedusaError.Types.INVALID_DATA) return 400
  if (e?.type === MedusaError.Types.NOT_ALLOWED) return 403
  if (e?.type === MedusaError.Types.NOT_FOUND) return 404
  return 500
}

export const toConnectionDto = (row: any) => ({
  id: row.id,
  platform: row.platform,
  display_name: row.display_name ?? null,
  status: row.status,
  scopes: row.scopes ?? null,
  expires_at: row.expires_at ? new Date(row.expires_at).toISOString() : null,
  connected_at: row.created_at ? new Date(row.created_at).toISOString() : null,
})

export const toAdAccountDto = (row: any) => ({
  id: row.id,
  connection_id: row.connection_id,
  platform: row.platform,
  external_id: row.external_id,
  name: row.name ?? null,
  currency: row.currency ?? null,
  timezone: row.timezone ?? null,
  status: row.status,
  selected: Boolean(row.selected),
  last_synced_at: row.last_synced_at
    ? new Date(row.last_synced_at).toISOString()
    : null,
})
