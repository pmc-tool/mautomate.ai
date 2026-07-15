/* ------------------------------------------------------------------ */
/* Visual editor — session cookie gate                                  */
/*                                                                     */
/* GET /api/editor-auth?key=<token>&to=/editor/<slug>?locale=..         */
/* Validates the admin-minted expiring token, stores it in an httpOnly  */
/* ff_editor_key cookie and redirects to the editor WITHOUT the key in  */
/* the URL. All /api/puck/* routes then authenticate via the cookie     */
/* (an explicit ?key= still wins for dev / backward compat).            */
/* ------------------------------------------------------------------ */

import { NextRequest, NextResponse } from "next/server"
import { EDITOR_KEY_COOKIE, isValidEditorKeyForRequest } from "@lib/util/secret"
import { requestOrigin } from "@lib/util/request-origin"

/** Cookie lifetime — matches the 8h TTL of the admin-minted token. */
const COOKIE_MAX_AGE_S = 8 * 60 * 60

function isHttpsRequest(req: NextRequest): boolean {
  const proto = req.headers.get("x-forwarded-proto")
  if (proto) {
    return proto.split(",")[0].trim() === "https"
  }
  return req.nextUrl.protocol === "https:"
}

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key")
  if (!key || !(await isValidEditorKeyForRequest(key, req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  // Only ever bounce inside the editor — anything else falls back to /editor.
  const to = req.nextUrl.searchParams.get("to") || ""
  const safeTo = to.startsWith("/editor") ? to : "/editor/home"
  // Build the redirect on the PUBLIC host (the store's domain), not Next's
  // internal bind address — otherwise the editor lands on localhost:8601.
  const origin = requestOrigin(req)
  const target = new URL(safeTo, origin)
  if (target.origin !== origin) {
    return NextResponse.json({ error: "invalid redirect" }, { status: 400 })
  }

  const res = NextResponse.redirect(target)
  res.cookies.set(EDITOR_KEY_COOKIE, key, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE_S,
    // Match the cookie's Secure flag to the actual request scheme so the cookie
    // is sent after the redirect. In production the edge/proxy must forward
    // x-forwarded-proto; without it we fall back to Next's req.nextUrl.protocol.
    secure: isHttpsRequest(req),
  })
  return res
}
