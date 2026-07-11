import { retrieveCart } from "@lib/data/cart"
import { retrieveCustomer } from "@lib/data/customer"
import CartTemplate from "@modules/cart/templates"
import { getActiveTheme } from "@themes/registry"
import { Metadata } from "next"
import { notFound } from "next/navigation"

export const metadata: Metadata = {
  title: "Cart",
  description: "View your cart",
}

export default async function Cart() {
  const cart = await retrieveCart().catch((error) => {
    console.error(error)
    return notFound()
  })

  const customer = await retrieveCustomer()

  // The active theme MAY provide a bespoke cart template; otherwise the default.
  const activeTheme = await getActiveTheme()
  const Cart = activeTheme.templates?.cart ?? CartTemplate

  return <Cart cart={cart} customer={customer} />
}
