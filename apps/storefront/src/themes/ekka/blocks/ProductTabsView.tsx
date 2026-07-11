import { HttpTypes } from "@medusajs/types"

import { getProductPrice } from "@lib/util/get-product-price"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ------------------------------------------------------------------ */
/* Ekka PRESENTATIONAL view for the product_tabs block. Pure, client-    */
/* safe — it takes the already-resolved per-tab `groups` as props and    */
/* renders the Ekka ".ec-product-tab" markup. Rendered BYTE-IDENTICALLY  */
/* by both the live async server block (ProductTabs.tsx) and the visual- */
/* editor canvas (which fetches the same groups from                     */
/* /api/puck/product-tab-groups).                                        */
/* ------------------------------------------------------------------ */

interface ProductTabGroup {
  label: string
  products: HttpTypes.StoreProduct[]
}

export interface ProductTabsViewProps {
  groups: ProductTabGroup[]
  sub_title?: string
  title?: string
  sectionScope?: string
}

const PLACEHOLDER = "/ekka/images/product-image/6_1.jpg"

/* Template fallbacks — the index.html "Our Top Collection" heading. */
const FALLBACK_TITLE = "Our Top Collection"
const FALLBACK_SUB_TITLE = "Browse The Collection of Top Products"

/** Ekka product card — the ec-product-content markup from index.html. */
const ProductCard = ({ product }: { product: HttpTypes.StoreProduct }) => {
  const { cheapestPrice } = getProductPrice({ product })

  const images = product.images ?? []
  const mainImage = product.thumbnail || images[0]?.url || PLACEHOLDER
  // Second image for the template's CSS-driven hover swap, when present.
  const hoverImage = images.find((img) => img.url && img.url !== mainImage)?.url

  const onSale =
    cheapestPrice?.price_type === "sale" ||
    (!!cheapestPrice &&
      cheapestPrice.original_price !== cheapestPrice.calculated_price)

  const href = `/products/${product.handle}`

  return (
    <div className="col-lg-3 col-md-6 col-sm-6 col-xs-6 mb-6 ec-product-content">
      <div className="ec-product-inner">
        {/* Product Image Start */}
        <div className="ec-pro-image-outer">
          <div className="ec-pro-image">
            <LocalizedClientLink
              href={href}
              className="image"
              style={{ pointerEvents: "auto" }}
            >
              <img className="main-image" src={mainImage} alt={product.title} />
              {hoverImage ? (
                <img
                  className="hover-image"
                  src={hoverImage}
                  alt={product.title}
                />
              ) : null}
            </LocalizedClientLink>
            {onSale ? (
              <span className="flags">
                <span className="sale">Sale</span>
              </span>
            ) : null}
            <LocalizedClientLink
              href={href}
              className="quickview"
              title="Quick view"
              aria-label="View product"
            >
              <i className="ecicon eci-eye"></i>
            </LocalizedClientLink>
            <div className="ec-pro-actions">
              <LocalizedClientLink
                href={href}
                className="ec-btn-group compare"
                title="Compare"
                aria-label="Compare"
              >
                <i className="ecicon eci-repeat"></i>
              </LocalizedClientLink>
              <LocalizedClientLink
                href={href}
                className="add-to-cart"
                title="Add To Cart"
              >
                <i className="ecicon eci-shopping-basket"></i> Add To Cart
              </LocalizedClientLink>
              <LocalizedClientLink
                href={href}
                className="ec-btn-group wishlist"
                title="Wishlist"
                aria-label="Add to wishlist"
              >
                <i className="ecicon eci-heart-o"></i>
              </LocalizedClientLink>
            </div>
          </div>
        </div>
        {/* Product Image End */}

        {/* Product Content Start */}
        <div className="ec-pro-content">
          <h5 className="ec-pro-title">
            <LocalizedClientLink href={href}>
              {product.title}
            </LocalizedClientLink>
          </h5>
          <span className="ec-price">
            {onSale && cheapestPrice ? (
              <span className="old-price">{cheapestPrice.original_price}</span>
            ) : null}
            <span className="new-price">
              {cheapestPrice?.calculated_price ?? ""}
            </span>
          </span>
        </div>
        {/* Product Content End */}
      </div>
    </div>
  )
}

/** CSS-only tab switching, scoped by the section's stable id. */
const tabCss = (scope: string, count: number): string => {
  const rules: string[] = [
    `.ekka-product-tabs .ekka-tabs-radio{position:absolute;opacity:0;pointer-events:none}`,
    `.ekka-product-tabs .ec-pro-tab-nav label{cursor:pointer;margin:0}`,
    `.ekka-product-tabs .ekka-tab-panel{display:none}`,
  ]
  for (let i = 0; i < count; i++) {
    rules.push(
      `#${scope}-tab-${i}:checked ~ .ekka-tab-panels .ekka-tab-panel-${i}{display:flex;flex-wrap:wrap}`,
      `#${scope}-tab-${i}:checked ~ .row .ec-pro-tab-nav label[for="${scope}-tab-${i}"]{color:#3474d4}`,
      `#${scope}-tab-${i}:checked ~ .row .ec-pro-tab-nav label[for="${scope}-tab-${i}"]:before{background:#3474d4;width:100%}`
    )
  }
  return rules.join("\n")
}

const ProductTabsView = (props: ProductTabsViewProps) => {
  const groups = (Array.isArray(props.groups) ? props.groups : []).filter(
    (group) => group.products.length > 0
  )

  if (!groups.length) {
    return null
  }

  const subTitle =
    typeof props.sub_title === "string" && props.sub_title
      ? props.sub_title
      : FALLBACK_SUB_TITLE
  const title =
    typeof props.title === "string" && props.title
      ? props.title
      : FALLBACK_TITLE

  // Stable per-section scope for the radio/label ids (sanitized for CSS ids).
  const scope = (
    typeof props.sectionScope === "string" && props.sectionScope
      ? props.sectionScope
      : "ekka-products"
  ).replace(/[^a-zA-Z0-9_-]/g, "-")

  const multi = groups.length > 1

  return (
    <section className="section ec-product-tab section-space-p">
      <div className="container">
        <div className="row">
          <div className="col-md-12 text-center">
            {/* Section Title Start */}
            <div className="section-title">
              <h2 className="ec-bg-title">{title}</h2>
              <h2 className="ec-title">{title}</h2>
              <p className="sub-title">{subTitle}</p>
            </div>
            {/* Section Title End */}
          </div>
        </div>

        <div className="ekka-product-tabs">
          {multi ? (
            <style
              dangerouslySetInnerHTML={{
                __html: tabCss(scope, groups.length),
              }}
            />
          ) : null}

          {multi
            ? groups.map((group, i) => (
                <input
                  key={`radio-${i}`}
                  type="radio"
                  id={`${scope}-tab-${i}`}
                  name={`${scope}-tabs`}
                  className="ekka-tabs-radio"
                  defaultChecked={i === 0}
                  aria-label={group.label}
                />
              ))
            : null}

          {multi ? (
            <div className="row">
              <div className="col-md-12 text-center">
                {/* Tab Start */}
                <ul className="ec-pro-tab-nav nav justify-content-center">
                  {groups.map((group, i) => (
                    <li className="nav-item" key={`pill-${i}`}>
                      <label
                        htmlFor={`${scope}-tab-${i}`}
                        className="nav-link"
                      >
                        {group.label}
                      </label>
                    </li>
                  ))}
                </ul>
                {/* Tab End */}
              </div>
            </div>
          ) : null}

          <div className="ekka-tab-panels">
            {groups.map((group, i) => (
              <div
                key={group.label || i}
                className={`row ekka-tab-panel ekka-tab-panel-${i}`}
              >
                {group.products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export default ProductTabsView
