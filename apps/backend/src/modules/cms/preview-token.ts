import { createHmac, timingSafeEqual } from "crypto"
import type { Locale } from "./types"

/**
 * Shared HMAC preview-token util (phase-6 preview).
 *
 * A preview token is a stateless, signed, short-lived grant that lets the
 * storefront fetch the CURRENT DRAFT of one (slug, locale) without auth. It is
 * minted by the admin `preview-token` route and validated by the token-gated
 * `/store/cms/pages/:slug/draft` route. The signature covers slug + locale +
 * exp, so a token cannot be replayed for a different page/locale or after it
 * expires.
 *
 * Token wire format:  `<payload>.<sig>`
 *   payload = base64url(JSON.stringify({ slug, locale, exp }))   // exp = unix seconds
 *   sig     = base64url(HMAC_SHA256(payload, CMS_PREVIEW_SECRET))
 *
 * Both signing and verification REQUIRE `CMS_PREVIEW_SECRET`; when it is unset
 * we deny (throw on mint, fail on verify) rather than fall back to an insecure
 * default. Comparison is constant-time.
 */

/** Default token lifetime (seconds) — overridable via CMS_PREVIEW_TTL. */
const DEFAULT_TTL_SECONDS = 600

/** Storefront base URL used to build the preview-entry URL. */
export const STOREFRONT_URL = (
  process.env.STOREFRONT_URL || "http://localhost:8000"
).replace(/\/+$/, "")

/** Resolve the preview secret, or throw if it is missing (deny-by-default). */
export function getPreviewSecret(): string {
  const secret = process.env.CMS_PREVIEW_SECRET || ""
  if (!secret) {
    throw new Error(
      "CMS_PREVIEW_SECRET is not set — refusing to mint/verify preview tokens."
    )
  }
  return secret
}

/** Configured token lifetime in seconds. */
export function getPreviewTtlSeconds(): number {
  const raw = parseInt(process.env.CMS_PREVIEW_TTL || "", 10)
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TTL_SECONDS
}

type PreviewClaims = {
  slug: string
  locale: Locale
  /** Expiry, unix seconds. */
  exp: number
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

function sign(payload: string, secret: string): string {
  return base64url(createHmac("sha256", secret).update(payload).digest())
}

/** Constant-time string compare that never throws on length mismatch. */
function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) {
    return false
  }
  return timingSafeEqual(ba, bb)
}

/**
 * Mint a signed preview token for (slug, locale) valid for `ttlSeconds`.
 * Throws if CMS_PREVIEW_SECRET is unset.
 */
export function signPreviewToken(
  slug: string,
  locale: Locale,
  ttlSeconds: number = getPreviewTtlSeconds()
): { token: string; exp: number } {
  const secret = getPreviewSecret()
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds
  const claims: PreviewClaims = { slug, locale, exp }
  const payload = base64url(JSON.stringify(claims))
  const sig = sign(payload, secret)
  return { token: `${payload}.${sig}`, exp }
}

export type VerifyResult =
  | { ok: true; exp: number }
  | { ok: false; reason: string }

/**
 * Verify a preview token AND that it was minted for exactly this (slug, locale)
 * and has not expired. Constant-time signature compare. Returns a structured
 * result (never throws on a bad token); only a missing secret throws upstream
 * via {@link getPreviewSecret}.
 */
export function verifyPreviewToken(
  token: string,
  expected: { slug: string; locale: Locale }
): VerifyResult {
  let secret: string
  try {
    secret = getPreviewSecret()
  } catch {
    return { ok: false, reason: "preview secret not configured" }
  }

  if (typeof token !== "string" || !token.includes(".")) {
    return { ok: false, reason: "malformed token" }
  }

  const dot = token.lastIndexOf(".")
  const payload = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  if (!payload || !sig) {
    return { ok: false, reason: "malformed token" }
  }

  const expectedSig = sign(payload, secret)
  if (!safeEqual(sig, expectedSig)) {
    return { ok: false, reason: "bad signature" }
  }

  let claims: PreviewClaims
  try {
    const json = Buffer.from(
      payload.replace(/-/g, "+").replace(/_/g, "/"),
      "base64"
    ).toString("utf8")
    claims = JSON.parse(json)
  } catch {
    return { ok: false, reason: "unparseable claims" }
  }

  if (claims.slug !== expected.slug) {
    return { ok: false, reason: "slug mismatch" }
  }
  if (claims.locale !== expected.locale) {
    return { ok: false, reason: "locale mismatch" }
  }
  if (
    typeof claims.exp !== "number" ||
    claims.exp <= Math.floor(Date.now() / 1000)
  ) {
    return { ok: false, reason: "token expired" }
  }

  return { ok: true, exp: claims.exp }
}

/**
 * Build the storefront preview-entry URL the admin opens. The storefront route
 * validates the token, enables Next draftMode, then redirects to the page.
 */
export function buildPreviewUrl(
  token: string,
  slug: string,
  locale: Locale,
  origin?: string
): string {
  const qs = new URLSearchParams({ token, slug, locale })
  // Prefer the caller's own origin (the store's domain) so a preview opens on
  // that store's storefront; fall back to STOREFRONT_URL (local/single-tenant).
  const base = (origin || STOREFRONT_URL).replace(/\/+$/, "")
  return `${base}/api/cms/preview?${qs.toString()}`
}
