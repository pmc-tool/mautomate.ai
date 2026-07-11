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
/* Rokon renderer for the CART page. Converted from the template's      */
/* cart.html: breadcrumb__section page title, the cart__table rows      */
/* (image, title, unit price, quantity__box stepper, total) and the     */
/* cart__summary sidebar (coupon code + totals + checkout button).      */
/* Props are copied exactly from the Learts/Cignet cart template. ALL   */
/* commerce logic is the shared one: updateLineItem / DeleteButton      */
/* (deleteLineItem) for the rows, DiscountCode (applyPromotions) for    */
/* the coupon form, CartTotals for the totals, and the same checkout    */
/* step resolution as the shared Summary component. This file is a      */
/* client component because the template's quantity__box steppers need  */
/* state (the shared Item row is equally a client component).           */
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

type RokonCartItemProps = {
  item: HttpTypes.StoreCartLineItem
  currencyCode: string
}

const RokonCartItem = ({ item, currencyCode }: RokonCartItemProps) => {
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
    <tr className="cart__table--body__items" data-testid="product-row">
      <td className="cart__table--body__list">
        <div className="cart__product d-flex align-items-center">
          <DeleteButton id={item.id} />
          <div className="cart__thumbnail">
            <LocalizedClientLink href={`/products/${item.product_handle}`}>
              <Thumbnail
                thumbnail={item.thumbnail}
                images={item.variant?.product?.images}
                size="square"
              />
            </LocalizedClientLink>
          </div>
          <div className="cart__content">
            <h3 className="cart__content--title h4">
              <LocalizedClientLink
                href={`/products/${item.product_handle}`}
                data-testid="product-title"
              >
                {item.product_title}
              </LocalizedClientLink>
            </h3>
            <span className="cart__content--variant">
              <LineItemOptions
                variant={item.variant}
                data-testid="product-variant"
              />
            </span>
            <ErrorMessage error={error} data-testid="product-error-message" />
          </div>
        </div>
      </td>
      <td className="cart__table--body__list">
        <span className="cart__price">
          <LineItemUnitPrice
            item={item}
            style="tight"
            currencyCode={currencyCode}
          />
        </span>
      </td>
      <td className="cart__table--body__list">
        <div className="quantity__box">
          <button
            type="button"
            className="quantity__value quickview__value--quantity decrease"
            aria-label="Decrease quantity"
            onClick={() => changeQuantity(item.quantity - 1)}
            disabled={updating || item.quantity <= 1}
          >
            -
          </button>
          <label>
            <input
              type="number"
              className="quantity__number quickview__value--number"
              value={item.quantity}
              readOnly
              data-testid="product-quantity"
            />
          </label>
          <button
            type="button"
            className="quantity__value quickview__value--quantity increase"
            aria-label="Increase quantity"
            onClick={() => changeQuantity(item.quantity + 1)}
            disabled={updating || item.quantity >= maxQuantity}
          >
            +
          </button>
        </div>
        {updating && <Spinner />}
      </td>
      <td className="cart__table--body__list">
        <span className="cart__price end">
          <LineItemPrice
            item={item}
            style="tight"
            currencyCode={currencyCode}
          />
        </span>
      </td>
    </tr>
  )
}

const RokonCart = ({
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
    <div className="rokon-theme">
      {/* Start breadcrumb section */}
      <section className="breadcrumb__section breadcrumb__bg">
        <div className="container">
          <div className="row row-cols-1">
            <div className="col">
              <div className="breadcrumb__content">
                <h1 className="breadcrumb__content--title mb-10">
                  Shopping Cart
                </h1>
                <ul className="breadcrumb__content--menu d-flex">
                  <li className="breadcrumb__content--menu__items">
                    <LocalizedClientLink href="/">Home</LocalizedClientLink>
                  </li>
                  <li className="breadcrumb__content--menu__items">
                    <span className="text__secondary">Shopping Cart</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* End breadcrumb section */}

      {/* Cart section start */}
      <section
        className="cart__section section--padding"
        data-testid="cart-container"
      >
        <div className="container-fluid">
          <div className="cart__section--inner">
            <h2 className="cart__title mb-40">Shopping Cart</h2>
            {cart && items.length > 0 ? (
              <div className="row">
                <div className="col-lg-8">
                  {!customer && (
                    <div className="mb-30">
                      <SignInPrompt />
                    </div>
                  )}

                  <div className="cart__table">
                    <table className="cart__table--inner">
                      <thead className="cart__table--header">
                        <tr className="cart__table--header__items">
                          <th className="cart__table--header__list">
                            Product
                          </th>
                          <th className="cart__table--header__list">Price</th>
                          <th className="cart__table--header__list">
                            Quantity
                          </th>
                          <th className="cart__table--header__list">Total</th>
                        </tr>
                      </thead>
                      <tbody className="cart__table--body">
                        {items.map((item) => (
                          <RokonCartItem
                            key={item.id}
                            item={item}
                            currencyCode={cart.currency_code}
                          />
                        ))}
                      </tbody>
                    </table>
                    <div className="continue__shopping d-flex justify-content-between">
                      <LocalizedClientLink
                        className="continue__shopping--link"
                        href="/store"
                      >
                        Continue shopping
                      </LocalizedClientLink>
                    </div>
                  </div>
                </div>

                <div className="col-lg-4">
                  <div className="cart__summary border-radius-10">
                    <div className="coupon__code mb-30">
                      <h3 className="coupon__code--title">Coupon</h3>
                      <p className="coupon__code--desc">
                        Enter your coupon code if you have one.
                      </p>
                      <DiscountCode cart={cart} />
                    </div>
                    <div className="cart__summary--total mb-20">
                      <CartTotals totals={cart} />
                    </div>
                    <div className="cart__summary--footer">
                      <p className="cart__summary--footer__desc">
                        Shipping &amp; taxes calculated at checkout
                      </p>
                      <ul className="d-flex justify-content-between">
                        <li>
                          <LocalizedClientLink
                            className="cart__summary--footer__btn primary__btn checkout"
                            href={"/checkout?step=" + getCheckoutStep(cart)}
                            data-testid="checkout-button"
                          >
                            Check Out
                          </LocalizedClientLink>
                        </li>
                      </ul>
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
      </section>
      {/* Cart section end */}
    </div>
  )
}

export default RokonCart
