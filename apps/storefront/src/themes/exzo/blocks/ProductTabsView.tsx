import { HttpTypes } from "@medusajs/types"

import { getProductPrice } from "@lib/util/get-product-price"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ------------------------------------------------------------------ */
/* Exzo PRESENTATIONAL view for the product_tabs block. Pure, client-    */
/* safe — it takes the already-resolved per-tab `groups` as props and    */
/* renders the Exzo "something new for you" tabs-block markup. Rendered  */
/* BYTE-IDENTICALLY by both the live async server block (ProductTabs.tsx) */
/* and the visual-editor canvas (which fetches the same groups from       */
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

const PLACEHOLDER = "/exzo/img/product-62.jpg"

/* Template fallbacks — the index1.html "new arrivals" section heading. */
const FALLBACK_SUB_TITLE = "New arrivals"
const FALLBACK_TITLE = "Something new for you"

/** Exzo product card — the product-shortcode.style-1.big markup. */
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
    <div className="product-shortcode style-1 big exzo-product-card group">
      {onSale ? <div className="product-label red">sale</div> : null}
      <div className="preview">
        <LocalizedClientLink href={href} className="relative block">
          <img src={mainImage} alt={product.title} />
          {hoverImage ? (
            <img
              src={hoverImage}
              alt={product.title}
              className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100"
            />
          ) : null}
        </LocalizedClientLink>
        <div className="preview-buttons valign-middle">
          <div className="valign-middle-content">
            <LocalizedClientLink href={href} className="button size-2 style-2">
              <span className="button-wrapper">
                <span className="icon">
                  <img src="/exzo/img/icon-1.png" alt="" />
                </span>
                <span className="text">View Product</span>
              </span>
            </LocalizedClientLink>
            <LocalizedClientLink href={href} className="button size-2 style-3">
              <span className="button-wrapper">
                <span className="icon">
                  <img src="/exzo/img/icon-3.png" alt="" />
                </span>
                <span className="text">Add To Cart</span>
              </span>
            </LocalizedClientLink>
          </div>
        </div>
      </div>
      <div className="title">
        {category ? (
          <div className="simple-article size-1 color col-xs-b5">
            <LocalizedClientLink href={`/categories/${category.handle}`}>
              {category.name}
            </LocalizedClientLink>
          </div>
        ) : null}
        <div className="h6 animate-to-green">
          <LocalizedClientLink href={href}>{product.title}</LocalizedClientLink>
        </div>
      </div>
      <div className="price">
        <div className="simple-article size-4">
          {onSale && cheapestPrice ? (
            <>
              <span className="color">{cheapestPrice.calculated_price}</span>
              &nbsp;&nbsp;
              <span className="line-through">
                {cheapestPrice.original_price}
              </span>
            </>
          ) : (
            <span className="dark">
              {cheapestPrice?.calculated_price ?? ""}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

/** CSS-only tab switching, scoped by the section's stable id. The nav list
 * uses a bespoke class (NOT the template's .tabulation-toggle, which the
 * template CSS hides on mobile in favour of its JS dropdown). */
const tabCss = (scope: string, count: number): string => {
  const rules: string[] = [
    `.exzo-product-tabs .exzo-tabs-radio{position:absolute;opacity:0;pointer-events:none}`,
    `.exzo-product-tabs .exzo-tabs-nav{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:10px;list-style:none;margin:0;padding:0}`,
    `.exzo-product-tabs .exzo-tabs-nav li{display:block;padding:0;border:none}`,
    `.exzo-product-tabs .exzo-tabs-nav label.tab-menu{cursor:pointer;margin:0;font-weight:700}`,
    `.exzo-product-tabs .exzo-tabs-panels .exzo-tabs-panel{display:none}`,
  ]
  for (let i = 0; i < count; i++) {
    rules.push(
      `#${scope}-tab-${i}:checked ~ .exzo-tabs-panels .exzo-tabs-panel-${i}{display:block}`,
      `#${scope}-tab-${i}:checked ~ .container .exzo-tabs-nav label[for="${scope}-tab-${i}"]{background-color:#b8cd06;color:#fff;box-shadow:1px 1px 2px rgba(0,0,0,.1)}`
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
      : "exzo-products"
  ).replace(/[^a-zA-Z0-9_-]/g, "-")

  const multi = groups.length > 1

  return (
    <section className="exzo-product-tabs">
      <div className="container">
        <div className="text-center">
          <div className="simple-article size-3 grey uppercase col-xs-b5">
            {subTitle}
          </div>
          <div className="h2">{title}</div>
          <div className="title-underline center">
            <span></span>
          </div>
        </div>
      </div>

      <div className="empty-space col-xs-b35 col-md-b70"></div>

      <div className="tabs-block">
        {multi ? (
          <style
            dangerouslySetInnerHTML={{ __html: tabCss(scope, groups.length) }}
          />
        ) : null}

        {multi
          ? groups.map((group, i) => (
              <input
                key={`radio-${i}`}
                type="radio"
                id={`${scope}-tab-${i}`}
                name={`${scope}-tabs`}
                className="exzo-tabs-radio"
                defaultChecked={i === 0}
                aria-label={group.label}
              />
            ))
          : null}

        {multi ? (
          <div className="container">
            <div className="tabulation-menu-wrapper text-center">
              <ul className="exzo-tabs-nav">
                {groups.map((group, i) => (
                  <li key={`pill-${i}`}>
                    <label htmlFor={`${scope}-tab-${i}`} className="tab-menu">
                      {group.label}
                    </label>
                  </li>
                ))}
              </ul>
            </div>
            <div className="empty-space col-xs-b30 col-sm-b60"></div>
          </div>
        ) : null}

        <div className="exzo-tabs-panels">
          {groups.map((group, i) => (
            <div
              key={group.label || i}
              className={`tab-entry exzo-tabs-panel exzo-tabs-panel-${i}${
                multi ? "" : " visible"
              }`}
            >
              <div className="container">
                <div className="row">
                  {group.products.map((product) => (
                    <div
                      key={product.id}
                      className="col-md-3 col-sm-4 col-xs-6 col-xs-b30"
                    >
                      <ProductCard product={product} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default ProductTabsView
