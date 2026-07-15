import { HttpTypes } from "@medusajs/types"

import { getProductPrice } from "@lib/util/get-product-price"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ------------------------------------------------------------------ */
/* Shofy PRESENTATIONAL view for the product_tabs block. Pure, client-   */
/* safe (no data fetching, no server-only imports) — it takes the        */
/* already-resolved per-tab `groups` as props and renders the Shofy      */
/* template's .tp-product-area markup. Rendered BYTE-IDENTICALLY by both  */
/* the live async server block (ProductTabs.tsx, which fetches then       */
/* renders this) and the visual-editor canvas (which fetches the same     */
/* groups from /api/puck/product-tab-groups then renders this), so the    */
/* editor preview always matches the storefront.                         */
/* ------------------------------------------------------------------ */

interface ProductTabGroup {
  label: string
  products: HttpTypes.StoreProduct[]
}

export interface ProductTabsViewProps {
  /** Per-tab resolved products, aligned 1:1 with the block's tabs. */
  groups: ProductTabGroup[]
  sub_title?: string
  title?: string
  /** Stable "sec-<idx>" scope used to key the CSS-only tab switching. */
  sectionScope?: string
}

const PLACEHOLDER = "/shofy/img/product/product-1.jpg"

/* Template fallback — the index.html "product area" section heading. */
const FALLBACK_TITLE = "Trending Products"

/** The template's small squiggle under a tab label (index.html tab nav). */
const TabLine = () => (
  <span className="tp-product-tab-line">
    <svg
      width="52"
      height="13"
      viewBox="0 0 52 13"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M1 8.97127C11.6061 -5.48521 33 3.99996 51 11.4635"
        stroke="currentColor"
        strokeWidth="2"
        strokeMiterlimit="3.8637"
        strokeLinecap="round"
      />
    </svg>
  </span>
)

/** Shofy product card — the tp-product-item markup from index.html. */
const ProductCard = ({ product }: { product: HttpTypes.StoreProduct }) => {
  const { cheapestPrice } = getProductPrice({ product })

  const images = product.images ?? []
  const mainImage = product.thumbnail || images[0]?.url || PLACEHOLDER
  // Second image for the hover swap, when the product has one.
  const hoverImage = images.find((img) => img.url && img.url !== mainImage)?.url

  const onSale =
    cheapestPrice?.price_type === "sale" ||
    (!!cheapestPrice &&
      cheapestPrice.original_price !== cheapestPrice.calculated_price)

  const href = `/products/${product.handle}`
  const category = product.categories?.[0]

  return (
    <div
      data-el="card"
      className="tp-product-item p-relative transition-3 mb-25 group"
    >
      <div className="tp-product-thumb p-relative fix m-img">
        <LocalizedClientLink href={href}>
          <img src={mainImage} alt={product.title} />
          {hoverImage ? (
            <img
              src={hoverImage}
              alt={product.title}
              className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100"
            />
          ) : null}
        </LocalizedClientLink>

        {/* product badge */}
        {onSale ? (
          <div className="tp-product-badge">
            <span className="product-offer">
              {cheapestPrice?.percentage_diff
                ? `-${cheapestPrice.percentage_diff}%`
                : "Sale"}
            </span>
          </div>
        ) : null}

        {/* product action */}
        <div className="tp-product-action">
          <div className="tp-product-action-item d-flex flex-column">
            <LocalizedClientLink
              href={href}
              className="tp-product-action-btn tp-product-add-cart-btn"
              aria-label="Add to cart"
            >
              <i className="fa-solid fa-cart-shopping" />
              <span className="tp-product-tooltip">Add to Cart</span>
            </LocalizedClientLink>
            <LocalizedClientLink
              href={href}
              className="tp-product-action-btn tp-product-quick-view-btn"
              aria-label="View product"
            >
              <i className="fa-regular fa-eye" />
              <span className="tp-product-tooltip">Quick View</span>
            </LocalizedClientLink>
            <LocalizedClientLink
              href={href}
              className="tp-product-action-btn tp-product-add-to-wishlist-btn"
              aria-label="Add to wishlist"
            >
              <i className="fa-regular fa-heart" />
              <span className="tp-product-tooltip">Add To Wishlist</span>
            </LocalizedClientLink>
          </div>
        </div>
      </div>

      {/* product content */}
      <div className="tp-product-content">
        {category ? (
          <div className="tp-product-category">
            <LocalizedClientLink href={`/categories/${category.handle}`}>
              {category.name}
            </LocalizedClientLink>
          </div>
        ) : null}
        <h3 className="tp-product-title">
          <LocalizedClientLink href={href}>{product.title}</LocalizedClientLink>
        </h3>
        <div className="tp-product-price-wrapper">
          {onSale && cheapestPrice ? (
            <>
              <span className="tp-product-price old-price">
                {cheapestPrice.original_price}
              </span>{" "}
              <span className="tp-product-price new-price">
                {cheapestPrice.calculated_price}
              </span>
            </>
          ) : (
            <span className="tp-product-price">
              {cheapestPrice?.calculated_price ?? ""}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

/** CSS-only tab switching, scoped by the section's stable id. It replicates
 * the template's `.nav-link.active` rules for the checked label. */
const tabCss = (scope: string, count: number): string => {
  const rules: string[] = [
    `.tp-product-tabs-radio{position:absolute;opacity:0;pointer-events:none}`,
    `#${scope} .nav-tabs .nav-item .nav-link{cursor:pointer;margin-bottom:0}`,
    `#${scope} .tp-product-tabs-panel{display:none}`,
  ]
  for (let i = 0; i < count; i++) {
    rules.push(
      `#${scope}-tab-${i}:checked ~ #${scope} .tp-product-tabs-panel-${i}{display:block}`,
      `#${scope}-tab-${i}:checked ~ #${scope} .nav-tabs label[for="${scope}-tab-${i}"]{color:var(--tp-common-black)}`,
      `#${scope}-tab-${i}:checked ~ #${scope} .nav-tabs label[for="${scope}-tab-${i}"] .tp-product-tab-line{opacity:1;visibility:visible}`
    )
  }
  return rules.join("\n")
}

const ProductTabsView = (props: ProductTabsViewProps) => {
  const groups = (Array.isArray(props.groups) ? props.groups : [])
    .map((group, i) => ({ group, i }))
    .filter(({ group }) => group.products.length > 0)

  if (!groups.length) {
    return null
  }

  const title =
    typeof props.title === "string" && props.title
      ? props.title
      : FALLBACK_TITLE

  // Stable per-section scope for the radio/label ids (sanitized for CSS ids).
  const scope = (
    typeof props.sectionScope === "string" && props.sectionScope
      ? props.sectionScope
      : "shofy-products"
  ).replace(/[^a-zA-Z0-9_-]/g, "-")

  const multi = groups.length > 1

  return (
    <section className="tp-product-area pb-55 pt-55">
      <div className="container">
        {multi ? (
          <style
            dangerouslySetInnerHTML={{ __html: tabCss(scope, groups.length) }}
          />
        ) : null}

        {multi
          ? groups.map(({ group }, idx) => (
              <input
                key={`radio-${idx}`}
                type="radio"
                id={`${scope}-tab-${idx}`}
                name={`${scope}-tabs`}
                className="tp-product-tabs-radio"
                defaultChecked={idx === 0}
                aria-label={group.label}
              />
            ))
          : null}

        <div id={scope}>
          <div className="row align-items-end">
            <div className="col-xl-5 col-lg-6 col-md-5">
              <div className="tp-section-title-wrapper mb-40">
                {props.sub_title ? (
                  <span
                    style={{
                      display: "block",
                      marginBottom: 5,
                      color: "var(--tp-theme-primary)",
                    }}
                  >
                    {props.sub_title}
                  </span>
                ) : null}
                <h3 className="tp-section-title">
                  {title}{" "}
                  <svg
                    width="114"
                    height="35"
                    viewBox="0 0 114 35"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M112 23.275C1.84952 -10.6834 -7.36586 1.48086 7.50443 32.9053"
                      stroke="currentColor"
                      strokeWidth="4"
                      strokeMiterlimit="3.8637"
                      strokeLinecap="round"
                    />
                  </svg>
                </h3>
              </div>
            </div>
            {multi ? (
              <div className="col-xl-7 col-lg-6 col-md-7">
                <div className="tp-product-tab tp-product-tab-border mb-45 tp-tab d-flex justify-content-md-end">
                  <ul className="nav nav-tabs justify-content-sm-end">
                    {groups.map(({ group, i }, idx) => (
                      <li
                        className="nav-item"
                        key={`pill-${idx}`}
                        data-el-item={`tabs:${i}`}
                      >
                        <label
                          data-el="tab"
                          htmlFor={`${scope}-tab-${idx}`}
                          className="nav-link"
                        >
                          {group.label}
                          <TabLine />
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}
          </div>

          <div className="row">
            <div className="col-xl-12">
              <div className="tp-product-tab-content">
                {groups.map(({ group }, idx) => (
                  <div
                    key={group.label || idx}
                    className={`tp-product-tabs-panel tp-product-tabs-panel-${idx}`}
                  >
                    <div className="row">
                      {group.products.map((product) => (
                        <div
                          className="col-xl-3 col-lg-3 col-sm-6"
                          key={product.id}
                        >
                          <ProductCard product={product} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default ProductTabsView
