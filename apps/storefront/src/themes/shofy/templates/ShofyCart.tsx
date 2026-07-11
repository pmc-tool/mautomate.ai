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
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Spinner from "@modules/common/icons/spinner"
import Thumbnail from "@modules/products/components/thumbnail"

/* ------------------------------------------------------------------ */
/* Shofy (multipurpose) renderer for the CART page. Converted from the  */
/* template's cart.html: breadcrumb__area header, the tp-cart-list      */
/* table rows (image, title, price, tp-product-quantity stepper,        */
/* remove action) and the tp-cart-checkout-wrapper sidebar (totals +    */
/* checkout button) with the tp-cart-coupon promo form. Props are       */
/* copied exactly from the Learts/Cignet cart template. ALL commerce    */
/* logic is the shared one: updateLineItem / DeleteButton               */
/* (deleteLineItem) for the rows, DiscountCode (applyPromotions) for    */
/* the promo form, CartTotals for the totals, and the same checkout     */
/* step resolution as the shared Summary component. This file is a      */
/* client component because the template's quantity steppers need state */
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

type ShofyCartItemProps = {
  item: HttpTypes.StoreCartLineItem
  currencyCode: string
}

const ShofyCartItem = ({ item, currencyCode }: ShofyCartItemProps) => {
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
      {/* img */}
      <td className="tp-cart-img">
        <LocalizedClientLink href={`/products/${item.product_handle}`}>
          <Thumbnail
            thumbnail={item.thumbnail}
            images={item.variant?.product?.images}
            size="square"
          />
        </LocalizedClientLink>
      </td>
      {/* title */}
      <td className="tp-cart-title">
        <LocalizedClientLink
          href={`/products/${item.product_handle}`}
          data-testid="product-title"
        >
          {item.product_title}
        </LocalizedClientLink>
        <LineItemOptions
          variant={item.variant}
          data-testid="product-variant"
        />
        <ErrorMessage error={error} data-testid="product-error-message" />
      </td>
      {/* price */}
      <td className="tp-cart-price">
        <span>
          <LineItemPrice
            item={item}
            style="tight"
            currencyCode={currencyCode}
          />
        </span>
      </td>
      {/* quantity */}
      <td className="tp-cart-quantity">
        <div className="tp-product-quantity mt-10 mb-10">
          <button
            type="button"
            className="tp-cart-minus"
            aria-label="Decrease quantity"
            onClick={() => changeQuantity(item.quantity - 1)}
            disabled={updating || item.quantity <= 1}
          >
            <svg
              width="10"
              height="2"
              viewBox="0 0 10 2"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M1 1H9"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <input
            className="tp-cart-input"
            type="text"
            value={item.quantity}
            readOnly
            data-testid="product-quantity"
          />
          <button
            type="button"
            className="tp-cart-plus"
            aria-label="Increase quantity"
            onClick={() => changeQuantity(item.quantity + 1)}
            disabled={updating || item.quantity >= maxQuantity}
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M5 1V9"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M1 5H9"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
        {updating && <Spinner />}
      </td>
      {/* action */}
      <td className="tp-cart-action">
        <DeleteButton id={item.id} />
      </td>
    </tr>
  )
}

const ShofyCart = ({
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
    <div className="shofy-theme">
      {/* breadcrumb area start */}
      <section className="breadcrumb__area include-bg pt-95 pb-50">
        <div className="container">
          <div className="row">
            <div className="col-xxl-12">
              <div className="breadcrumb__content p-relative z-index-1">
                <h3 className="breadcrumb__title">Shopping Cart</h3>
                <div className="breadcrumb__list">
                  <span>
                    <LocalizedClientLink href="/">Home</LocalizedClientLink>
                  </span>
                  <span>Shopping Cart</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* breadcrumb area end */}

      {/* cart area start */}
      <section className="tp-cart-area pb-120" data-testid="cart-container">
        <div className="container">
          {cart && items.length > 0 ? (
            <div className="row">
              <div className="col-xl-9 col-lg-8">
                {!customer && (
                  <div className="mb-25 mr-30">
                    <SignInPrompt />
                  </div>
                )}

                <div className="tp-cart-list mb-25 mr-30">
                  <table className="table">
                    <thead>
                      <tr>
                        <th colSpan={2} className="tp-cart-header-product">
                          Product
                        </th>
                        <th className="tp-cart-header-price">Price</th>
                        <th className="tp-cart-header-quantity">Quantity</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => (
                        <ShofyCartItem
                          key={item.id}
                          item={item}
                          currencyCode={cart.currency_code}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="tp-cart-bottom">
                  <div className="row align-items-end">
                    <div className="col-xl-6 col-md-8">
                      <div className="tp-cart-coupon">
                        <DiscountCode cart={cart} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-xl-3 col-lg-4 col-md-6">
                <div className="tp-cart-checkout-wrapper">
                  <CartTotals totals={cart} />
                  <div className="tp-cart-checkout-proceed">
                    <LocalizedClientLink
                      href={"/checkout?step=" + getCheckoutStep(cart)}
                      className="tp-cart-checkout-btn w-100"
                      data-testid="checkout-button"
                    >
                      Proceed to Checkout
                    </LocalizedClientLink>
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
      </section>
      {/* cart area end */}
    </div>
  )
}

export default ShofyCart
