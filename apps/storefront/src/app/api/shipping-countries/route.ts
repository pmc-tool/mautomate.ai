import { headers } from "next/headers"
import { NextResponse } from "next/server"

/**
 * GET /api/shipping-countries
 *
 * The countries this store can actually deliver to.
 *
 * The checkout address form uses this to decide which countries it may OFFER. A
 * shopper who can select a country the merchant does not ship to reaches the
 * Delivery step, finds an empty shipping list, and can never continue to payment
 * — a dead end with no explanation. The cure is not a better error message; it is
 * not offering the country at all.
 *
 * NOTE: Next's middleware deliberately does not run on /api/*, so the
 * x-tenant-* headers it forwards are not available here. This route therefore
 * resolves the tenant the same way middleware does — by asking the backend's
 * /tenant-config with the request's own Host — which also keeps it correct on a
 * custom domain.
 *
 * Empty list => delivery is not configured anywhere; the form then falls back to
 * the full country list rather than locking the shopper out of checkout entirely.
 */
export const dynamic = "force-dynamic"

const BACKEND =
  process.env.MEDUSA_BACKEND_URL_INTERNAL ||
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ||
  "http://localhost:9000"

export async function GET() {
  const h = await headers()

  // Already forwarded (if this ever moves under the middleware matcher).
  const forwarded = h.get("x-tenant-ship-countries")
  if (forwarded !== null && forwarded !== "") {
    return NextResponse.json({
      countries: forwarded
        .split(",")
        .map((c) => c.trim().toLowerCase())
        .filter(Boolean),
    })
  }

  const host = h.get("x-forwarded-host") || h.get("host") || ""
  try {
    // The backend takes the host as a QUERY PARAM. A `Host` request header would
    // be pointless: fetch derives Host from the URL and ignores an override.
    const res = await fetch(
      `${BACKEND}/tenant-config?host=${encodeURIComponent(host)}`,
      { cache: "no-store" }
    )
    if (!res.ok) {
      return NextResponse.json({ countries: [] })
    }
    const data = (await res.json()) as { shipping_countries?: string[] }
    const countries = Array.isArray(data.shipping_countries)
      ? data.shipping_countries.map((c) => String(c).toLowerCase())
      : []
    return NextResponse.json({ countries })
  } catch {
    return NextResponse.json({ countries: [] })
  }
}
