import React, { Suspense } from "react"

import { notFound } from "next/navigation"
import { HttpTypes } from "@medusajs/types"

import ImageGallery from "@modules/products/components/image-gallery"
import RelatedProducts from "@modules/products/components/related-products"
import SkeletonRelatedProducts from "@modules/skeletons/templates/skeleton-related-products"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import LeartsActionsWrapper from "@modules/products/templates/learts-actions-wrapper"

import ExzoProductTabs from "./ExzoProductTabs"

/* ------------------------------------------------------------------ */
/* Exzo (electronics) renderer for the PRODUCT DETAIL page. Converted   */
/* from the template's product.html: the .breadcrumbs strip, the        */
/* two-column detail row (main-product-slider-wrapper gallery column +  */
/* summary column), the .tabs-block description/specs tabulation and a  */
/* related-products strip introduced with the template's centered       */
/* .title-underline heading. Props are copied exactly from the          */
/* Learts/Cignet product template so it is a drop-in replacement; ALL   */
/* commerce logic is reused verbatim (ImageGallery,                      */
/* LeartsActionsWrapper for variants + add-to-cart, RelatedProducts)    */
/* and only wrapped in the Exzo markup/classes.                          */
/* ------------------------------------------------------------------ */

type ProductTemplateProps = {
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
  countryCode: string
  images: HttpTypes.StoreProductImage[]
}

/* Bootstrapped/new products often carry no imagery yet; an empty gallery
 * collapses the two-column layout, so fall back to a neutral placeholder
 * from the template's own imagery. */
const PLACEHOLDER_IMAGES = [
  { id: "exzo-placeholder", url: "/exzo/img/product-preview-4.jpg" },
] as HttpTypes.StoreProductImage[]

const ExzoProduct: React.FC<ProductTemplateProps> = ({
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
    <div className="exzo-theme">
      {/* Product Detail Section Start */}
      <div className="container" data-testid="product-container">
        <div className="empty-space col-xs-b15 col-sm-b30"></div>

        {/* Breadcrumbs Start */}
        <div className="breadcrumbs">
          <LocalizedClientLink href="/">home</LocalizedClientLink>
          <LocalizedClientLink href="/store">shop</LocalizedClientLink>
          {product.collection && (
            <LocalizedClientLink
              href={`/collections/${product.collection.handle}`}
            >
              {product.collection.title}
            </LocalizedClientLink>
          )}
          <a>{product.title}</a>
        </div>
        {/* Breadcrumbs End */}

        <div className="empty-space col-xs-b15 col-sm-b50"></div>

        {/* Product Detail Row Start */}
        <div className="row">
          <div className="col-sm-6 col-xs-b30 col-sm-b0">
            {/* Product Gallery Start */}
            <div className="main-product-slider-wrapper exzo-product-gallery">
              <ImageGallery images={galleryImages} productId={product?.id} />
            </div>
            {/* Product Gallery End */}
          </div>

          <div className="col-sm-6">
            {/* Product Summary Start */}
            <div className="exzo-product-summary">
              <Suspense
                fallback={
                  <>
                    {product.collection && (
                      <div className="simple-article size-3 grey col-xs-b5">
                        {product.collection.title}
                      </div>
                    )}
                    <div className="h3 col-xs-b25">{product.title}</div>
                  </>
                }
              >
                <LeartsActionsWrapper id={product.id} region={region} />
              </Suspense>
            </div>
            {/* Product Summary End */}
          </div>
        </div>
        {/* Product Detail Row End */}

        <div className="empty-space col-xs-b35 col-md-b70"></div>

        {/* Description / Technical Specs Tabs */}
        <ExzoProductTabs product={product} />
      </div>
      {/* Product Detail Section End */}

      {/* Related Products Section Start */}
      <div
        className="related-products"
        data-testid="related-products-container"
      >
        <div className="container">
          <div className="empty-space col-xs-b35 col-md-b70"></div>
          <div className="text-center">
            <div className="simple-article size-3 grey uppercase col-xs-b5">
              you may also like
            </div>
            <div className="h2">related products</div>
            <div className="title-underline center">
              <span></span>
            </div>
          </div>
          <div className="empty-space col-xs-b35"></div>
          <Suspense fallback={<SkeletonRelatedProducts />}>
            <RelatedProducts product={product} countryCode={countryCode} />
          </Suspense>
          <div className="empty-space col-xs-b35 col-md-b70"></div>
        </div>
      </div>
      {/* Related Products Section End */}
    </div>
  )
}

export default ExzoProduct
