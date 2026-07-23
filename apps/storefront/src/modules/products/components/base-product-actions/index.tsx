"use client"

import { addToCart } from "@lib/data/cart"
import { getProductPrice } from "@lib/util/get-product-price"
import { HttpTypes } from "@medusajs/types"
import { isEqual } from "lodash"
import { useParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { setVariantSelection } from "@modules/products/variant-gallery"

type Props = {
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
}

const optionsAsKeymap = (
  variantOptions: HttpTypes.StoreProductVariant["options"]
) =>
  variantOptions?.reduce((acc: Record<string, string>, varopt) => {
    if (varopt.option_id) acc[varopt.option_id] = varopt.value
    return acc
  }, {})

const BaseProductActions = ({ product, region }: Props) => {
  const countryCode = useParams().countryCode as string
  const [options, setOptions] = useState<Record<string, string | undefined>>({})
  const [quantity, setQuantity] = useState(1)
  const [isAdding, setIsAdding] = useState(false)
  const [added, setAdded] = useState(false)

  // Preselect when there is a single variant
  useEffect(() => {
    if (product.variants?.length === 1) {
      setOptions(optionsAsKeymap(product.variants[0].options) ?? {})
    }
  }, [product.variants])

  const selectedVariant = useMemo(() => {
    if (!product.variants?.length) return undefined
    return product.variants.find((v) =>
      isEqual(optionsAsKeymap(v.options), options)
    )
  }, [product.variants, options])

  // Tell the gallery which variant is selected, so it shows that variant's own
  // photos. This theme has its OWN actions component — wiring only the shared
  // one left every learts-family store (most of them) unfiltered.
  useEffect(() => {
    setVariantSelection(product.id, selectedVariant?.id ?? null)
    return () => setVariantSelection(undefined, null)
  }, [product.id, selectedVariant?.id])

  const setOptionValue = (optionId: string, value: string) => {
    setOptions((prev) => ({ ...prev, [optionId]: value }))
  }

  const inStock = useMemo(() => {
    if (!selectedVariant) return false
    if (!selectedVariant.manage_inventory) return true
    if (selectedVariant.allow_backorder) return true
    return (selectedVariant.inventory_quantity || 0) > 0
  }, [selectedVariant])

  const { cheapestPrice, variantPrice } = getProductPrice({
    product,
    variantId: selectedVariant?.id,
  })
  const price = variantPrice || cheapestPrice

  const handleAddToCart = async () => {
    if (!selectedVariant?.id) return
    setIsAdding(true)
    setAdded(false)
    await addToCart({
      variantId: selectedVariant.id,
      quantity,
      countryCode,
    })
    setIsAdding(false)
    setAdded(true)
  }

  const buttonLabel = !selectedVariant
    ? "Select options"
    : !inStock
    ? "Out of stock"
    : isAdding
    ? "Adding..."
    : "Add to Cart"

  return (
    <div className="product-summery learts-theme">
      {/* Ratings */}
      <div className="product-ratings">
        <span className="star-rating">
          <span className="rating-active" style={{ width: "100%" }}>
            ratings
          </span>
        </span>
        <a href="#reviews" className="review-link">
          (<span className="count">3</span> customer reviews)
        </a>
      </div>

      <h3 className="product-title">{product.title}</h3>

      <div className="product-price">
        {price ? (
          price.price_type === "sale" ? (
            <>
              <span style={{ textDecoration: "line-through", color: "#999", marginRight: 8 }}>
                {price.original_price}
              </span>
              <span>{price.calculated_price}</span>
            </>
          ) : (
            price.calculated_price
          )
        ) : (
          ""
        )}
      </div>

      {product.description && (
        <div className="product-description">
          <p>{product.description}</p>
        </div>
      )}

      {/* Variations */}
      <div className="product-variations">
        <table>
          <tbody>
            {(product.options || []).map((option) => (
              <tr key={option.id}>
                <td className="label">
                  <span>{option.title}</span>
                </td>
                <td className="value">
                  <div className="product-sizes">
                    {option.values
                      ?.map((v) => v.value)
                      .filter((v, i, arr) => arr.indexOf(v) === i)
                      .map((value) => (
                        <a
                          key={value}
                          href="#"
                          className={
                            options[option.id!] === value ? "active" : ""
                          }
                          onClick={(e) => {
                            e.preventDefault()
                            setOptionValue(option.id!, value)
                          }}
                        >
                          {value}
                        </a>
                      ))}
                  </div>
                </td>
              </tr>
            ))}
            <tr>
              <td className="label">
                <span>Quantity</span>
              </td>
              <td className="value">
                <div className="product-quantity">
                  <span
                    className="qty-btn minus"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  >
                    <i className="ti-minus" />
                  </span>
                  <input
                    type="text"
                    className="input-qty"
                    value={quantity}
                    readOnly
                  />
                  <span
                    className="qty-btn plus"
                    onClick={() => setQuantity((q) => q + 1)}
                  >
                    <i className="ti-plus" />
                  </span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Buttons */}
      <div className="product-buttons">
        <a
          href="#"
          className="btn btn-icon btn-outline-body btn-hover-dark hintT-top"
          data-hint="Add to Wishlist"
          onClick={(e) => e.preventDefault()}
        >
          <i className="far fa-heart" />
        </a>
        <button
          type="button"
          className="btn btn-dark btn-outline-hover-dark"
          onClick={handleAddToCart}
          disabled={!selectedVariant || !inStock || isAdding}
          style={{
            opacity: !selectedVariant || !inStock ? 0.55 : 1,
            cursor: !selectedVariant || !inStock ? "not-allowed" : "pointer",
          }}
        >
          <i className="fas fa-shopping-cart" /> {buttonLabel}
        </button>
        <a
          href="#"
          className="btn btn-icon btn-outline-body btn-hover-dark hintT-top"
          data-hint="Compare"
          onClick={(e) => e.preventDefault()}
        >
          <i className="fas fa-random" />
        </a>
      </div>

      {added && (
        <p style={{ color: "#72a499", marginTop: 12 }}>
          Added to cart.{" "}
          <LocalizedClientLink href="/cart" style={{ textDecoration: "underline" }}>
            View cart
          </LocalizedClientLink>
        </p>
      )}

      {/* Meta */}
      <div className="product-meta">
        <table>
          <tbody>
            {selectedVariant?.sku && (
              <tr>
                <td className="label">
                  <span>SKU</span>
                </td>
                <td className="value">{selectedVariant.sku}</td>
              </tr>
            )}
            {!!product.categories?.length && (
              <tr>
                <td className="label">
                  <span>Category</span>
                </td>
                <td className="value">
                  <ul className="product-category">
                    {product.categories.map((c) => (
                      <li key={c.id}>
                        <LocalizedClientLink href={`/categories/${c.handle}`}>
                          {c.name}
                        </LocalizedClientLink>
                      </li>
                    ))}
                  </ul>
                </td>
              </tr>
            )}
            {!!product.tags?.length && (
              <tr>
                <td className="label">
                  <span>Tags</span>
                </td>
                <td className="value">
                  <ul className="product-tags">
                    {product.tags.map((t) => (
                      <li key={t.id}>
                        <a href="#">{t.value}</a>
                      </li>
                    ))}
                  </ul>
                </td>
              </tr>
            )}
            <tr>
              <td className="label">
                <span>Share on</span>
              </td>
              <td className="value">
                <div className="product-share">
                  <a href="#">
                    <i className="fab fa-facebook-f" />
                  </a>
                  <a href="#">
                    <i className="fab fa-twitter" />
                  </a>
                  <a href="#">
                    <i className="fab fa-pinterest" />
                  </a>
                  <a href="#">
                    <i className="far fa-envelope" />
                  </a>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default BaseProductActions
