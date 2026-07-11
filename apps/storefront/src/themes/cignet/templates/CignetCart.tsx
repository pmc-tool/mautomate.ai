"use client"

import { useState } from "react"
import { HttpTypes } from "@medusajs/types"

import { updateLineItem } from "@lib/data/cart"
import EmptyCartMessage from "@modules/cart/components/empty-cart-message"
import SignInPrompt from "@modules/cart/components/sign-in-prompt"
import DiscountCode from "@modules/checkout/components/discount-code"
import ErrorMessage from "@modules/checkout/components/error-message"
import CartTotals from "@modules/common/components/cart-totals"
import DeleteButton from "@modules/common/components/delete-button"
import LineItemOptions from "@modules/common/components/line-item-options"
import LineItemPrice from "@modules/common/components/line-item-price"
import LineItemUnitPrice from "@modules/common/components/line-item-unit-price"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Spinner from "@modules/common/icons/spinner"
import Thumbnail from "@modules/products/components/thumbnail"

/* ------------------------------------------------------------------ */
/* Cignet (jewellery) renderer for the CART page. Converted from the    */
/* template's cart.html: page header + breadcrumb, the cart-item-table  */
/* rows (image, title, unit price, qty-box stepper, subtotal) and the   */
/* order-summary-box sidebar (promo code + totals + checkout button).   */
/* Props are copied exactly from the Learts/Aurora cart template. ALL   */
/* commerce logic is the shared one: updateLineItem / DeleteButton      */
/* (deleteLineItem) for the rows, DiscountCode (applyPromotions) for    */
/* the promo form, CartTotals for the totals, and the same checkout     */
/* step resolution as the shared Summary component. This file is a      */
/* client component because the template's qty-box steppers need state  */
/* (the shared Item row is equally a client component).                 */
/* ------------------------------------------------------------------ */

/* Same step resolution as @modules/cart/templates/summary.tsx. */
function getCheckoutStep(cart: HttpTypes.StoreCart) {
  if (!cart?.shipping_address?.address_1 || !cart.email) {
    return "address"
  } else if (cart?.shipping_methods?.length === 0) {
    return "delivery"
  } else {
    return "payment"
  }
}

type CignetCartItemProps = {
  item: HttpTypes.StoreCartLineItem
  currencyCode: string
}

const CignetCartItem = ({ item, currencyCode }: CignetCartItemProps) => {
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /* Same quantity handling as the shared cart Item component. */
  const changeQuantity = async (quantity: number) => {
    if (quantity < 1) {
      return
    }

    setError(null)
    setUpdating(true)

    await updateLineItem({
      lineId: item.id,
      quantity,
    })
      .catch((err) => {
        setError(err.message)
      })
      .finally(() => {
        setUpdating(false)
      })
  }

  const maxQuantity = 10

  return (
    <div className="cart-item" data-testid="product-row">
      <div className="cart-item-image-content">
        <div className="cart-item-image">
          <figure>
            <LocalizedClientLink href={`/products/${item.product_handle}`}>
              <Thumbnail
                thumbnail={item.thumbnail}
                images={item.variant?.product?.images}
                size="square"
              />
            </LocalizedClientLink>
          </figure>
        </div>
        <div className="cart-item-info-content">
          <div className="cart-item-title">
            <p>
              <LocalizedClientLink
                href={`/products/${item.product_handle}`}
                data-testid="product-title"
              >
                {item.product_title}
              </LocalizedClientLink>
            </p>
            <LineItemOptions
              variant={item.variant}
              data-testid="product-variant"
            />
          </div>
          <div className="cart-item-price">
            <LineItemUnitPrice
              item={item}
              style="tight"
              currencyCode={currencyCode}
            />
          </div>
        </div>
      </div>
      <div className="cart-item-quantity-total">
        <div className="cart-item-quantity">
          <div className="qty-box">
            <button
              type="button"
              className="qty-btn minus"
              aria-label="Decrease quantity"
              onClick={() => changeQuantity(item.quantity - 1)}
              disabled={updating || item.quantity <= 1}
            >
              <span>-</span>
            </button>
            <input
              type="text"
              className="qty-input"
              value={String(item.quantity).padStart(2, "0")}
              readOnly
              data-testid="product-quantity"
            />
            <button
              type="button"
              className="qty-btn plus"
              aria-label="Increase quantity"
              onClick={() => changeQuantity(item.quantity + 1)}
              disabled={updating || item.quantity >= maxQuantity}
            >
              <span>+</span>
            </button>
          </div>
          {updating && <Spinner />}
        </div>
        <div className="cart-item-subtotal">
          <LineItemPrice
            item={item}
            style="tight"
            currencyCode={currencyCode}
          />
        </div>
        <DeleteButton id={item.id} />
      </div>
      <ErrorMessage error={error} data-testid="product-error-message" />
    </div>
  )
}

const CignetCart = ({
  cart,
  customer,
}: {
  cart: HttpTypes.StoreCart | null
  customer: HttpTypes.StoreCustomer | null
}) => {
  /* Same ordering as the shared ItemsTemplate (newest first). */
  const items = (cart?.items ?? [])
    .slice()
    .sort((a, b) => ((a.created_at ?? "") > (b.created_at ?? "") ? -1 : 1))

  return (
    <div className="cignet-theme">
      {/* Page Header Start */}
      <div className="page-header dark-section parallaxie">
        <div className="container">
          <div className="row">
            <div className="col-lg-12">
              <div className="page-header-box">
                <h1 className="text-anime-style-3">Cart</h1>
                <nav className="wow fadeInUp">
                  <ol className="breadcrumb">
                    <li className="breadcrumb-item">
                      <LocalizedClientLink href="/">home</LocalizedClientLink>
                    </li>
                    <li className="breadcrumb-item active" aria-current="page">
                      Cart
                    </li>
                  </ol>
                </nav>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Page Header End */}

      {/* Page Cart Section Start */}
      <div className="page-cart" data-testid="cart-container">
        <div className="container">
          {cart && items.length > 0 ? (
            <div className="row">
              <div className="col-xl-8">
                {/* Cart Content Box Start */}
                <div className="cart-content-box">
                  {!customer && (
                    <div className="cart-item-table-box">
                      <SignInPrompt />
                    </div>
                  )}

                  {/* Cart Item Table Box Start */}
                  <div className="cart-item-table-box">
                    <div className="cart-item-table wow fadeInUp">
                      {/* Cart Item Header Start */}
                      <div className="cart-item-header">
                        <span className="product-header-tag">Product</span>
                        <span className="price-header-tag">Price</span>
                        <span className="quantity-header-tag">Quantity</span>
                        <span className="subtotal-header-tag">Subtotal</span>
                      </div>
                      {/* Cart Item Header End */}

                      {items.map((item) => (
                        <CignetCartItem
                          key={item.id}
                          item={item}
                          currencyCode={cart.currency_code}
                        />
                      ))}
                    </div>
                  </div>
                  {/* Cart Item Table Box End */}
                </div>
                {/* Cart Content Box End */}
              </div>

              <div className="col-xl-4">
                {/* Page Single Sidebar Start */}
                <div className="page-single-sidebar right-side-sidebar">
                  {/* Order Summary Box Start */}
                  <div className="order-summary-box wow fadeInUp">
                    <div className="order-summary-content-box">
                      <div className="order-summary-box-title">
                        <h2>Order Summary</h2>
                      </div>
                      <div className="order-summary-promocode-box">
                        <DiscountCode cart={cart} />
                      </div>
                      <CartTotals totals={cart} />
                    </div>

                    {/* Order Checkout Button Start */}
                    <div className="order-checkout-button">
                      <LocalizedClientLink
                        href={"/checkout?step=" + getCheckoutStep(cart)}
                        className="btn-default"
                        data-testid="checkout-button"
                      >
                        Proceed to Checkout
                      </LocalizedClientLink>
                    </div>
                    {/* Order Checkout Button End */}
                  </div>
                  {/* Order Summary Box End */}
                </div>
                {/* Page Single Sidebar End */}
              </div>
            </div>
          ) : (
            <div className="row">
              <div className="col-lg-12">
                <div className="cart-content-box">
                  <EmptyCartMessage />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Page Cart Section End */}
    </div>
  )
}

export default CignetCart
