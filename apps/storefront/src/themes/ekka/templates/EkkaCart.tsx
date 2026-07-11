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
/* Ekka renderer for the CART page. Converted from the template's       */
/* cart.html: ec-breadcrumb strip, the cart-table-content rows (image + */
/* title, unit price, cart-qty-plus-minus stepper, subtotal, remove)    */
/* and the ec-sidebar Summary block (promo code + totals + checkout     */
/* button). Props are copied exactly from the Learts/Aurora cart        */
/* template. ALL commerce logic is the shared one: updateLineItem /     */
/* DeleteButton (deleteLineItem) for the rows, DiscountCode             */
/* (applyPromotions) for the promo form, CartTotals for the totals,     */
/* and the same checkout step resolution as the shared Summary          */
/* component. This file is a client component because the template's    */
/* qty steppers need state (the shared Item row is equally a client     */
/* component).                                                          */
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

type EkkaCartItemProps = {
  item: HttpTypes.StoreCartLineItem
  currencyCode: string
}

const EkkaCartItem = ({ item, currencyCode }: EkkaCartItemProps) => {
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
      <td data-label="Product" className="ec-cart-pro-name">
        <LocalizedClientLink href={`/products/${item.product_handle}`}>
          <span className="ec-cart-pro-img mr-4">
            <Thumbnail
              thumbnail={item.thumbnail}
              images={item.variant?.product?.images}
              size="square"
            />
          </span>
          <span data-testid="product-title">{item.product_title}</span>
        </LocalizedClientLink>
        <LineItemOptions variant={item.variant} data-testid="product-variant" />
      </td>
      <td data-label="Price" className="ec-cart-pro-price">
        <span className="amount">
          <LineItemUnitPrice
            item={item}
            style="tight"
            currencyCode={currencyCode}
          />
        </span>
      </td>
      <td
        data-label="Quantity"
        className="ec-cart-pro-qty"
        style={{ textAlign: "center" }}
      >
        <div className="cart-qty-plus-minus">
          <button
            type="button"
            className="dec ec_cart_qtybtn"
            aria-label="Decrease quantity"
            onClick={() => changeQuantity(item.quantity - 1)}
            disabled={updating || item.quantity <= 1}
          >
            -
          </button>
          <input
            className="cart-plus-minus"
            type="text"
            name="cartqtybutton"
            value={item.quantity}
            readOnly
            data-testid="product-quantity"
          />
          <button
            type="button"
            className="inc ec_cart_qtybtn"
            aria-label="Increase quantity"
            onClick={() => changeQuantity(item.quantity + 1)}
            disabled={updating || item.quantity >= maxQuantity}
          >
            +
          </button>
        </div>
        {updating && <Spinner />}
        <ErrorMessage error={error} data-testid="product-error-message" />
      </td>
      <td data-label="Total" className="ec-cart-pro-subtotal">
        <LineItemPrice item={item} style="tight" currencyCode={currencyCode} />
      </td>
      <td data-label="Remove" className="ec-cart-pro-remove">
        <DeleteButton id={item.id} />
      </td>
    </tr>
  )
}

const EkkaCart = ({
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
    <div className="ekka-theme">
      {/* Ec breadcrumb start */}
      <div className="sticky-header-next-sec ec-breadcrumb section-space-mb">
        <div className="container">
          <div className="row">
            <div className="col-12">
              <div className="row ec_breadcrumb_inner">
                <div className="col-md-6 col-sm-12">
                  <h2 className="ec-breadcrumb-title">Cart</h2>
                </div>
                <div className="col-md-6 col-sm-12">
                  {/* ec-breadcrumb-list start */}
                  <ul className="ec-breadcrumb-list">
                    <li className="ec-breadcrumb-item">
                      <LocalizedClientLink href="/">Home</LocalizedClientLink>
                    </li>
                    <li className="ec-breadcrumb-item active">Cart</li>
                  </ul>
                  {/* ec-breadcrumb-list end */}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Ec breadcrumb end */}

      {/* Ec cart page */}
      <section
        className="ec-page-content section-space-p"
        data-testid="cart-container"
      >
        <div className="container">
          {cart && items.length > 0 ? (
            <div className="row">
              <div className="ec-cart-leftside col-lg-8 col-md-12">
                {/* cart content Start */}
                <div className="ec-cart-content">
                  <div className="ec-cart-inner">
                    <div className="row">
                      {!customer && (
                        <div className="col-lg-12" style={{ marginBottom: 30 }}>
                          <SignInPrompt />
                        </div>
                      )}

                      <div className="table-content cart-table-content">
                        <table>
                          <thead>
                            <tr>
                              <th>Product</th>
                              <th>Price</th>
                              <th style={{ textAlign: "center" }}>Quantity</th>
                              <th>Total</th>
                              <th></th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((item) => (
                              <EkkaCartItem
                                key={item.id}
                                item={item}
                                currencyCode={cart.currency_code}
                              />
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="row">
                        <div className="col-lg-12">
                          <div className="ec-cart-update-bottom">
                            <LocalizedClientLink href="/store">
                              Continue Shopping
                            </LocalizedClientLink>
                            <LocalizedClientLink
                              href={"/checkout?step=" + getCheckoutStep(cart)}
                              className="btn btn-primary"
                              data-testid="checkout-button"
                            >
                              Check Out
                            </LocalizedClientLink>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                {/* cart content End */}
              </div>

              {/* Sidebar Area Start */}
              <div className="ec-cart-rightside col-lg-4 col-md-12">
                <div className="ec-sidebar-wrap">
                  {/* Sidebar Summary Block */}
                  <div className="ec-sidebar-block">
                    <div className="ec-sb-title">
                      <h3 className="ec-sidebar-title">Summary</h3>
                    </div>
                    <div className="ec-sb-block-content">
                      <div className="ec-cart-coupan-content">
                        <DiscountCode cart={cart} />
                      </div>
                    </div>
                    <div className="ec-sb-block-content">
                      <div className="ec-cart-summary-bottom">
                        <div className="ec-cart-summary">
                          <CartTotals totals={cart} />
                        </div>
                      </div>
                      <div className="ec-cart-checkout-btn">
                        <LocalizedClientLink
                          href={"/checkout?step=" + getCheckoutStep(cart)}
                          className="btn btn-primary"
                          data-testid="checkout-button"
                        >
                          Proceed to Checkout
                        </LocalizedClientLink>
                      </div>
                    </div>
                  </div>
                  {/* Sidebar Summary Block */}
                </div>
              </div>
              {/* Sidebar Area End */}
            </div>
          ) : (
            <div className="row">
              <div className="col-lg-12">
                <div className="ec-cart-content">
                  <EmptyCartMessage />
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
      {/* Ec cart page end */}
    </div>
  )
}

export default EkkaCart
