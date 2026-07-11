import { cookies, draftMode } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const PREVIEW_TOKEN_COOKIE = "_cms_preview_token"
const PREVIEW_SLUG_COOKIE = "_cms_preview_slug"
const PREVIEW_LOCALE_COOKIE = "_cms_preview_locale"

/**
 * Exit preview / draft mode: disable Next draftMode, clear the stashed preview
 * cookies, and redirect home. The locale cookie (_medusa_locale) is left as-is
 * so the visitor keeps their chosen language.
 */
export async function GET(req: NextRequest) {
  ;(await draftMode()).disable()

  const cookieStore = await cookies()
  cookieStore.delete(PREVIEW_TOKEN_COOKIE)
  cookieStore.delete(PREVIEW_SLUG_COOKIE)
  cookieStore.delete(PREVIEW_LOCALE_COOKIE)

  return NextResponse.redirect(new URL("/", req.url))
}
