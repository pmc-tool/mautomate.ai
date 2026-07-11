import crypto from "crypto"
import { revalidatePath, revalidateTag } from "next/cache"
import { NextRequest, NextResponse } from "next/server"

// This route mutates the cache and reads a request header — never prerender it.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Constant-time string compare. Hashes both inputs to a fixed 32-byte digest
 * first so the length of the provided value is never leaked through timing or
 * an early length-mismatch return.
 */
function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a, "utf8").digest()
  const hb = crypto.createHash("sha256").update(b, "utf8").digest()
  return crypto.timingSafeEqual(Uint8Array.from(ha), Uint8Array.from(hb))
}

/**
 * On-demand cache revalidation endpoint (Phase 6).
 *
 * The backend `cms.published` subscriber POSTs here after a publish with the
 * exact cache tags to purge. We authenticate with a shared secret and call
 * revalidateTag() for each tag so the next storefront read re-fetches.
 *
 * Contract:
 *   POST /api/cms/revalidate
 *   headers: { x-cms-secret: CMS_REVALIDATE_SECRET, content-type: application/json }
 *   body:    { tags: string[] }
 *   200:     { revalidated: true, tags }
 *   401:     secret missing/mismatch (deny-by-default)
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CMS_REVALIDATE_SECRET

  // Deny-by-default: with no configured secret we cannot authenticate callers.
  if (!secret) {
    return NextResponse.json(
      { revalidated: false, message: "Revalidation is not configured" },
      { status: 401 }
    )
  }

  const provided = req.headers.get("x-cms-secret") ?? ""
  if (!safeEqual(provided, secret)) {
    return NextResponse.json(
      { revalidated: false, message: "Unauthorized" },
      { status: 401 }
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { revalidated: false, message: "Invalid JSON body" },
      { status: 400 }
    )
  }

  const rawTags = (body as { tags?: unknown })?.tags
  const tags = Array.isArray(rawTags)
    ? rawTags.filter((t): t is string => typeof t === "string" && t.length > 0)
    : []

  // Which tenant published (pooled multi-tenant). When present, the tags above
  // are already tenant-suffixed by the backend cms.published subscriber, and we
  // must NOT do a server-wide path purge (that would hit every tenant on the
  // pooled Next server). Absent => single-tenant / legacy behavior.
  const rawTenant = (body as { tenant_id?: unknown })?.tenant_id
  const tenantId =
    typeof rawTenant === "string" && rawTenant.length > 0 ? rawTenant : ""

  for (const tag of tags) {
    revalidateTag(tag)
  }

  // Global settings / theme changes affect the chrome AND which theme renders
  // every interior page (store, product, category, cart, account). A tag purge
  // only refreshes tag-cached fetches, not the Full Route Cache of those pages.
  //
  // SINGLE-TENANT: also purge all routes under the root layout (safe — settings
  // publishes are infrequent). MULTI-TENANT (tenantId present): do NOT — a
  // revalidatePath("/","layout") is not tenant-scopable and would purge every
  // tenant on the pooled server. In MT the chrome/pages render dynamically (they
  // read x-tenant-* via headers()), so there is no per-tenant Full Route Cache
  // to purge here; the tenant-suffixed tag above is sufficient.
  const settingsChanged = tags.some(
    (t) => t === "cms-settings" || t.startsWith("cms-settings-")
  )
  let fullPurge = false
  if (settingsChanged && !tenantId) {
    revalidatePath("/", "layout")
    fullPurge = true
  }

  return NextResponse.json({
    revalidated: true,
    tags,
    tenant_id: tenantId || undefined,
    fullPurge,
  })
}
