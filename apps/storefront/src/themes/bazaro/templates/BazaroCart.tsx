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
/* Bazaro (fashion) renderer for the CART page. Converted from the      */
/* template mirror's wishlist.html which — despite the filename —       */
/* carries the CART page markup: aq-breadcrumb-area header and the      */
/* aq-cart-area table (aq-cart-img / aq-cart-title / aq-cart-price /    */
/* aq-cart-quantity / aq-cart-action columns). The static "Add To Cart" */
/* action cell becomes the aq-product-quantity stepper from             */
/* product-details-default.html plus a subtotal column. Props are       */
/* copied exactly from the Learts/Cignet cart template. ALL commerce    */
/* logic is the shared one: updateLineItem / DeleteButton               */
/* (deleteLineItem) for the rows, DiscountCode (applyPromotions) for    */
/* the promo form, CartTotals for the totals, and the same checkout     */
/* step resolution as the shared Summary component. This file is a      */
/* client component because the quantity steppers need state (the       */
/* shared Item row is equally a client component).                      */
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

type BazaroCartItemProps = {
  item: HttpTypes.StoreCartLineItem
  currencyCode: string
}

const BazaroCartItem = ({ item, currencyCode }: BazaroCartItemProps) => {
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
      <td className="aq-cart-img">
        <LocalizedClientLink href={`/products/${item.product_handle}`}>
          <Thumbnail
            thumbnail={item.thumbnail}
            images={item.variant?.product?.images}
            size="square"
          />
        </LocalizedClientLink>
      </td>
      {/* title */}
      <td className="aq-cart-title">
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
      <td className="aq-cart-price">
        <span>
          <LineItemUnitPrice
            item={item}
            style="tight"
            currencyCode={currencyCode}
          />
        </span>
      </td>
      {/* quantity */}
      <td className="aq-cart-quantity aq-product-details-quantity">
        <div className="aq-product-quantity">
          <button
            type="button"
            className="aq-cart-minus"
            aria-label="Decrease quantity"
            onClick={() => changeQuantity(item.quantity - 1)}
            disabled={updating || item.quantity <= 1}
          >
            <svg
              width="11"
              height="2"
              viewBox="0 0 11 2"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M1 1H10"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <input
            className="aq-cart-input"
            type="text"
            value={item.quantity}
            readOnly
            data-testid="product-quantity"
          />
          <button
            type="button"
            className="aq-cart-plus"
            aria-label="Increase quantity"
            onClick={() => changeQuantity(item.quantity + 1)}
            disabled={updating || item.quantity >= maxQuantity}
          >
            <svg
              width="11"
              height="12"
              viewBox="0 0 11 12"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M1 6H10"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M5.5 10.5V1.5"
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
      {/* subtotal */}
      <td className="aq-cart-price aq-cart-subtotal">
        <span>
          <LineItemPrice
            item={item}
            style="tight"
            currencyCode={currencyCode}
          />
        </span>
      </td>
      {/* action */}
      <td className="aq-cart-action text-end">
        <DeleteButton id={item.id} />
      </td>
    </tr>
  )
}

const BazaroCart = ({
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
    <div className="bazaro-theme">
      {/* aq breadcrumb area start */}
      <div
        className="aq-breadcrumb-area pt-60 pb-60"
        style={{ backgroundColor: "#F9F9F9" }}
      >
        <div className="container">
          <div className="row align-items-center">
            <div className="col-xl-12">
              <div className="aq-breadcrumb-wrap text-center">
                <div className="pd-breadcrumb-list mb-10">
                  <span>
                    <LocalizedClientLink href="/">home</LocalizedClientLink>
                  </span>
                  <span>/</span>
                  <span>cart</span>
                </div>
                <div className="aq-breadcrumb-content">
                  <h2 className="aq-breadcrumb-title fs-44">Shopping Cart</h2>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* aq breadcrumb area end */}

      {/* cart area start */}
      <div className="aq-cart-area pb-120 pt-80" data-testid="cart-container">
        <div className="container">
          {cart && items.length > 0 ? (
            <div className="row justify-content-center">
              <div className="col-xl-10">
                {!customer && (
                  <div className="mb-25">
                    <SignInPrompt />
                  </div>
                )}

                <div className="aq-cart-list mb-25">
                  <table className="table">
                    <thead>
                      <tr>
                        <th colSpan={2} className="aq-cart-header-product">
                          Product
                        </th>
                        <th className="aq-cart-header-price">Price</th>
                        <th className="aq-cart-header-quantity">Quantity</th>
                        <th className="aq-cart-header-price">Subtotal</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => (
                        <BazaroCartItem
                          key={item.id}
                          item={item}
                          currencyCode={cart.currency_code}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="aq-cart-bottom">
                  <div className="row align-items-start">
                    <div className="col-lg-6 col-md-7 mb-30">
                      <div className="aq-cart-coupon">
                        <DiscountCode cart={cart} />
                      </div>
                    </div>
                    <div className="col-lg-6 col-md-5 mb-30">
                      <div className="aq-cart-checkout-wrap">
                        <CartTotals totals={cart} />
                        <div className="aq-cart-checkout-btn-wrap mt-25">
                          <LocalizedClientLink
                            href={"/checkout?step=" + getCheckoutStep(cart)}
                            className="aq-btn-black btn-square w-100 text-center"
                            data-testid="checkout-button"
                          >
                            Proceed to Checkout
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
      {/* cart area end */}
    </div>
  )
}

export default BazaroCart
