import { NextRequest, NextResponse } from "next/server"
import { addToCart, retrieveCart } from "@lib/data/cart"

/* ------------------------------------------------------------------ */
/* POST /api/theme-cart — add a line item from an UPLOADED Liquid theme.*/
/*                                                                     */
/* Uploaded themes render their own product page (no React add-to-cart */
/* button), so this endpoint gives them the one server action they     */
/* cannot do client-side: mutate the cart. It reuses the SAME addToCart */
/* used by the React storefront, so the per-tenant publishable key,     */
/* region and cart cookie are all resolved exactly as everywhere else   */
/* (the SDK falls back to Host-based tenant resolution for /api routes).*/
/* Being under /api, middleware skips it — no country redirect eats the */
/* POST.                                                               */
/* ------------------------------------------------------------------ */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const variantId = String(body.variant_id || "")
    const quantity = Math.max(1, parseInt(String(body.quantity ?? 1), 10) || 1)
    const country = String(body.country || "us").toLowerCase()
    if (!variantId) {
      return NextResponse.json({ error: "Missing variant" }, { status: 400 })
    }
    await addToCart({ variantId, quantity, countryCode: country })
    const cart = await retrieveCart().catch(() => null)
    const itemCount = (cart?.items ?? []).reduce(
      (n: number, i: any) => n + (i.quantity ?? 0),
      0
    )
    return NextResponse.json({ ok: true, item_count: itemCount })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Could not add to cart" },
      { status: 500 }
    )
  }
}
