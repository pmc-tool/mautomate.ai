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
/* Helendo (furniture) renderer for the CART page. Converted from the   */
/* template's cart.html: breadcrumb-area strip, the cart-table-content  */
/* table (image, title, unit price, cart-plus-minus stepper, subtotal,  */
/* remove), the shoping-update-area row and the discount-code +         */
/* cart_totals bottom area. Props are copied exactly from the           */
/* Cignet/Learts cart template. ALL commerce logic is the shared one:   */
/* updateLineItem / DeleteButton (deleteLineItem) for the rows,         */
/* DiscountCode (applyPromotions) for the coupon form, CartTotals for   */
/* the totals, and the same checkout step resolution as the shared      */
/* Summary component. This file is a client component because the       */
/* template's cart-plus-minus steppers need state.                      */
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

type HelendoCartItemProps = {
  item: HttpTypes.StoreCartLineItem
  currencyCode: string
}

const HelendoCartItem = ({ item, currencyCode }: HelendoCartItemProps) => {
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
    <tr data-testid="product-row">
      <td></td>
      <td className="product-img">
        <LocalizedClientLink href={`/products/${item.product_handle}`}>
          <Thumbnail
            thumbnail={item.thumbnail}
            images={item.variant?.product?.images}
            size="square"
          />
        </LocalizedClientLink>
      </td>
      <td className="product-name">
        <LocalizedClientLink
          href={`/products/${item.product_handle}`}
          data-testid="product-title"
        >
          {item.product_title}
        </LocalizedClientLink>
        <LineItemOptions variant={item.variant} data-testid="product-variant" />
        <ErrorMessage error={error} data-testid="product-error-message" />
      </td>
      <td className="product-price">
        <span className="amount">
          <LineItemUnitPrice
            item={item}
            style="tight"
            currencyCode={currencyCode}
          />
        </span>
      </td>
      <td className="cart-quality">
        <div className="quickview-quality quality-height-dec2">
          <div className="cart-plus-minus">
            <button
              type="button"
              className="dec qtybutton"
              aria-label="Decrease quantity"
              onClick={() => changeQuantity(item.quantity - 1)}
              disabled={updating || item.quantity <= 1}
            >
              -
            </button>
            <input
              className="cart-plus-minus-box"
              type="text"
              name="qtybutton"
              value={item.quantity}
              readOnly
              data-testid="product-quantity"
            />
            <button
              type="button"
              className="inc qtybutton"
              aria-label="Increase quantity"
              onClick={() => changeQuantity(item.quantity + 1)}
              disabled={updating || item.quantity >= maxQuantity}
            >
              +
            </button>
          </div>
          {updating && <Spinner />}
        </div>
      </td>
      <td className="price-total">
        <span className="amount">
          <LineItemPrice
            item={item}
            style="tight"
            currencyCode={currencyCode}
          />
        </span>
      </td>
      <td className="product-remove">
        <DeleteButton id={item.id} />
      </td>
    </tr>
  )
}

const HelendoCart = ({
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
    <div className="helendo-theme">
      {/* breadcrumb-area start (cart.html) */}
      <div className="breadcrumb-area">
        <div className="container">
          <div className="row">
            <div className="col-12">
              <div className="row breadcrumb_box align-items-center">
                <div className="col-lg-6 col-md-6 col-sm-6 text-center text-sm-left">
                  <h2 className="breadcrumb-title">Cart</h2>
                </div>
                <div className="col-lg-6 col-md-6 col-sm-6">
                  {/* breadcrumb-list start */}
                  <ul className="breadcrumb-list text-center text-sm-right">
                    <li className="breadcrumb-item">
                      <LocalizedClientLink href="/">Home</LocalizedClientLink>
                    </li>
                    <li className="breadcrumb-item active">Cart</li>
                  </ul>
                  {/* breadcrumb-list end */}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* breadcrumb-area end */}

      <div id="main-wrapper">
        <div className="site-wrapper-reveal border-bottom">
          {/* cart start */}
          <div
            className="cart-main-area section-space--ptb_90"
            data-testid="cart-container"
          >
            <div className="container">
              {cart && items.length > 0 ? (
                <div className="row">
                  <div className="col-lg-12">
                    {!customer && (
                      <div className="mb-30">
                        <SignInPrompt />
                      </div>
                    )}

                    <div className="table-content table-responsive cart-table-content header-color-gray">
                      <table>
                        <thead>
                          <tr className="bg-gray">
                            <th></th>
                            <th></th>
                            <th className="product-name">Product</th>
                            <th className="product-price">Price</th>
                            <th>Quantity</th>
                            <th>Total</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((item) => (
                            <HelendoCartItem
                              key={item.id}
                              item={item}
                              currencyCode={cart.currency_code}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Quantities save instantly, so the template's "Update
                        cart" button has no job here — only the continue-
                        shopping link remains. */}
                    <div className="shoping-update-area row">
                      <div className="continue-shopping-butotn col-6 mt-30">
                        <LocalizedClientLink
                          href="/store"
                          className="btn btn--lg btn--black"
                        >
                          <i className="icon-arrow-left"></i> Continue Shopping
                        </LocalizedClientLink>
                      </div>
                    </div>

                    <div className="cart-buttom-area">
                      <div className="row">
                        <div className="col-lg-6">
                          <div className="discount-code section-space--mt_60">
                            <h6 className="mb-30">Coupon Discount</h6>
                            <p>Enter your coupon code if you have one.</p>
                            <DiscountCode cart={cart} />
                          </div>
                        </div>
                        <div className="col-lg-6">
                          <div className="cart_totals section-space--mt_60 ml-md-auto">
                            <div className="grand-total-wrap">
                              <div className="grand-total-content">
                                <CartTotals totals={cart} />
                              </div>
                            </div>
                            <div className="grand-btn mt-30">
                              <LocalizedClientLink
                                href={"/checkout?step=" + getCheckoutStep(cart)}
                                className="btn btn--md btn--black btn--full text-center"
                                data-testid="checkout-button"
                              >
                                Proceed to checkout
                              </LocalizedClientLink>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="row">
                  <div className="col-lg-12">
                    <EmptyCartMessage />
                  </div>
                </div>
              )}
            </div>
          </div>
          {/* cart end */}
        </div>
      </div>
    </div>
  )
}

export default HelendoCart
