import React, { Suspense } from "react"

import { HttpTypes } from "@medusajs/types"
import { notFound } from "next/navigation"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import ImageGallery from "@modules/products/components/image-gallery"
import RelatedProducts from "@modules/products/components/related-products"
import LeartsActionsWrapper from "@modules/products/templates/learts-actions-wrapper"
import SkeletonRelatedProducts from "@modules/skeletons/templates/skeleton-related-products"

import BazaroProductTabs from "./BazaroProductTabs"

/* ------------------------------------------------------------------ */
/* Bazaro (fashion) renderer for the PRODUCT DETAIL page. Converted     */
/* from the template's product-details-default.html: pd-breadcrumb      */
/* list, the aq-product-details-thumbnails-style two-column layout      */
/* (gallery column + aq-product-details-wrap summary column), the       */
/* Description / Additional information tab section and the             */
/* aqf-seller-area related-products block. Props are copied exactly     */
/* from the Learts/Cignet product template so it is a drop-in           */
/* replacement; ALL commerce logic is reused verbatim (ImageGallery,    */
/* LeartsActionsWrapper for variants + add-to-cart, RelatedProducts)    */
/* and only wrapped in the Bazaro markup/classes.                       */
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
  {
    id: "bazaro-placeholder",
    url: "/bazaro/img/fashion-1/product/product-1/front-img-1.jpg",
  },
] as HttpTypes.StoreProductImage[]

const BazaroProduct: React.FC<ProductTemplateProps> = ({
  product,
  region,
  countryCode,
  images,
}) => {
  if (!product || !product.id) {
    return notFound()
  }

  const galleryImages = images?.length ? images : PLACEHOLDER_IMAGES

  return (
    <div className="bazaro-theme">
      {/* breadcrumb area start */}
      <div className="pd-breadcrumb-area">
        <div className="container">
          <div className="row">
            <div className="col-xl-8">
              <div className="pd-breadcrumb-content">
                <div className="pd-breadcrumb-list">
                  <span>
                    <LocalizedClientLink href="/">home</LocalizedClientLink>
                  </span>
                  <span>/</span>
                  <span>
                    <LocalizedClientLink href="/store">
                      shop
                    </LocalizedClientLink>
                  </span>
                  {product.collection && (
                    <>
                      <span>/</span>
                      <span>
                        <LocalizedClientLink
                          href={`/collections/${product.collection.handle}`}
                        >
                          {product.collection.title}
                        </LocalizedClientLink>
                      </span>
                    </>
                  )}
                  <span>/</span>
                  <span>{product.title}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* breadcrumb area end */}

      {/* product details area start */}
      <div
        className="aq-product-details-thumbnails-style pb-120"
        data-testid="product-container"
      >
        <div className="container">
          <div className="row">
            <div className="col-lg-6 order-lg-1 order-2">
              <div className="product-details-slider-wrap">
                <ImageGallery images={galleryImages} />
              </div>
            </div>
            <div className="col-lg-6 order-lg-2 order-1">
              <div className="aq-product-details-wrap pt-25 ml-30">
                <Suspense
                  fallback={
                    <>
                      {product.collection && (
                        <div className="aq-product-details-category">
                          <span>{product.collection.title}</span>
                        </div>
                      )}
                      <h3 className="aq-product-details-title mb-10">
                        {product.title}
                      </h3>
                    </>
                  }
                >
                  <LeartsActionsWrapper id={product.id} region={region} />
                </Suspense>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* product details area end */}

      {/* Description / Additional information tabs */}
      <BazaroProductTabs product={product} />

      {/* related products area start — the shared RelatedProducts component
          renders its own section, heading and grid (same reuse as Cignet) */}
      <div
        className="aqf-seller-area pb-40"
        data-testid="related-products-container"
      >
        <Suspense fallback={<SkeletonRelatedProducts />}>
          <RelatedProducts product={product} countryCode={countryCode} />
        </Suspense>
      </div>
      {/* related products area end */}
    </div>
  )
}

export default BazaroProduct
