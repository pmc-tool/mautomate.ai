import React, { Suspense } from "react"

import ImageGallery from "@modules/products/components/image-gallery"
import RelatedProducts from "@modules/products/components/related-products"
import SkeletonRelatedProducts from "@modules/skeletons/templates/skeleton-related-products"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { notFound } from "next/navigation"
import { HttpTypes } from "@medusajs/types"

import LeartsActionsWrapper from "@modules/products/templates/learts-actions-wrapper"
import EkkaProductTabs from "./EkkaProductTabs"

/* ------------------------------------------------------------------ */
/* Ekka renderer for the PRODUCT DETAIL page. Converted from the        */
/* template's product-left-sidebar.html: ec-breadcrumb strip, the       */
/* single-pro-inner two-column layout (single-pro-img gallery +         */
/* single-pro-desc summary), the Detail/More Information tab section    */
/* and the ec-releted-product related section. Props are copied         */
/* exactly from the Aurora/Learts product template so it is a drop-in   */
/* replacement; ALL commerce logic is reused verbatim (ImageGallery,    */
/* LeartsActionsWrapper for variants + add-to-cart, RelatedProducts)    */
/* and only wrapped in the Ekka markup/classes.                         */
/* ------------------------------------------------------------------ */

type ProductTemplateProps = {
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
  countryCode: string
  images: HttpTypes.StoreProductImage[]
}

/* Bootstrapped/new products often carry no imagery yet; an empty gallery
 * collapses the two-column layout, so fall back to neutral placeholders. */
const PLACEHOLDER_IMAGES = [
  { id: "ekka-placeholder-1", url: "/ekka/images/product-image/6_1.jpg" },
  { id: "ekka-placeholder-2", url: "/ekka/images/product-image/6_2.jpg" },
] as HttpTypes.StoreProductImage[]

const EkkaProduct: React.FC<ProductTemplateProps> = ({
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
    <div className="ekka-theme">
      {/* Ec breadcrumb start */}
      <div className="sticky-header-next-sec ec-breadcrumb section-space-mb">
        <div className="container">
          <div className="row">
            <div className="col-12">
              <div className="row ec_breadcrumb_inner">
                <div className="col-md-6 col-sm-12">
                  <h2 className="ec-breadcrumb-title">Product</h2>
                </div>
                <div className="col-md-6 col-sm-12">
                  {/* ec-breadcrumb-list start */}
                  <ul className="ec-breadcrumb-list">
                    <li className="ec-breadcrumb-item">
                      <LocalizedClientLink href="/">Home</LocalizedClientLink>
                    </li>
                    <li className="ec-breadcrumb-item">
                      <LocalizedClientLink href="/store">
                        Shop
                      </LocalizedClientLink>
                    </li>
                    {product.collection && (
                      <li className="ec-breadcrumb-item">
                        <LocalizedClientLink
                          href={`/collections/${product.collection.handle}`}
                        >
                          {product.collection.title}
                        </LocalizedClientLink>
                      </li>
                    )}
                    <li className="ec-breadcrumb-item active">
                      {product.title}
                    </li>
                  </ul>
                  {/* ec-breadcrumb-list end */}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Ec breadcrumb end */}

      {/* Start Single product */}
      <section
        className="ec-page-content section-space-p"
        data-testid="product-container"
      >
        <div className="container">
          <div className="row">
            <div className="ec-pro-rightside ec-common-rightside col-lg-12 col-md-12">
              {/* Single product content Start */}
              <div className="single-pro-block">
                <div className="single-pro-inner">
                  <div className="row">
                    <div className="single-pro-img">
                      <ImageGallery images={galleryImages} />
                    </div>
                    <div className="single-pro-desc">
                      <div className="single-pro-content">
                        <Suspense
                          fallback={
                            <>
                              <h5 className="ec-single-title">
                                {product.title}
                              </h5>
                              {product.collection && (
                                <div className="ec-single-desc">
                                  {product.collection.title}
                                </div>
                              )}
                            </>
                          }
                        >
                          <LeartsActionsWrapper
                            id={product.id}
                            region={region}
                          />
                        </Suspense>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {/* Single product content End */}

              {/* Single product tab start */}
              <EkkaProductTabs product={product} />
              {/* Single product tab end */}
            </div>
          </div>
        </div>
      </section>
      {/* End Single product */}

      {/* Related Product Start */}
      <section
        className="section ec-releted-product section-space-p"
        data-testid="related-products-container"
      >
        <div className="container">
          <div className="row">
            <div className="col-md-12 text-center">
              <div className="section-title">
                <h2 className="ec-bg-title">Related products</h2>
                <h2 className="ec-title">Related products</h2>
                <p className="sub-title">
                  Browse The Collection of Top Products
                </p>
              </div>
            </div>
          </div>
          <div className="row margin-minus-b-30">
            <Suspense fallback={<SkeletonRelatedProducts />}>
              <RelatedProducts product={product} countryCode={countryCode} />
            </Suspense>
          </div>
        </div>
      </section>
      {/* Related Product End */}
    </div>
  )
}

export default EkkaProduct
