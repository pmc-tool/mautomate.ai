/**
 * Marketing API DTO serializer — the single translation layer between the
 * persistence vocabulary (models/content-service: `body`, `override_body`,
 * `link_url`, `snapshot`, `kind`, `created_by_user_id`) and the admin-UI
 * vocabulary (`content`, `link`, `hashtags` as a display string, `type`,
 * `label`, `author`). The API is the contract, so ALL post/target/revision/
 * media rows are shaped here before they leave a route, and inbound UI bodies
 * are mapped back here before they touch the service. Keeping this in one place
 * means a field-name drift can never silently cross the HTTP boundary.
 */

/** hashtags are stored as a json array but surfaced to the UI as a string. */
const hashtagsToString = (h: unknown): string | null => {
  if (Array.isArray(h)) {
    return h.length ? h.map((x) => String(x)).join(" ") : null
  }
  if (typeof h === "string") {
    return h.trim().length ? h : null
  }
  return null
}

/** Inbound: a UI hashtags string (or array) back to the stored json array. */
export const hashtagsToArray = (h: unknown): string[] | null => {
  if (Array.isArray(h)) {
    return h.length ? h.map((x) => String(x)) : null
  }
  if (typeof h === "string") {
    const parts = h.split(/\s+/).filter(Boolean)
    return parts.length ? parts : null
  }
  return null
}

const earliest = (values: (Date | string | null | undefined)[]): string | null => {
  const times = values
    .filter((v): v is Date | string => v !== null && v !== undefined)
    .map((v) => new Date(v as any).getTime())
    .filter((n) => !Number.isNaN(n))
  if (!times.length) {
    return null
  }
  return new Date(Math.min(...times)).toISOString()
}

const asIso = (v: Date | string | null | undefined): string | null =>
  v === null || v === undefined ? null : new Date(v as any).toISOString()

/** One platform target → UI PostTarget. */
export const toTargetDto = (t: any) => ({
  id: t?.id,
  post_id: t?.post_id ?? undefined,
  platform: t?.platform,
  content: t?.override_body ?? null,
  status: t?.status ?? null,
  error: t?.error ?? null,
  scheduled_at: asIso(t?.scheduled_at),
  published_at: asIso(t?.published_at),
  external_url: t?.external_url ?? null,
})

/** One media row → UI PostMedia. */
export const toMediaDto = (m: any) => ({
  id: m?.id,
  post_id: m?.post_id ?? undefined,
  url: m?.url ?? null,
  type: m?.kind ?? null,
  alt: m?.alt ?? null,
})

/** One revision row → UI PostRevision (snapshot flattened for preview). */
export const toRevisionDto = (r: any) => {
  const snap = (r?.snapshot ?? {}) as Record<string, any>
  return {
    id: r?.id,
    post_id: r?.post_id ?? undefined,
    version: r?.version ?? null,
    content: typeof snap.body === "string" ? snap.body : null,
    label: typeof snap.action === "string" ? snap.action : null,
    author: r?.created_by_user_id ?? null,
    created_at: asIso(r?.created_at),
  }
}

/**
 * One post row → UI Post. Fields the UI expects but which live only on the
 * targets (`platforms`, `scheduled_at`, `error`) are derived from the passed
 * targets when available.
 */
export const toPostDto = (p: any, targets?: any[]) => {
  const tgts = Array.isArray(targets) ? targets : undefined
  return {
    id: p?.id,
    status: p?.status ?? "draft",
    content: p?.body ?? null,
    hashtags: hashtagsToString(p?.hashtags),
    link: p?.link_url ?? null,
    product_ids: Array.isArray(p?.product_ids) ? p.product_ids : null,
    campaign_id: p?.campaign_id ?? null,
    brand_voice_id: p?.brand_voice_id ?? null,
    platforms: tgts ? tgts.map((t) => t?.platform).filter(Boolean) : null,
    scheduled_at: tgts ? earliest(tgts.map((t) => t?.scheduled_at)) : null,
    tone: null,
    length: null,
    error:
      (tgts && tgts.map((t) => t?.error).find((e) => e)) ?? p?.error ?? null,
    created_at: asIso(p?.created_at),
    updated_at: asIso(p?.updated_at),
  }
}

/** Bundle a post + its relations into the UI PostDetail response shape. */
export const toPostDetailDto = (p: any, opts?: {
  targets?: any[]
  media?: any[]
  revisions?: any[]
}) => ({
  post: toPostDto(p, opts?.targets),
  targets: (opts?.targets ?? []).map(toTargetDto),
  media: (opts?.media ?? []).map(toMediaDto),
  revisions: (opts?.revisions ?? []).map(toRevisionDto),
})

/**
 * Inbound: a UI post body (`content`/`link`/`hashtags`-string) → the columns
 * the model/service expect. Only maps keys that are present so callers can use
 * it for both create and partial update.
 */
export const fromPostDto = (b: Record<string, any>): Record<string, any> => {
  const out: Record<string, any> = {}
  if ("content" in b) out.body = b.content ?? null
  if ("body" in b) out.body = b.body ?? null
  if ("title" in b) out.title = b.title ?? null
  if ("link" in b) out.link_url = b.link ?? null
  if ("link_url" in b) out.link_url = b.link_url ?? null
  if ("hashtags" in b) out.hashtags = hashtagsToArray(b.hashtags)
  if ("product_ids" in b) {
    out.product_ids = Array.isArray(b.product_ids) ? b.product_ids : null
  }
  if ("campaign_id" in b) out.campaign_id = b.campaign_id ?? null
  if ("brand_voice_id" in b) out.brand_voice_id = b.brand_voice_id ?? null
  if ("status" in b) out.status = b.status
  return out
}
