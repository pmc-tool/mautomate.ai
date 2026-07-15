import { HttpTypes } from "@medusajs/types"

import { getProductPrice } from "@lib/util/get-product-price"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ------------------------------------------------------------------ */
/* Bazaro PRESENTATIONAL view for the product_tabs block. Pure, client-  */
/* safe — it takes the already-resolved per-tab `groups` as props and    */
/* renders the Bazaro template `aq-product-area` markup. Rendered BYTE-  */
/* IDENTICALLY by both the live async server block (ProductTabs.tsx) and */
/* the visual-editor canvas (which fetches the same groups from          */
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

const PLACEHOLDER = "/bazaro/img/fashion-1/product/product-1/front-img-1.jpg"

/* Template fallbacks — the index.html product area heading. */
const FALLBACK_SUB_TITLE = "All Product Shop"
const FALLBACK_TITLE = "Favorite Style Product"

/* The template's 12x11 rating star (index.html product cards). */
const StarIcon = () => (
  <svg
    width="12"
    height="11"
    viewBox="0 0 12 11"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M5.21608 0.307961C5.38688 -0.102685 5.9686 -0.102684 6.1394 0.307962L7.34463 3.20568C7.41664 3.3788 7.57944 3.49709 7.76634 3.51207L10.8947 3.76287C11.338 3.79841 11.5178 4.35166 11.18 4.641L8.79653 6.68268C8.65414 6.80466 8.59195 6.99605 8.63546 7.17843L9.36364 10.2311C9.46684 10.6638 8.99621 11.0057 8.61666 10.7739L5.93837 9.13797C5.77836 9.04024 5.57712 9.04024 5.41711 9.13797L2.73882 10.7739C2.35927 11.0057 1.88865 10.6638 1.99184 10.2311L2.72003 7.17843C2.76353 6.99605 2.70135 6.80466 2.55895 6.68268L0.175492 4.641C-0.162276 4.35166 0.0174878 3.79841 0.460815 3.76287L3.58915 3.51207C3.77604 3.49709 3.93885 3.3788 4.01085 3.20568L5.21608 0.307961Z"
      fill="currentcolor"
    />
  </svg>
)

/* Template action icons: cart / quick view / wishlist (inline SVG copies). */
const CartIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="18"
    height="18"
    viewBox="0 0 18 18"
    fill="none"
  >
    <path
      d="M6.19751 0.75L3.30151 3.654M11.3015 0.75L14.1975 3.654M6.95776 10.3501V13.1901M10.6375 10.3501V13.1901M1.94997 7.14993L3.07797 14.0619C3.33397 15.6139 3.94997 16.7499 6.23796 16.7499H11.062C13.55 16.7499 13.918 15.6619 14.206 14.1579L15.55 7.14993M0.75 5.42996C0.75 3.94996 1.542 3.82996 2.526 3.82996H14.974C15.958 3.82996 16.75 3.94996 16.75 5.42996C16.75 7.14996 15.958 7.02996 14.974 7.02996H2.526C1.542 7.02996 0.75 7.14996 0.75 5.42996Z"
      stroke="currentcolor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
)

const EyeIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="19"
    height="16"
    viewBox="0 0 19 16"
    fill="none"
  >
    <path
      d="M12.0557 7.75429C12.0557 9.42922 10.7022 10.7827 9.0273 10.7827C7.35238 10.7827 5.99891 9.42922 5.99891 7.75429C5.99891 6.07937 7.35238 4.72589 9.0273 4.72589C10.7022 4.72589 12.0557 6.07937 12.0557 7.75429Z"
      stroke="currentcolor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M9.02734 14.75C12.0134 14.75 14.7965 12.9905 16.7337 9.94517C17.495 8.75242 17.495 6.74758 16.7337 5.55483C14.7965 2.50952 12.0134 0.75 9.02734 0.75C6.04124 0.75 3.25816 2.50952 1.321 5.55483C0.559668 6.74758 0.559668 8.75242 1.321 9.94517C3.25816 12.9905 6.04124 14.75 9.02734 14.75Z"
      stroke="currentcolor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const HeartIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="18"
    height="16"
    viewBox="0 0 18 16"
    fill="none"
  >
    <path
      d="M14.7197 1.52347C12.5744 0.244089 10.7019 0.759666 9.57712 1.58092C9.11591 1.91766 8.88531 2.08602 8.74963 2.08602C8.61396 2.08602 8.38336 1.91766 7.92215 1.58092C6.79733 0.759666 4.9249 0.244089 2.77958 1.52347C-0.0359114 3.20253 -0.67299 8.7418 5.82126 13.4151C7.05821 14.3052 7.67668 14.7502 8.74963 14.7502C9.82258 14.7502 10.4411 14.3052 11.678 13.4151C18.1723 8.7418 17.5352 3.20253 14.7197 1.52347Z"
      stroke="currentcolor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
)

/** Bazaro product card — the template's aq-product-item markup. */
const ProductCard = ({ product }: { product: HttpTypes.StoreProduct }) => {
  const { cheapestPrice } = getProductPrice({ product })

  const images = product.images ?? []
  const mainImage = product.thumbnail || images[0]?.url || PLACEHOLDER
  // Second image for the template's aq-img-hover swap, when the product has one.
  const hoverImage = images.find((img) => img.url && img.url !== mainImage)?.url

  const onSale =
    cheapestPrice?.price_type === "sale" ||
    (!!cheapestPrice &&
      cheapestPrice.original_price !== cheapestPrice.calculated_price)

  const badge =
    onSale && cheapestPrice?.percentage_diff
      ? `-${cheapestPrice.percentage_diff}%`
      : ""

  const href = `/products/${product.handle}`

  return (
    <div data-el="card" className="aq-product-item aq-product-main mb-60">
      <div className="aq-product-thumb aq-img-hover-wrap p-relative mb-10">
        {badge ? (
          <div className="aq-product-badge">
            <span className="clr-sale">{badge}</span>
          </div>
        ) : null}
        <div className="aq-product-action">
          <LocalizedClientLink
            href={href}
            className="aq-product-action-btn aq-tooltip"
            aria-label="Add to cart"
          >
            <CartIcon />
            <span className="aq-tooltip-item">Add to Cart</span>
          </LocalizedClientLink>
          <LocalizedClientLink
            href={href}
            className="aq-product-action-btn aq-tooltip"
            aria-label="View product"
          >
            <EyeIcon />
            <span className="aq-tooltip-item">Quick View</span>
          </LocalizedClientLink>
          <LocalizedClientLink
            href={href}
            className="aq-product-action-btn aq-wishlist-btn aq-tooltip"
            aria-label="Add to wishlist"
          >
            <HeartIcon />
            <span className="aq-tooltip-item">Add To Wishlist</span>
          </LocalizedClientLink>
        </div>
        <LocalizedClientLink href={href}>
          <img className="aq-product-img" src={mainImage} alt={product.title} />
          {hoverImage ? (
            <img className="aq-img-hover" src={hoverImage} alt={product.title} />
          ) : null}
        </LocalizedClientLink>
      </div>
      <div className="aq-product-content text-center text-md-start">
        <div className="aq-product-ratting">
          {Array.from({ length: 5 }).map((_, i) => (
            <span key={i}>
              <StarIcon />
            </span>
          ))}
        </div>
        <h4 className="aq-product-title mb-10">
          <LocalizedClientLink href={href}>{product.title}</LocalizedClientLink>
        </h4>
        <div className="aq-product-price">
          <ins>
            <span className="aq-product-new-price">
              {cheapestPrice?.calculated_price ?? ""}
            </span>
          </ins>
          {onSale && cheapestPrice ? (
            <del>
              <span className="aq-product-old-price">
                {cheapestPrice.original_price}
              </span>
            </del>
          ) : null}
        </div>
      </div>
    </div>
  )
}

/** CSS-only tab switching, scoped by the section's stable id. The labels are
 *  restyled after the template's `.aq-product-tab-btn ul li button` rules
 *  (those rules target <button> only, so the label copies live here). */
const tabCss = (scope: string, count: number): string => {
  const rules: string[] = [
    `.bazaro-product-tabs .bazaro-product-tabs-radio{position:absolute;opacity:0;pointer-events:none}`,
    `.bazaro-product-tabs .bazaro-product-tabs-panel{display:none}`,
    `.bazaro-product-tabs .aq-product-tab-btn label{position:relative;cursor:pointer;margin:0;font-size:20px;line-height:1.3;color:var(--aq-gray-4,#9c9c9c);transition:all .3s ease-out;font-family:var(--aq-ff-satoshi-medium)}`,
    `.bazaro-product-tabs .aq-product-tab-btn label:not(:first-child){margin-inline-start:30px}`,
    `.bazaro-product-tabs .aq-product-tab-btn label::after{position:absolute;content:"";inset-inline-end:0;bottom:0;width:0;height:1px;transition:all .3s ease-out;background-color:currentColor}`,
    `.bazaro-product-tabs .aq-product-tab-btn label:hover{color:var(--aq-common-black,#141414)}`,
    `.bazaro-product-tabs .aq-product-tab-btn label:hover::after{width:100%;inset-inline-end:auto;inset-inline-start:0}`,
    `@media (max-width:767px){.bazaro-product-tabs .aq-product-tab-btn label{font-size:16px}}`,
  ]
  for (let i = 0; i < count; i++) {
    rules.push(
      `#${scope}-tab-${i}:checked ~ .tab-content .bazaro-product-tabs-panel-${i}{display:block}`,
      `#${scope}-tab-${i}:checked ~ .aq-product-top .aq-product-tab-btn label[for="${scope}-tab-${i}"]{color:var(--aq-common-black,#141414)}`,
      `#${scope}-tab-${i}:checked ~ .aq-product-top .aq-product-tab-btn label[for="${scope}-tab-${i}"]::after{width:100%}`
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
      : "bazaro-products"
  ).replace(/[^a-zA-Z0-9_-]/g, "-")

  const multi = groups.length > 1

  return (
    <div className="aq-product-area pb-60 pt-60">
      <div className="container">
        <div className="bazaro-product-tabs">
          {multi ? (
            <style
              dangerouslySetInnerHTML={{ __html: tabCss(scope, groups.length) }}
            />
          ) : null}

          {multi
            ? groups.map(({ group }, i) => (
                <input
                  key={`radio-${i}`}
                  type="radio"
                  id={`${scope}-tab-${i}`}
                  name={`${scope}-tabs`}
                  className="bazaro-product-tabs-radio"
                  defaultChecked={i === 0}
                  aria-label={group.label}
                />
              ))
            : null}

          <div className="aq-product-top mb-40">
            <div className="row align-items-end">
              <div className="col-md-6">
                <div className="aq-product-title-box text-center text-md-start mb-15">
                  <span className="aq-section-subtitle ff-satoshi-med mb-10">
                    {subTitle}
                  </span>
                  <h4 className="aq-section-title ff-satoshi-med fs-38 mb-0">
                    {title}
                  </h4>
                </div>
              </div>
              {multi ? (
                <div className="col-md-6">
                  <div className="aq-product-tab-btn text-center text-md-end mb-15">
                    {groups.map(({ group, i: tabIndex }, i) => (
                      <label
                        data-el="tab"
                        data-el-item={`tabs:${tabIndex}`}
                        key={`pill-${tabIndex}`}
                        htmlFor={`${scope}-tab-${i}`}
                      >
                        {group.label}
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="tab-content">
            {groups.map(({ group }, i) => (
              <div
                key={group.label || i}
                className={
                  multi
                    ? `bazaro-product-tabs-panel bazaro-product-tabs-panel-${i}`
                    : "bazaro-product-tabs-panel-single"
                }
              >
                <div className="row row-cols-xl-4 row-cols-lg-3 row-cols-md-2 row-cols-sm-2 row-cols-1">
                  {group.products.map((product) => (
                    <div className="col" key={product.id}>
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
  )
}

export default ProductTabsView
