import React, { Suspense } from "react"

import ImageGallery from "@modules/products/components/image-gallery"
import RelatedProducts from "@modules/products/components/related-products"
import SkeletonRelatedProducts from "@modules/skeletons/templates/skeleton-related-products"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { notFound } from "next/navigation"
import { HttpTypes } from "@medusajs/types"

import LeartsActionsWrapper from "@modules/products/templates/learts-actions-wrapper"
import ShofyProductTabs from "./ShofyProductTabs"

/* ------------------------------------------------------------------ */
/* Shofy (multipurpose) renderer for the PRODUCT DETAIL page.          */
/* Converted from the template's product-details.html: breadcrumb list  */
/* with home icon, the tp-product-details-top two-column layout (thumb  */
/* wrapper + details wrapper), the description/additional-info tab      */
/* section and the related products section. Props are copied exactly   */
/* from the Learts/Cignet product template so it is a drop-in           */
/* replacement; ALL commerce logic is reused verbatim (ImageGallery,    */
/* LeartsActionsWrapper for variants + add-to-cart, RelatedProducts)    */
/* and only wrapped in the Shofy markup/classes.                        */
/* ------------------------------------------------------------------ */

type ProductTemplateProps = {
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
  countryCode: string
  images: HttpTypes.StoreProductImage[]
}

/* Bootstrapped/new products often carry no imagery yet; an empty gallery
 * collapses the two-column layout, so fall back to a neutral placeholder. */
const PLACEHOLDER_IMAGES = [
  { id: "shofy-placeholder", url: "/shofy/img/product/product-1.jpg" },
] as HttpTypes.StoreProductImage[]

const ShofyProduct: React.FC<ProductTemplateProps> = ({
  product,
  region,
  countryCode,
  images,
}) => {
  if (!product || !product.id) {
    return notFound()
  }

  const galleryImages = images?.length ? images : PLACEHOLDER_IMAGES

  /* SKU lives on variants; only show it when it is unambiguous. */
  const sku =
    product.variants?.length === 1 ? product.variants[0]?.sku : null

  return (
    <div className="shofy-theme">
      {/* breadcrumb area start */}
      <section className="breadcrumb__area breadcrumb__style-2 include-bg pt-50 pb-20">
        <div className="container">
          <div className="row">
            <div className="col-xxl-12">
              <div className="breadcrumb__content p-relative z-index-1">
                <div className="breadcrumb__list has-icon">
                  <span className="breadcrumb-icon">
                    <svg
                      width="17"
                      height="17"
                      viewBox="0 0 17 17"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M1.42393 16H15.5759C15.6884 16 15.7962 15.9584 15.8758 15.8844C15.9553 15.8104 16 15.71 16 15.6054V6.29143C16 6.22989 15.9846 6.1692 15.9549 6.11422C15.9252 6.05923 15.8821 6.01147 15.829 5.97475L8.75305 1.07803C8.67992 1.02736 8.59118 1 8.5 1C8.40882 1 8.32008 1.02736 8.24695 1.07803L1.17098 5.97587C1.11791 6.01259 1.0748 6.06035 1.04511 6.11534C1.01543 6.17033 0.999976 6.23101 1 6.29255V15.6063C1.00027 15.7108 1.04504 15.8109 1.12451 15.8847C1.20398 15.9585 1.31165 16 1.42393 16ZM10.1464 15.2107H6.85241V10.6202H10.1464V15.2107ZM1.84866 6.48977L8.4999 1.88561L15.1517 6.48977V15.2107H10.9946V10.2256C10.9946 10.1209 10.95 10.0206 10.8704 9.94654C10.7909 9.87254 10.683 9.83096 10.5705 9.83096H6.42848C6.316 9.83096 6.20812 9.87254 6.12858 9.94654C6.04904 10.0206 6.00435 10.1209 6.00435 10.2256V15.2107H1.84806L1.84866 6.48977Z"
                        fill="#55585B"
                        stroke="#55585B"
                        strokeWidth="0.5"
                      />
                    </svg>
                  </span>
                  <span>
                    <LocalizedClientLink href="/">Home</LocalizedClientLink>
                  </span>
                  <span>
                    <LocalizedClientLink href="/store">
                      Shop
                    </LocalizedClientLink>
                  </span>
                  {product.collection && (
                    <span>
                      <LocalizedClientLink
                        href={`/collections/${product.collection.handle}`}
                      >
                        {product.collection.title}
                      </LocalizedClientLink>
                    </span>
                  )}
                  <span>{product.title}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* breadcrumb area end */}

      {/* product details area start */}
      <section
        className="tp-product-details-area"
        data-testid="product-container"
      >
        <div className="tp-product-details-top pb-115">
          <div className="container">
            <div className="row">
              <div className="col-xl-7 col-lg-6">
                {/* Shared gallery replaces the template's Bootstrap thumb
                    tabs (dropped per the brief). */}
                <div className="tp-product-details-thumb-wrapper">
                  <ImageGallery images={galleryImages} productId={product?.id} />
                </div>
              </div>
              <div className="col-xl-5 col-lg-6">
                <div className="tp-product-details-wrapper">
                  <Suspense
                    fallback={
                      <>
                        {product.collection && (
                          <div className="tp-product-details-category">
                            <span>{product.collection.title}</span>
                          </div>
                        )}
                        <h3 className="tp-product-details-title">
                          {product.title}
                        </h3>
                      </>
                    }
                  >
                    <LeartsActionsWrapper id={product.id} region={region} />
                  </Suspense>

                  <div className="tp-product-details-query">
                    {sku && (
                      <div className="tp-product-details-query-item d-flex align-items-center">
                        <span>SKU: </span>
                        <p>{sku}</p>
                      </div>
                    )}
                    {!!product.categories?.length && (
                      <div className="tp-product-details-query-item d-flex align-items-center">
                        <span>Category: </span>
                        <p>
                          {product.categories
                            .map((category) => category.name)
                            .join(", ")}
                        </p>
                      </div>
                    )}
                    {!!product.tags?.length && (
                      <div className="tp-product-details-query-item d-flex align-items-center">
                        <span>Tag: </span>
                        <p>{product.tags.map((tag) => tag.value).join(", ")}</p>
                      </div>
                    )}
                  </div>

                  <div className="tp-product-details-payment d-flex align-items-center flex-wrap justify-content-between">
                    <p>
                      Guaranteed safe <br /> &amp; secure checkout
                    </p>
                    <img
                      src="/shofy/img/product/icons/payment-option.png"
                      alt="Payment options"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* description / additional info / reviews tabs */}
        <ShofyProductTabs product={product} />
      </section>
      {/* product details area end */}

      {/* related products area start */}
      <section
        className="tp-related-product pt-95 pb-120"
        data-testid="related-products-container"
      >
        <div className="container">
          <div className="row">
            <div className="tp-section-title-wrapper-6 text-center mb-40">
              <span className="tp-section-title-pre-6">
                Handpicked For You
              </span>
              <h3 className="tp-section-title-6">Related Products</h3>
            </div>
          </div>
          <div className="row">
            <Suspense fallback={<SkeletonRelatedProducts />}>
              <RelatedProducts product={product} countryCode={countryCode} />
            </Suspense>
          </div>
        </div>
      </section>
      {/* related products area end */}
    </div>
  )
}

export default ShofyProduct
