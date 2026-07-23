import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules, ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * POST /store/carts/:id/address — set a cart's shipping/billing address + email.
 *
 * WHY THIS EXISTS (the marketplace fix):
 * Medusa's core updateCartWorkflow rejects any shipping address whose country is
 * not in the cart's REGION's countries ("Country with code X is not within
 * region Y"). That coupling assumes one merchant whose region == its market. In
 * a marketplace, a region carries only the SELLER's currency, and a country
 * belongs to exactly one region (region_country PK on iso_2) — so no two sellers
 * could ever accept the same country. That does not scale.
 *
 * This endpoint writes the address straight through the cart module, skipping ON
 * that region-country check. Whether a shopper can actually be served is decided
 * where it belongs: the seller's SHIPPING coverage (service zones) — a country
 * the seller doesn't ship to simply yields no shipping option at the delivery
 * step, and the storefront only offers shippable countries in the picker anyway.
 * Tenant isolation is unchanged (sales channel + the publishable key below).
 */

function cleanAddress(a: any): Record<string, any> | undefined {
  if (!a || typeof a !== "object") return undefined
  const s = (k: string) => {
    const v = a[k]
    return v == null || v === "" ? undefined : String(v)
  }
  return {
    first_name: s("first_name"),
    last_name: s("last_name"),
    address_1: s("address_1"),
    address_2: a.address_2 == null ? "" : String(a.address_2),
    company: s("company"),
    postal_code: s("postal_code"),
    city: s("city"),
    country_code: (s("country_code") || "").toLowerCase() || undefined,
    province: s("province"),
    phone: s("phone"),
  }
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params
  const body = (req.body ?? {}) as {
    shipping_address?: any
    billing_address?: any
    email?: string
  }

  const cartModule: any = req.scope.resolve(Modules.CART)
  const query: any = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const cart = await cartModule.retrieveCart(id).catch(() => null)
  if (!cart) return res.status(404).json({ message: "Cart not found" })

  // Isolation (defense-in-depth on top of the cart id): the cart must belong to
  // the requesting publishable key's sales channel.
  const scIds = (req as any).publishable_key_context?.sales_channel_ids as
    | string[]
    | undefined
  if (
    Array.isArray(scIds) &&
    scIds.length &&
    cart.sales_channel_id &&
    !scIds.includes(cart.sales_channel_id)
  ) {
    return res.status(404).json({ message: "Cart not found" })
  }

  const update: Record<string, any> = {}
  const sa = cleanAddress(body.shipping_address)
  const ba = cleanAddress(body.billing_address)
  if (sa) update.shipping_address = sa
  if (ba) update.billing_address = ba
  if (typeof body.email === "string" && body.email.trim()) {
    update.email = body.email.trim().toLowerCase()
  }

  try {
    if (Object.keys(update).length) {
      await cartModule.updateCarts(id, update)
    }
  } catch (err: any) {
    return res.status(400).json({ message: err?.message || "could not set address" })
  }

  const { data } = await query.graph({
    entity: "cart",
    filters: { id },
    fields: [
      "id",
      "email",
      "currency_code",
      "region_id",
      "shipping_address.*",
      "billing_address.*",
    ],
  })
  res.json({ cart: data?.[0] ?? null })
}
