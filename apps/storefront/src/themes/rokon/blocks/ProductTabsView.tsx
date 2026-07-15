import { HttpTypes } from "@medusajs/types"

import { getProductPrice } from "@lib/util/get-product-price"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ------------------------------------------------------------------ */
/* Rokon PRESENTATIONAL view for the product_tabs block. Pure, client-   */
/* safe — it takes the already-resolved per-tab `groups` as props and    */
/* renders the Rokon "product__section" + `.product__card` markup.       */
/* Rendered BYTE-IDENTICALLY by both the live async server block          */
/* (ProductTabs.tsx) and the visual-editor canvas (which fetches the same */
/* groups from /api/puck/product-tab-groups).                            */
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

const PLACEHOLDER = "/rokon/img/product/product1.webp"

/* Template fallbacks — the index-2.html "Our Featured Product" heading. */
const FALLBACK_TITLE = "Our Featured Product"
const FALLBACK_SUB_TITLE =
  "Explore the latest additions to our catalogue, hand-picked for you."

/** Rokon product card — the `.product__card` markup from index-2.html. */
const ProductCard = ({ product }: { product: HttpTypes.StoreProduct }) => {
  const { cheapestPrice } = getProductPrice({ product })

  const images = product.images ?? []
  const mainImage = product.thumbnail || images[0]?.url || PLACEHOLDER
  // Second image for the template's hover swap, when the product has one.
  const hoverImage = images.find((img) => img.url && img.url !== mainImage)?.url

  const onSale =
    cheapestPrice?.price_type === "sale" ||
    (!!cheapestPrice &&
      cheapestPrice.original_price !== cheapestPrice.calculated_price)

  const href = `/products/${product.handle}`

  const categoryLabel = (product.categories ?? [])
    .map((c) => c?.name)
    .filter(Boolean)
    .slice(0, 2)
    .join(",")

  return (
    <article data-el="card" className="product__card">
      <div className="product__card--thumbnail">
        <LocalizedClientLink
          className="product__card--thumbnail__link display-block"
          href={href}
        >
          <img
            className="product__card--thumbnail__img product__primary--img display-block"
            src={mainImage}
            alt={product.title}
          />
          <img
            className="product__card--thumbnail__img product__secondary--img display-block"
            src={hoverImage || mainImage}
            alt={product.title}
          />
        </LocalizedClientLink>
        {onSale ? (
          <div className="product__badge">
            <span className="product__badge--items sale">SALE</span>
          </div>
        ) : null}
      </div>
      <div className="product__card--content text-center">
        {categoryLabel ? (
          <span className="product__card--meta__tag">{categoryLabel}</span>
        ) : null}
        <h3 className="product__card--title">
          <LocalizedClientLink href={href}>
            {product.title}
          </LocalizedClientLink>
        </h3>
        <div className="product__card--price">
          <span className="current__price">
            {cheapestPrice?.calculated_price ?? ""}
          </span>
          {onSale && cheapestPrice ? (
            <>
              <span className="price__divided"></span>
              <span className="old__price">
                {cheapestPrice.original_price}
              </span>
            </>
          ) : null}
        </div>
        <LocalizedClientLink
          className="product__card--btn primary__btn"
          href={href}
        >
          Add To Cart
        </LocalizedClientLink>
      </div>
    </article>
  )
}

/** CSS-only tab switching, scoped by the section's stable id. */
const tabCss = (scope: string, count: number): string => {
  const rules: string[] = [
    `.rokon-product-tabs .rokon-product-tabs__radio{position:absolute;opacity:0;pointer-events:none}`,
    `.rokon-product-tabs .rokon-product-tabs__nav label{cursor:pointer;margin-bottom:0}`,
    `.rokon-product-tabs .rokon-product-tabs__panel{display:none}`,
  ]
  for (let i = 0; i < count; i++) {
    rules.push(
      `#${scope}-tab-${i}:checked ~ .rokon-product-tabs__panels .rokon-product-tabs__panel-${i}{display:flex}`,
      `#${scope}-tab-${i}:checked ~ .rokon-product-tabs__nav label[for="${scope}-tab-${i}"]{background:var(--secondary-color);color:var(--white-color)}`
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
  const subTitle =
    typeof props.sub_title === "string" && props.sub_title
      ? props.sub_title
      : FALLBACK_SUB_TITLE

  // Stable per-section scope for the radio/label ids (sanitized for CSS ids).
  const scope = (
    typeof props.sectionScope === "string" && props.sectionScope
      ? props.sectionScope
      : "rokon-products"
  ).replace(/[^a-zA-Z0-9_-]/g, "-")

  const multi = groups.length > 1

  return (
    <section className="product__section section--padding">
      <div className="container">
        <div className="section__heading text-center mb-50">
          <h2 className="section__heading--maintitle text__secondary mb-10">
            {title}
          </h2>
          <p className="section__heading--desc">{subTitle}</p>
        </div>
        <div className="product__inner rokon-product-tabs">
          {multi ? (
            <style
              dangerouslySetInnerHTML={{
                __html: tabCss(scope, groups.length),
              }}
            />
          ) : null}

          {multi
            ? groups.map(({ group, i }, pos) => (
                <input
                  key={`radio-${i}`}
                  type="radio"
                  id={`${scope}-tab-${pos}`}
                  name={`${scope}-tabs`}
                  className="rokon-product-tabs__radio"
                  defaultChecked={pos === 0}
                  aria-label={group.label}
                />
              ))
            : null}

          {multi ? (
            <div className="rokon-product-tabs__nav project__tab--btn d-flex justify-content-center mb-40">
              {groups.map(({ group, i }, pos) => (
                <label
                  key={`pill-${i}`}
                  data-el="tab"
                  data-el-item={`tabs:${i}`}
                  htmlFor={`${scope}-tab-${pos}`}
                  className="project__tab--btn__list"
                >
                  {group.label}
                </label>
              ))}
            </div>
          ) : null}

          <div className="rokon-product-tabs__panels">
            {groups.map(({ group, i }, pos) => (
              <div
                key={group.label || i}
                className={
                  multi
                    ? `row row-cols-lg-3 row-cols-md-3 row-cols-2 mb--n30 rokon-product-tabs__panel rokon-product-tabs__panel-${pos}`
                    : "row row-cols-lg-3 row-cols-md-3 row-cols-2 mb--n30"
                }
              >
                {group.products.map((product) => (
                  <div className="col custom-col-2 mb-30" key={product.id}>
                    <ProductCard product={product} />
                  </div>
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
