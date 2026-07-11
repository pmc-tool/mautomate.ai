/**
 * The single source of truth for the connected-account shape returned by the
 * marketing accounts API. The Connect UI consumes `AccountDto` exactly, so keep
 * this serializer here and reuse it from every accounts route — never re-shape
 * an account row inline.
 */

export type AccountDto = {
  id: string
  platform: string
  handle: string | null
  display_name: string | null
  avatar_url: string | null
  status: string
  external_id: string | null
  connected_at: string | null
}

/** Serialize a marketing_social_account row into the public AccountDto. */
export const toAccountDto = (row: any): AccountDto => ({
  id: row.id,
  platform: row.platform,
  handle: row.handle ?? null,
  display_name: row.display_name ?? null,
  avatar_url: row.avatar_url ?? null,
  status: row.status,
  external_id: row.external_id ?? null,
  connected_at: row.created_at
    ? new Date(row.created_at).toISOString()
    : null,
})
