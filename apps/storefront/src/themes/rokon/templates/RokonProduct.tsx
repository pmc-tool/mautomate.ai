import React, { Suspense } from "react"

import { HttpTypes } from "@medusajs/types"
import { notFound } from "next/navigation"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import ImageGallery from "@modules/products/components/image-gallery"
import RelatedProducts from "@modules/products/components/related-products"
import LeartsActionsWrapper from "@modules/products/templates/learts-actions-wrapper"
import SkeletonRelatedProducts from "@modules/skeletons/templates/skeleton-related-products"

import RokonProductTabs from "./RokonProductTabs"

/* ------------------------------------------------------------------ */
/* Rokon renderer for the PRODUCT DETAIL page. Converted from the       */
/* template's product-details.html: breadcrumb__section, the            */
/* product__details--section two-column layout (media box + info        */
/* column), the description/additional-info tab section and the "You    */
/* may also like" related products section. Props are copied exactly    */
/* from the Learts/Cignet product template so it is a drop-in           */
/* replacement; ALL commerce logic is reused verbatim (ImageGallery,    */
/* LeartsActionsWrapper for variants + add-to-cart, RelatedProducts)    */
/* and only wrapped in the Rokon markup/classes. The template's swiper  */
/* gallery / glightbox JS was dropped per the playbook.                 */
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
  { id: "rokon-placeholder", url: "/rokon/img/product/product1.webp" },
] as HttpTypes.StoreProductImage[]

const RokonProduct: React.FC<ProductTemplateProps> = ({
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
    <div className="rokon-theme">
      {/* Start breadcrumb section */}
      <section className="breadcrumb__section breadcrumb__bg">
        <div className="container">
          <div className="row row-cols-1">
            <div className="col">
              <div className="breadcrumb__content">
                <h1 className="breadcrumb__content--title mb-10">
                  {product.title}
                </h1>
                <ul className="breadcrumb__content--menu d-flex">
                  <li className="breadcrumb__content--menu__items">
                    <LocalizedClientLink href="/">Home</LocalizedClientLink>
                  </li>
                  <li className="breadcrumb__content--menu__items">
                    <LocalizedClientLink href="/store">
                      Shop
                    </LocalizedClientLink>
                  </li>
                  {product.collection && (
                    <li className="breadcrumb__content--menu__items">
                      <LocalizedClientLink
                        href={`/collections/${product.collection.handle}`}
                      >
                        {product.collection.title}
                      </LocalizedClientLink>
                    </li>
                  )}
                  <li className="breadcrumb__content--menu__items">
                    <span className="text__secondary">{product.title}</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* End breadcrumb section */}

      {/* Start product details section */}
      <section
        className="product__details--section section--padding"
        data-testid="product-container"
      >
        <div className="container">
          <div className="row row-cols-lg-2 row-cols-md-2 row-cols-1">
            <div className="col">
              {/* Product media: the shared ImageGallery replaces the
                  template's swiper/glightbox media stack. */}
              <div className="product__details--media">
                <ImageGallery images={galleryImages} />
              </div>
            </div>
            <div className="col">
              <div className="product__details--info">
                <Suspense
                  fallback={
                    <h3 className="product__details--info__title mb-15">
                      {product.title}
                    </h3>
                  }
                >
                  <LeartsActionsWrapper id={product.id} region={region} />
                </Suspense>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* End product details section */}

      {/* Start product details tab section */}
      <RokonProductTabs product={product} />
      {/* End product details tab section */}

      {/* Start related product section */}
      <section
        className="product__section section--padding pt-0"
        data-testid="related-products-container"
      >
        <div className="container">
          <Suspense fallback={<SkeletonRelatedProducts />}>
            <RelatedProducts product={product} countryCode={countryCode} />
          </Suspense>
        </div>
      </section>
      {/* End related product section */}
    </div>
  )
}

export default RokonProduct
