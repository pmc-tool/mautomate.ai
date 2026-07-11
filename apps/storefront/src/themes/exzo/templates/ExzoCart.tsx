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
/* Exzo (electronics) renderer for the CART page. Converted from the    */
/* template's cart.html: the .breadcrumbs strip, the centered           */
/* "shopping cart / check your products" title with .title-underline,   */
/* the .cart-table rows (cart-entry-thumbnail, h6 title,                */
/* quantity-select stepper, total, button-close remove) and the         */
/* coupon / cart-totals row below it. Props are copied exactly from     */
/* the Learts/Cignet cart template. ALL commerce logic is the shared    */
/* one: updateLineItem / DeleteButton (deleteLineItem) for the rows,    */
/* DiscountCode (applyPromotions) for the coupon form, CartTotals for   */
/* the totals, and the same checkout step resolution as the shared      */
/* Summary component. This file is a client component because the       */
/* template's quantity-select steppers need state.                      */
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

type ExzoCartItemProps = {
  item: HttpTypes.StoreCartLineItem
  currencyCode: string
}

const ExzoCartItem = ({ item, currencyCode }: ExzoCartItemProps) => {
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
      <td data-title=" ">
        <LocalizedClientLink
          className="cart-entry-thumbnail"
          href={`/products/${item.product_handle}`}
        >
          <Thumbnail
            thumbnail={item.thumbnail}
            images={item.variant?.product?.images}
            size="square"
          />
        </LocalizedClientLink>
      </td>
      <td data-title=" ">
        <h6 className="h6">
          <LocalizedClientLink
            href={`/products/${item.product_handle}`}
            data-testid="product-title"
          >
            {item.product_title}
          </LocalizedClientLink>
        </h6>
        <LineItemOptions
          variant={item.variant}
          data-testid="product-variant"
        />
      </td>
      <td data-title="Price: ">
        <LineItemUnitPrice
          item={item}
          style="tight"
          currencyCode={currencyCode}
        />
      </td>
      <td data-title="Quantity: ">
        <div className="quantity-select">
          <button
            type="button"
            className="minus"
            aria-label="Decrease quantity"
            onClick={() => changeQuantity(item.quantity - 1)}
            disabled={updating || item.quantity <= 1}
          ></button>
          <span className="number" data-testid="product-quantity">
            {item.quantity}
          </span>
          <button
            type="button"
            className="plus"
            aria-label="Increase quantity"
            onClick={() => changeQuantity(item.quantity + 1)}
            disabled={updating || item.quantity >= maxQuantity}
          ></button>
        </div>
        {updating && <Spinner />}
        <ErrorMessage error={error} data-testid="product-error-message" />
      </td>
      <td data-title="Total: ">
        <LineItemPrice item={item} style="tight" currencyCode={currencyCode} />
      </td>
      <td data-title=" ">
        <DeleteButton id={item.id} />
      </td>
    </tr>
  )
}

const ExzoCart = ({
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
    <div className="exzo-theme">
      <div className="container">
        <div className="empty-space col-xs-b15 col-sm-b30"></div>

        {/* Breadcrumbs Start */}
        <div className="breadcrumbs">
          <LocalizedClientLink href="/">home</LocalizedClientLink>
          <a>shopping cart</a>
        </div>
        {/* Breadcrumbs End */}

        <div className="empty-space col-xs-b15 col-sm-b50"></div>

        {/* Page Title Start */}
        <div className="text-center">
          <div className="simple-article size-3 grey uppercase col-xs-b5">
            shopping cart
          </div>
          <div className="h2">check your products</div>
          <div className="title-underline center">
            <span></span>
          </div>
        </div>
        {/* Page Title End */}
      </div>

      <div className="empty-space col-xs-b35 col-md-b70"></div>

      <div className="container" data-testid="cart-container">
        {cart && items.length > 0 ? (
          <>
            {!customer && (
              <>
                <SignInPrompt />
                <div className="empty-space col-xs-b35"></div>
              </>
            )}

            {/* Cart Table Start */}
            <table className="cart-table">
              <thead>
                <tr>
                  <th style={{ width: 95 }}></th>
                  <th>product name</th>
                  <th style={{ width: 150 }}>price</th>
                  <th style={{ width: 260 }}>quantity</th>
                  <th style={{ width: 150 }}>total</th>
                  <th style={{ width: 70 }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <ExzoCartItem
                    key={item.id}
                    item={item}
                    currencyCode={cart.currency_code}
                  />
                ))}
              </tbody>
            </table>
            {/* Cart Table End */}

            <div className="empty-space col-xs-b35 col-md-b70"></div>

            <div className="row">
              <div className="col-md-6 col-xs-b50 col-md-b0">
                {/* Coupon Code Start */}
                <h4 className="h4 col-xs-b25">coupon code</h4>
                <div className="single-line-form exzo-coupon-form">
                  <DiscountCode cart={cart} />
                </div>
                {/* Coupon Code End */}
              </div>
              <div className="col-md-6">
                {/* Cart Totals Start */}
                <h4 className="h4 col-xs-b25">cart totals</h4>
                <div className="exzo-cart-totals simple-article size-3">
                  <CartTotals totals={cart} />
                </div>
                <div className="empty-space col-xs-b25"></div>
                <LocalizedClientLink
                  className="button size-2 style-3"
                  href={"/checkout?step=" + getCheckoutStep(cart)}
                  data-testid="checkout-button"
                >
                  <span className="button-wrapper">
                    <span className="icon">
                      <img src="/exzo/img/icon-4.png" alt="" />
                    </span>
                    <span className="text">proceed to checkout</span>
                  </span>
                </LocalizedClientLink>
                {/* Cart Totals End */}
              </div>
            </div>
          </>
        ) : (
          <div className="row">
            <div className="col-lg-12">
              <EmptyCartMessage />
            </div>
          </div>
        )}

        <div className="empty-space col-xs-b35 col-md-b70"></div>
      </div>
    </div>
  )
}

export default ExzoCart
