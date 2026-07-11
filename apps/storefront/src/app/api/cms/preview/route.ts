import crypto from "crypto"
import { cookies, draftMode } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { requestOrigin } from "@lib/util/request-origin"

// Reads request query + mutates cookies/draftMode — must run dynamically.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const CMS_LOCALES = ["en", "bn"] as const
const DEFAULT_LOCALE = "en"

/** Cookie names read back by getCmsPage when draftMode is active. */
const PREVIEW_TOKEN_COOKIE = "_cms_preview_token"
const PREVIEW_SLUG_COOKIE = "_cms_preview_slug"
const PREVIEW_LOCALE_COOKIE = "_cms_preview_locale"
const LOCALE_COOKIE = "_medusa_locale"

/**
 * Verify a preview token against CMS_PREVIEW_SECRET, mirroring the backend
 * scheme (src/modules/cms/preview-token.ts):
 *   wire format: `<payload>.<sig>`
 *   payload = base64url(JSON.stringify({ slug, locale, exp }))   exp = unix secs
 *   sig     = base64url(HMAC_SHA256(payload, CMS_PREVIEW_SECRET))
 *
 * The signature covers slug+locale+exp, so a token cannot be replayed for
 * another page/locale or after expiry. Constant-time compare; never throws.
 */
function verifyPreviewToken(
  token: string,
  expected: { slug: string; locale: string },
  secret: string
): boolean {
  if (!token || !secret) {
    return false
  }

  const dot = token.indexOf(".")
  if (dot <= 0 || dot === token.length - 1) {
    return false
  }

  const payload = token.slice(0, dot)
  const sig = token.slice(dot + 1)

  const expectedSig = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest()

  let providedSig: Buffer
  try {
    providedSig = Buffer.from(sig, "base64url")
  } catch {
    return false
  }

  if (
    providedSig.length !== expectedSig.length ||
    !crypto.timingSafeEqual(
      Uint8Array.from(providedSig),
      Uint8Array.from(expectedSig)
    )
  ) {
    return false
  }

  let claims: { slug?: unknown; locale?: unknown; exp?: unknown }
  try {
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))
  } catch {
    return false
  }

  if (claims.slug !== expected.slug || claims.locale !== expected.locale) {
    return false
  }

  const nowSec = Math.floor(Date.now() / 1000)
  if (typeof claims.exp !== "number" || claims.exp <= nowSec) {
    return false
  }

  return true
}

/** Map a CMS slug to its storefront path. Home is the country-code root ("/"). */
function pagePath(slug: string): string {
  if (!slug || slug === "home" || slug === "index") {
    return "/"
  }
  return `/${slug.replace(/^\/+/, "")}`
}

/**
 * Enter preview / draft mode (Next 15 draftMode).
 *
 * The admin Preview button opens the URL minted by the backend:
 *   GET /api/cms/preview?token=<signed>&slug=<slug>&locale=<en|bn>
 *
 * We verify the signed token, enable draftMode, stash the token + slug + locale
 * so getCmsPage can hit the token-gated backend draft endpoint, set the locale
 * cookie so the whole storefront renders the previewed locale, then redirect to
 * the page. While draftMode is on, getCmsPage serves the live-shaped DRAFT.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CMS_PREVIEW_SECRET
  const { searchParams } = req.nextUrl

  const token = searchParams.get("token") ?? ""
  const slug = searchParams.get("slug") ?? ""
  const rawLocale = searchParams.get("locale") ?? ""
  const locale = (CMS_LOCALES as readonly string[]).includes(rawLocale)
    ? rawLocale
    : DEFAULT_LOCALE

  // Deny-by-default when preview is not configured.
  if (!secret) {
    return NextResponse.json(
      { message: "Preview is not configured" },
      { status: 401 }
    )
  }

  if (!slug || !token) {
    return NextResponse.json(
      { message: "Missing token or slug" },
      { status: 400 }
    )
  }

  if (!verifyPreviewToken(token, { slug, locale }, secret)) {
    return NextResponse.json(
      { message: "Invalid or expired preview token" },
      { status: 401 }
    )
  }

  ;(await draftMode()).enable()

  const cookieStore = await cookies()
  const base = {
    sameSite: "strict" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
  }

  // Locale cookie (client-readable) so all chrome renders the previewed locale.
  cookieStore.set(LOCALE_COOKIE, locale, { ...base, httpOnly: false })
  // Preview state (server-only) for the draft fetch in getCmsPage.
  cookieStore.set(PREVIEW_TOKEN_COOKIE, token, { ...base, httpOnly: true })
  cookieStore.set(PREVIEW_SLUG_COOKIE, slug, { ...base, httpOnly: true })
  cookieStore.set(PREVIEW_LOCALE_COOKIE, locale, { ...base, httpOnly: true })

  // Redirect on the PUBLIC host (store domain), not Next's internal bind addr.
  return NextResponse.redirect(new URL(pagePath(slug), requestOrigin(req)))
}
