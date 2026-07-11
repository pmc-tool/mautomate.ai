import React, { Suspense } from "react"

import ImageGallery from "@modules/products/components/image-gallery"
import RelatedProducts from "@modules/products/components/related-products"
import SkeletonRelatedProducts from "@modules/skeletons/templates/skeleton-related-products"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { notFound } from "next/navigation"
import { HttpTypes } from "@medusajs/types"

import LeartsActionsWrapper from "@modules/products/templates/learts-actions-wrapper"
import HelendoProductTabs from "./HelendoProductTabs"

/* ------------------------------------------------------------------ */
/* Helendo (furniture) renderer for the PRODUCT DETAIL page. Converted  */
/* from the template's product-details.html: breadcrumb-area strip, the */
/* single-product-wrap two-column layout (gallery left, summary right), */
/* the Description / Additional information / Reviews tab section and   */
/* related products. Props are copied exactly from the Cignet/Learts    */
/* product template so it is a drop-in replacement; ALL commerce logic  */
/* is reused verbatim (ImageGallery, LeartsActionsWrapper for variants  */
/* + add-to-cart, RelatedProducts) and only wrapped in Helendo markup.  */
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
  {
    id: "helendo-placeholder-1",
    url: "/helendo/images/product/single-product-01.jpg",
  },
  {
    id: "helendo-placeholder-2",
    url: "/helendo/images/product/single-product-02.jpg",
  },
  {
    id: "helendo-placeholder-3",
    url: "/helendo/images/product/single-product-03.jpg",
  },
] as HttpTypes.StoreProductImage[]

const HelendoProduct: React.FC<ProductTemplateProps> = ({
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
    <div className="helendo-theme">
      {/* breadcrumb-area start (product-details.html) */}
      <div className="breadcrumb-area">
        <div className="container">
          <div className="row">
            <div className="col-12">
              <div className="row breadcrumb_box align-items-center">
                <div className="col-lg-6 col-md-6 col-sm-6 text-center text-sm-left">
                  <h2 className="breadcrumb-title">{product.title}</h2>
                </div>
                <div className="col-lg-6 col-md-6 col-sm-6">
                  {/* breadcrumb-list start */}
                  <ul className="breadcrumb-list text-center text-sm-right">
                    <li className="breadcrumb-item">
                      <LocalizedClientLink href="/">Home</LocalizedClientLink>
                    </li>
                    <li className="breadcrumb-item">
                      <LocalizedClientLink href="/store">
                        Shop
                      </LocalizedClientLink>
                    </li>
                    {product.collection && (
                      <li className="breadcrumb-item">
                        <LocalizedClientLink
                          href={`/collections/${product.collection.handle}`}
                        >
                          {product.collection.title}
                        </LocalizedClientLink>
                      </li>
                    )}
                    <li className="breadcrumb-item active">{product.title}</li>
                  </ul>
                  {/* breadcrumb-list end */}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* breadcrumb-area end */}

      <div id="main-wrapper">
        <div className="site-wrapper-reveal">
          <div
            className="single-product-wrap section-space--pt_90 border-bottom"
            data-testid="product-container"
          >
            <div className="container">
              <div className="row">
                <div className="col-lg-7 col-md-6 col-sm-12 col-xs-12">
                  {/* Product Details Left */}
                  <div className="product-details-left">
                    <ImageGallery images={galleryImages} />
                  </div>
                  {/* // Product Details Left */}
                </div>

                <div className="col-lg-5 col-md-6 col-sm-12 col-xs-12">
                  {/* Summary column: the shared LeartsActionsWrapper emits
                      Learts classes; the bridge sheet skins .product-summery. */}
                  <div className="product-details-content product-summery">
                    <Suspense
                      fallback={
                        <div className="product-details-title">
                          <h5 className="font-weight--reguler mb-10">
                            {product.title}
                          </h5>
                          {product.collection && (
                            <span>{product.collection.title}</span>
                          )}
                        </div>
                      }
                    >
                      <LeartsActionsWrapper id={product.id} region={region} />
                    </Suspense>
                  </div>
                </div>
              </div>

              {/* Description / Additional information / Reviews tabs */}
              <HelendoProductTabs product={product} />

              {/* Related products (product-details.html section). */}
              <div
                className="related-products section-space--ptb_90"
                data-testid="related-products-container"
              >
                <div className="row">
                  <div className="col-lg-12">
                    <div className="section-title text-center mb-30">
                      <h4>Related products</h4>
                    </div>
                  </div>
                </div>
                <Suspense fallback={<SkeletonRelatedProducts />}>
                  <RelatedProducts
                    product={product}
                    countryCode={countryCode}
                  />
                </Suspense>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default HelendoProduct
