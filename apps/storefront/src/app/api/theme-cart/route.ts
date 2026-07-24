import { NextRequest, NextResponse } from "next/server"
import {
  addToCart,
  applyPromotions,
  deleteLineItem,
  retrieveCart,
  updateLineItem,
} from "@lib/data/cart"
import { mapCart } from "@modules/theme-runtime/build-context"

/* ------------------------------------------------------------------ */
/* POST /api/theme-cart — cart mutations for UPLOADED Liquid themes.   */
/*                                                                     */
/* Uploaded themes render their own cart page (no React cart), so this */
/* endpoint gives them the server actions they cannot run client-side. */
/* It reuses the SAME lib/data/cart actions used by the React          */
/* storefront, so the per-tenant publishable key, region and cart      */
/* cookie are all resolved exactly as everywhere else (the SDK falls   */
/* back to Host-based tenant resolution for /api routes). Being under  */
/* /api, middleware skips it — no country redirect eats the POST.      */
/*                                                                     */
/* Actions (JSON body, `action` defaults to "add"):                    */
/*   add           { variant_id, quantity?, country? }                 */
/*   update        { line_id, quantity }   quantity <= 0 removes       */
/*   remove        { line_id }                                         */
/*   promo_add     { code }                                            */
/*   promo_remove  { code }                                            */
/* Every success responds { ok, item_count, cart } where `cart` is the */
/* SAME mapped shape the Liquid context exposes — theme JS and theme   */
/* templates can never disagree about the cart.                        */
/* ------------------------------------------------------------------ */

async function cartPayload() {
  const cart = await retrieveCart().catch(() => null)
  const mapped = mapCart(cart)
  return { ok: true as const, item_count: mapped.item_count, cart: mapped }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const action = String(body.action || "add")

    if (action === "add") {
      const variantId = String(body.variant_id || "")
      const quantity = Math.max(1, parseInt(String(body.quantity ?? 1), 10) || 1)
      const country = String(body.country || "us").toLowerCase()
      if (!variantId) {
        return NextResponse.json({ error: "Missing variant" }, { status: 400 })
      }
      await addToCart({ variantId, quantity, countryCode: country })
      return NextResponse.json(await cartPayload())
    }

    if (action === "update" || action === "remove") {
      const lineId = String(body.line_id || "")
      if (!lineId) {
        return NextResponse.json({ error: "Missing line item" }, { status: 400 })
      }
      const quantity =
        action === "remove"
          ? 0
          : Math.max(0, parseInt(String(body.quantity ?? 0), 10) || 0)
      if (quantity <= 0) {
        await deleteLineItem(lineId)
      } else {
        await updateLineItem({ lineId, quantity })
      }
      return NextResponse.json(await cartPayload())
    }

    if (action === "promo_add" || action === "promo_remove") {
      const code = String(body.code || "").trim()
      if (!code) {
        return NextResponse.json({ error: "Missing code" }, { status: 400 })
      }
      // applyPromotions REPLACES the cart's promo set, so build the full
      // desired set from what is currently attached (display codes — the
      // action re-namespaces internally).
      const current = await retrieveCart().catch(() => null)
      const attached = (current?.promotions ?? [])
        .filter((p: any) => p?.code && !p?.is_automatic)
        .map((p: any) => String(p.code))
      const lower = code.toLowerCase()
      const codes =
        action === "promo_add"
          ? attached.some((c) => c.toLowerCase() === lower)
            ? attached
            : [...attached, code]
          : attached.filter((c) => c.toLowerCase() !== lower)
      const result = await applyPromotions(codes)
      if (result && result.success === false) {
        return NextResponse.json(
          { error: result.error || "That code could not be applied." },
          { status: 400 }
        )
      }
      return NextResponse.json(await cartPayload())
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Could not update cart" },
      { status: 500 }
    )
  }
}
