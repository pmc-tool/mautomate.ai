import { NextRequest } from "next/server"
import { redirect } from "next/navigation"

import { setCartId } from "@lib/data/cookies"
import { applyPromotions } from "@lib/data/cart"

/* ------------------------------------------------------------------ */
/* Abandoned-cart recovery deep link                                    */
/*                                                                     */
/* GET /<countryCode>/recover?cart_id=<id>&code=<promo>                 */
/* Reopens the customer's exact abandoned cart on-site by making it the */
/* active cart (via the _medusa_cart_id cookie) and, best-effort,       */
/* auto-applying a discount code. Always lands the customer somewhere   */
/* sensible on-domain — a bad/expired code never breaks the flow.       */
/* ------------------------------------------------------------------ */

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ countryCode: string }> }
) {
  const { countryCode } = await props.params
  const cartId = req.nextUrl.searchParams.get("cart_id")
  const code = req.nextUrl.searchParams.get("code")

  // No cart to recover — send the customer to the storefront home.
  if (!cartId) {
    redirect(`/${countryCode}`)
  }

  try {
    // Make the recovered cart the active one before applying anything,
    // since applyPromotions operates on the current cart.
    await setCartId(cartId)

    if (code) {
      // Best effort — swallow an invalid/expired code and continue.
      try {
        await applyPromotions([code])
      } catch {
        // Ignore: recovering the cart matters more than the discount.
      }
    }
  } catch {
    // Any unexpected failure still lands the customer on their cart.
  }

  redirect(`/${countryCode}/cart`)
}
