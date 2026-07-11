/**
 * Signup / provisioning abuse controls (Phase 6).
 *
 * Instant no-card provisioning of a full DB + container per signup is a
 * resource-exhaustion + phishing-subdomain vector (review). These PURE checks
 * cap provisioning per-IP and globally within a rolling window, and validate a
 * requested slug, so the API layer can reject before spending infra.
 */
export type SignupRecord = { ip: string; at_ms: number }

export const PER_IP_LIMIT = 3
export const GLOBAL_LIMIT = 50
export const WINDOW_MS = 60 * 60 * 1000 // 1 hour

export type QuotaVerdict =
  | { allowed: true }
  | { allowed: false; reason: "per_ip_limit" | "global_limit" }

/** Decide whether a new signup from `ip` is within quota given recent signups. */
export const checkSignupQuota = (
  recent: SignupRecord[],
  ip: string,
  nowMs: number,
  limits: { perIp?: number; global?: number; windowMs?: number } = {}
): QuotaVerdict => {
  const perIp = limits.perIp ?? PER_IP_LIMIT
  const global = limits.global ?? GLOBAL_LIMIT
  const windowMs = limits.windowMs ?? WINDOW_MS
  const inWindow = recent.filter((r) => nowMs - r.at_ms < windowMs)
  if (inWindow.length >= global) return { allowed: false, reason: "global_limit" }
  const fromIp = inWindow.filter((r) => r.ip === ip).length
  if (fromIp >= perIp) return { allowed: false, reason: "per_ip_limit" }
  return { allowed: true }
}

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/
const RESERVED = new Set([
  "www",
  "api",
  "admin",
  "app",
  "mail",
  "smtp",
  "ftp",
  "root",
  "brandtodoor",
  "support",
  "billing",
  "status",
  "assets",
  "cdn",
])

export type SlugVerdict =
  | { ok: true; slug: string }
  | { ok: false; reason: "invalid_format" | "reserved" }

/** Validate + normalize a requested free-subdomain slug. */
export const validateSlug = (raw: string): SlugVerdict => {
  const slug = raw.trim().toLowerCase()
  if (!SLUG_RE.test(slug)) return { ok: false, reason: "invalid_format" }
  if (RESERVED.has(slug)) return { ok: false, reason: "reserved" }
  return { ok: true, slug }
}
