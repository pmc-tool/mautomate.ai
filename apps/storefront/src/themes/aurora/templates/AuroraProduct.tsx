import React, { Suspense } from "react"

import ImageGallery from "@modules/products/components/image-gallery"
import RelatedProducts from "@modules/products/components/related-products"
import SkeletonRelatedProducts from "@modules/skeletons/templates/skeleton-related-products"
import { notFound } from "next/navigation"
import { HttpTypes } from "@medusajs/types"

import LeartsActionsWrapper from "@modules/products/templates/learts-actions-wrapper"

type ProductTemplateProps = {
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
  countryCode: string
  images: HttpTypes.StoreProductImage[]
}

const AuroraProduct: React.FC<ProductTemplateProps> = ({
  product,
  region,
  countryCode,
  images,
}) => {
  if (!product || !product.id) {
    return notFound()
  }

  return (
    <div className="aurora-theme bg-white font-sans text-neutral-900">
      <div
        className="mx-auto max-w-7xl px-4 py-12 sm:px-6 md:py-16 lg:px-8"
        data-testid="product-container"
      >
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
          {/* Gallery */}
          <div className="relative">
            <div className="lg:sticky lg:top-24">
              <ImageGallery images={images} />
            </div>
          </div>

          {/* Summary */}
          <div className="flex flex-col">
            <Suspense
              fallback={
                <div className="flex flex-col gap-4">
                  <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 md:text-4xl">
                    {product.title}
                  </h1>
                  <div className="h-7 w-32 animate-pulse rounded-full bg-neutral-100" />
                  <div className="mt-2 space-y-2">
                    <div className="h-4 w-full animate-pulse rounded bg-neutral-100" />
                    <div className="h-4 w-5/6 animate-pulse rounded bg-neutral-100" />
                    <div className="h-4 w-2/3 animate-pulse rounded bg-neutral-100" />
                  </div>
                </div>
              }
            >
              <LeartsActionsWrapper id={product.id} region={region} />
            </Suspense>
          </div>
        </div>
      </div>

      {/* Related products */}
      <div
        className="border-t border-neutral-200"
        data-testid="related-products-container"
      >
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 md:py-16 lg:px-8">
          <Suspense fallback={<SkeletonRelatedProducts />}>
            <RelatedProducts product={product} countryCode={countryCode} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}

export default AuroraProduct
