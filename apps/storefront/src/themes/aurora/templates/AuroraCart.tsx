import ItemsTemplate from "@modules/cart/templates/items"
import Summary from "@modules/cart/templates/summary"
import EmptyCartMessage from "@modules/cart/components/empty-cart-message"
import SignInPrompt from "@modules/cart/components/sign-in-prompt"
import Divider from "@modules/common/components/divider"
import { HttpTypes } from "@medusajs/types"

/* ------------------------------------------------------------------ */
/* Aurora (modern minimalist) renderer for the cart page. Reuses the   */
/* existing stateful commerce components (ItemsTemplate, Summary,       */
/* EmptyCartMessage, SignInPrompt, Divider) verbatim and only restyles  */
/* the page FRAME: heading, two-column layout, sticky summary card and   */
/* the empty state. Props are copied exactly from the Learts source so   */
/* it is a drop-in replacement.                                          */
/* ------------------------------------------------------------------ */

const AuroraCart = ({
  cart,
  customer,
}: {
  cart: HttpTypes.StoreCart | null
  customer: HttpTypes.StoreCustomer | null
}) => {
  return (
    <div className="aurora-theme bg-white text-neutral-900">
      <div
        className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 md:py-16"
        data-testid="cart-container"
      >
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
          Shopping Cart
        </h1>

        {cart?.items?.length ? (
          <div className="mt-10 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8 lg:gap-12">
            <div className="flex flex-col gap-y-6">
              {!customer && (
                <div className="rounded-2xl border border-neutral-200 bg-white p-6">
                  <SignInPrompt />
                  <Divider className="mt-4 border-neutral-200" />
                </div>
              )}
              <div className="rounded-2xl border border-neutral-200 bg-white p-6 hover:shadow-md transition">
                <ItemsTemplate cart={cart} />
              </div>
            </div>

            <div className="relative">
              <div className="sticky top-12">
                {cart && cart.region && (
                  <div className="rounded-2xl border border-neutral-200 bg-white p-6 hover:shadow-md transition">
                    <Summary cart={cart} />
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-10 rounded-2xl border border-neutral-200 bg-white">
            <EmptyCartMessage />
          </div>
        )}
      </div>
    </div>
  )
}

export default AuroraCart
