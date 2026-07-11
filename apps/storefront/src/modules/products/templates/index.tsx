import React, { Suspense } from "react"

import ImageGallery from "@modules/products/components/image-gallery"
import RelatedProducts from "@modules/products/components/related-products"
import SkeletonRelatedProducts from "@modules/skeletons/templates/skeleton-related-products"
import { notFound } from "next/navigation"
import { HttpTypes } from "@medusajs/types"

import LeartsActionsWrapper from "./learts-actions-wrapper"

type ProductTemplateProps = {
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
  countryCode: string
  images: HttpTypes.StoreProductImage[]
}

const ProductTemplate: React.FC<ProductTemplateProps> = ({
  product,
  region,
  countryCode,
  images,
}) => {
  if (!product || !product.id) {
    return notFound()
  }

  return (
    <div className="learts-theme">
      <div
        className="section section-fluid section-padding bg-white"
        data-testid="product-container"
      >
        <div className="container">
          <div className="row">
            {/* Gallery */}
            <div className="col-lg-6 col-12 learts-mb-40">
              <div className="block w-full relative">
                <ImageGallery images={images} />
              </div>
            </div>

            {/* Summary */}
            <div className="col-lg-6 col-12 learts-mb-40">
              <Suspense
                fallback={
                  <div className="product-summery">
                    <h3 className="product-title">{product.title}</h3>
                  </div>
                }
              >
                <LeartsActionsWrapper id={product.id} region={region} />
              </Suspense>
            </div>
          </div>
        </div>
      </div>

      {/* Related products */}
      <div data-testid="related-products-container">
        <Suspense fallback={<SkeletonRelatedProducts />}>
          <RelatedProducts product={product} countryCode={countryCode} />
        </Suspense>
      </div>
    </div>
  )
}

export default ProductTemplate
