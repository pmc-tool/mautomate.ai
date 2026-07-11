import React, { Suspense } from "react"

import ImageGallery from "@modules/products/components/image-gallery"
import RelatedProducts from "@modules/products/components/related-products"
import SkeletonRelatedProducts from "@modules/skeletons/templates/skeleton-related-products"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { notFound } from "next/navigation"
import { HttpTypes } from "@medusajs/types"

import LeartsActionsWrapper from "@modules/products/templates/learts-actions-wrapper"
import CignetProductTabs from "./CignetProductTabs"

/* ------------------------------------------------------------------ */
/* Cignet (jewellery) renderer for the PRODUCT DETAIL page. Converted   */
/* from the template's product-single.html: breadcrumb list, the        */
/* product-single-info-box two-column layout (image box + info column), */
/* the description/additional-info tab section and related products.    */
/* Props are copied exactly from the Aurora/Learts product template so  */
/* it is a drop-in replacement; ALL commerce logic is reused verbatim   */
/* (ImageGallery, LeartsActionsWrapper for variants + add-to-cart,      */
/* RelatedProducts) and only wrapped in the Cignet markup/classes.      */
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
  { id: "cignet-placeholder", url: "/cignet/images/product-image-1.png" },
] as HttpTypes.StoreProductImage[]

const CignetProduct: React.FC<ProductTemplateProps> = ({
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
    <div className="cignet-theme">
      {/* Page Product Single Start */}
      <div className="page-product-single" data-testid="product-container">
        <div className="container">
          <div className="row">
            <div className="col-lg-12">
              {/* Page Product Single Content Start */}
              <div className="page-product-single-content">
                {/* Product Single Breadcrumb List Start */}
                <div className="product-single-breadcrumb-list wow fadeInUp">
                  <nav>
                    <ol className="breadcrumb">
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
                      <li
                        className="breadcrumb-item active"
                        aria-current="page"
                      >
                        {product.title}
                      </li>
                    </ol>
                  </nav>
                </div>
                {/* Product Single Breadcrumb List End */}

                {/* Product Single Info Box Start */}
                <div className="product-single-info-box">
                  {/* Product Single Image Box Start */}
                  <div className="product-single-image-box wow fadeInUp">
                    <ImageGallery images={galleryImages} />
                  </div>
                  {/* Product Single Image Box End */}

                  {/* Product Single Info Content Start */}
                  <div className="product-single-info-content">
                    <Suspense
                      fallback={
                        <div className="product-single-title">
                          <h1>{product.title}</h1>
                          {product.collection && (
                            <span>{product.collection.title}</span>
                          )}
                        </div>
                      }
                    >
                      <LeartsActionsWrapper id={product.id} region={region} />
                    </Suspense>
                  </div>
                  {/* Product Single Info Content End */}
                </div>
                {/* Product Single Info Box End */}

                {/* Product Single Review / Tabs Section */}
                <CignetProductTabs product={product} />
              </div>
              {/* Page Product Single Content End */}
            </div>
          </div>
        </div>
      </div>
      {/* Page Product Single End */}

      {/* Related Product Section Start */}
      <div
        className="related-products"
        data-testid="related-products-container"
      >
        <Suspense fallback={<SkeletonRelatedProducts />}>
          <RelatedProducts product={product} countryCode={countryCode} />
        </Suspense>
      </div>
      {/* Related Product Section End */}
    </div>
  )
}

export default CignetProduct
