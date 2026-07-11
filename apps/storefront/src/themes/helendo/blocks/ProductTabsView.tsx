import { HttpTypes } from "@medusajs/types"

import { getProductPrice } from "@lib/util/get-product-price"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ------------------------------------------------------------------ */
/* Helendo PRESENTATIONAL view for the product_tabs block. Pure, client- */
/* safe — it takes the already-resolved per-tab `groups` as props and    */
/* renders the Helendo product section (.product-wrapper +               */
/* .single-product-item cards). Rendered BYTE-IDENTICALLY by both the    */
/* live async server block (ProductTabs.tsx) and the visual-editor canvas */
/* (which fetches the same groups from /api/puck/product-tab-groups).    */
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

const PLACEHOLDER = "/helendo/images/product/1_1-300x300.jpg"

/* Template fallback — the index.html product section heading. */
const FALLBACK_TITLE = "Best Selling"

/** Helendo product card — the single-product-item markup from index.html. */
const ProductCard = ({ product }: { product: HttpTypes.StoreProduct }) => {
  const { cheapestPrice } = getProductPrice({ product })

  const images = product.images ?? []
  const mainImage = product.thumbnail || images[0]?.url || PLACEHOLDER

  const onSale =
    cheapestPrice?.price_type === "sale" ||
    (!!cheapestPrice &&
      cheapestPrice.original_price !== cheapestPrice.calculated_price)

  const href = `/products/${product.handle}`

  return (
    <div className="single-product-item text-center">
      <div className="products-images">
        <LocalizedClientLink href={href} className="product-thumbnail">
          <img src={mainImage} className="img-fluid" alt={product.title} />
          {onSale && cheapestPrice?.percentage_diff ? (
            <span className="ribbon onsale">
              -{cheapestPrice.percentage_diff}%
            </span>
          ) : null}
        </LocalizedClientLink>
      </div>
      <div className="product-content">
        <h6 className="prodect-title">
          <LocalizedClientLink href={href}>{product.title}</LocalizedClientLink>
        </h6>
        <div className="prodect-price">
          <span className="new-price">
            {cheapestPrice?.calculated_price ?? ""}
          </span>
          {onSale && cheapestPrice ? (
            <>
              {" "}
              <span className="old-price">{cheapestPrice.original_price}</span>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}

/** CSS-only tab switching, scoped by the section's stable id. */
const tabCss = (scope: string, count: number): string => {
  const rules: string[] = [
    `.helendo-product-tabs .product-tabs-radio{position:absolute;opacity:0;pointer-events:none}`,
    `.helendo-product-tabs .product-tabs-nav{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:10px 30px;margin-bottom:30px;padding:0;list-style:none}`,
    `.helendo-product-tabs .product-tabs-nav label{cursor:pointer;margin:0;display:inline-block;font-size:16px;font-weight:500;color:#000;padding-bottom:5px;border-bottom:2px solid transparent;transition:all .3s ease}`,
    `.helendo-product-tabs .product-tabs-panels .product-tabs-panel{display:none}`,
  ]
  for (let i = 0; i < count; i++) {
    rules.push(
      `#${scope}-tab-${i}:checked ~ .product-tabs-panels .product-tabs-panel-${i}{display:flex}`,
      `#${scope}-tab-${i}:checked ~ .product-tabs-nav label[for="${scope}-tab-${i}"]{border-bottom-color:#dcb14a}`
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
      : ""
  const title =
    typeof props.title === "string" && props.title
      ? props.title
      : FALLBACK_TITLE

  // Stable per-section scope for the radio/label ids (sanitized for CSS ids).
  const scope = (
    typeof props.sectionScope === "string" && props.sectionScope
      ? props.sectionScope
      : "helendo-products"
  ).replace(/[^a-zA-Z0-9_-]/g, "-")

  const multi = groups.length > 1

  return (
    <div className="product-wrapper section-space--ptb_120">
      <div className="container">
        <div className="row">
          <div className="col-lg-12">
            <div className="section-title text-center mb-20">
              {subTitle ? (
                <h6 className="sub-heading mb-2">{subTitle}</h6>
              ) : null}
              <h2 className="section-title--one section-title--center">
                {title}
              </h2>
            </div>
          </div>
        </div>

        <div className="product-main-content">
          <div className="helendo-product-tabs">
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
                    className="product-tabs-radio"
                    defaultChecked={i === 0}
                    aria-label={group.label}
                  />
                ))
              : null}

            {multi ? (
              <div className="product-tabs-nav">
                {groups.map((group, i) => (
                  <label key={`pill-${i}`} htmlFor={`${scope}-tab-${i}`}>
                    {group.label}
                  </label>
                ))}
              </div>
            ) : null}

            <div className="product-tabs-panels">
              {groups.map((group, i) => (
                <div
                  key={group.label || i}
                  className={`row product-tabs-panel product-tabs-panel-${i}`}
                  style={multi ? undefined : { display: "flex" }}
                >
                  {group.products.map((product) => (
                    <div className="col-lg-3 col-md-6 col-6" key={product.id}>
                      <ProductCard product={product} />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProductTabsView
