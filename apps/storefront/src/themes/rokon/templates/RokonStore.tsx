import { Suspense } from "react"

import { HttpTypes } from "@medusajs/types"

import { listCategories } from "@lib/data/categories"
import { listProductsWithSort } from "@lib/data/products"
import { getRegion } from "@lib/data/regions"
import { getProductPrice } from "@lib/util/get-product-price"
import { OptionValueIds } from "@lib/util/product-option-filters"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import SkeletonProductGrid from "@modules/skeletons/templates/skeleton-product-grid"
import { Pagination } from "@modules/store/components/pagination"
import RefinementList from "@modules/store/components/refinement-list"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"

/* ------------------------------------------------------------------ */
/* Rokon renderer for the STORE LISTING (PLP).                          */
/* Same props + behavior as the Learts/Cignet StoreTemplate — reuses    */
/* the stateful RefinementList + Pagination commerce components and the */
/* EXACT data fetch (listProductsWithSort + getRegion). The markup is   */
/* Rokon's shop.html: breadcrumb__section page title, the widget__area  */
/* sidebar (real categories + refine controls) and the product__card    */
/* grid, so /rokon/css/style.css styles it faithfully. The template's   */
/* jQuery offcanvas filter / swiper card sliders were dropped (no       */
/* template JS per the playbook).                                       */
/* ------------------------------------------------------------------ */

const PRODUCT_LIMIT = 12
export const ROKON_PRODUCT_PLACEHOLDER = "/rokon/img/product/product1.webp"

const RokonStore = ({
  sortBy,
  page,
  countryCode,
  optionValueIds,
  query,
}: {
  sortBy?: SortOptions
  page?: string
  countryCode: string
  optionValueIds?: OptionValueIds
  query?: string
}) => {
  const pageNumber = page ? parseInt(page) : 1
  const sort = sortBy || "created_at"

  return (
    <div className="rokon-theme">
      {/* Start breadcrumb section */}
      <section className="breadcrumb__section breadcrumb__bg">
        <div className="container">
          <div className="row row-cols-1">
            <div className="col">
              <div className="breadcrumb__content">
                <h1 className="breadcrumb__content--title mb-10">
                  {query ? `Search: "${query}"` : "Shop"}
                </h1>
                <ul className="breadcrumb__content--menu d-flex">
                  <li className="breadcrumb__content--menu__items">
                    <LocalizedClientLink href="/">Home</LocalizedClientLink>
                  </li>
                  <li className="breadcrumb__content--menu__items">
                    <span className="text__secondary">
                      {query ? "Search Results" : "Shop"}
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* End breadcrumb section */}

      {/* Start shop section */}
      <section
        className="shop__section section--padding"
        data-testid="category-container"
      >
        <div className="container-fluid">
          <div className="row">
            <div className="col-xl-3 col-lg-4">
              <div className="shop__sidebar--widget widget__area">
                <div className="single__widget widget__bg">
                  <h2 className="widget__title position__relative h3">
                    Filter By
                  </h2>
                  <ul className="widget__tagcloud">
                    <li className="widget__tagcloud--list">
                      <LocalizedClientLink
                        className="widget__tagcloud--link"
                        href="/store"
                      >
                        Clear All
                      </LocalizedClientLink>
                    </li>
                  </ul>
                </div>

                <RokonCategorySidebar />

                <div className="single__widget widget__bg">
                  <h2 className="widget__title position__relative h3">
                    Refine
                  </h2>
                  <RefinementList sortBy={sort} />
                </div>
              </div>
            </div>

            <div className="col-xl-9 col-lg-8">
              <div className="shop__product--wrapper">
                <Suspense fallback={<SkeletonProductGrid />}>
                  <RokonPaginatedProducts
                    sortBy={sort}
                    page={pageNumber}
                    countryCode={countryCode}
                    optionValueIds={optionValueIds}
                    query={query}
                  />
                </Suspense>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* End shop section */}
    </div>
  )
}

/* Sidebar "Categories" widget — REAL top-level categories via the same
 * listCategories helper the other themes use. Never throws: a failed
 * fetch or an empty catalog simply renders nothing. */
export async function RokonCategorySidebar({
  activeCategoryId,
}: {
  activeCategoryId?: string
}) {
  const categories = await listCategories().catch(
    () => [] as HttpTypes.StoreProductCategory[]
  )

  const topLevel = (categories ?? []).filter((c) => !c.parent_category)

  if (!topLevel.length) {
    return null
  }

  return (
    <div className="single__widget widget__bg">
      <h2 className="widget__title position__relative h3">Categories</h2>
      <ul className="widget__categories--menu">
        {topLevel.map((category) => (
          <li key={category.id} className="widget__categories--menu__list">
            <LocalizedClientLink
              className="widget__categories--menu__label d-flex align-items-center"
              href={`/categories/${category.handle}`}
            >
              <span
                className="widget__categories--menu__text"
                style={
                  category.id === activeCategoryId
                    ? { fontWeight: 700 }
                    : undefined
                }
              >
                {category.name}
              </span>
            </LocalizedClientLink>
          </li>
        ))}
      </ul>
    </div>
  )
}

type PaginatedProductsParams = {
  limit: number
  collection_id?: string[]
  category_id?: string[]
  id?: string[]
  order?: string
  q?: string
}

async function RokonPaginatedProducts({
  sortBy,
  page,
  countryCode,
  optionValueIds,
  query,
}: {
  sortBy?: SortOptions
  page: number
  countryCode: string
  optionValueIds?: OptionValueIds
  query?: string
}) {
  const queryParams: PaginatedProductsParams = {
    limit: 12,
  }

  if (query) {
    queryParams["q"] = query
  }

  if (sortBy === "created_at") {
    queryParams["order"] = "created_at"
  }

  const region = await getRegion(countryCode)

  if (!region) {
    return null
  }

  const {
    response: { products, count },
  } = await listProductsWithSort({
    page,
    queryParams,
    sortBy,
    countryCode,
    optionValueIds,
  })

  const totalPages = Math.ceil(count / PRODUCT_LIMIT)

  if (!products.length) {
    return (
      <div data-testid="products-list">
        <p>
          {query ? `No products found for "${query}".` : "No products found."}
        </p>
      </div>
    )
  }

  return (
    <>
      {/* Shop header result bar */}
      <div className="shop__header bg__gray--color d-flex align-items-center justify-content-between mb-30">
        <p className="product__showing--count">
          Showing {count} {count === 1 ? "result" : "results"}
        </p>
        {totalPages > 1 && (
          <p className="product__showing--count">
            Page {page} of {totalPages}
          </p>
        )}
      </div>

      {/* Product grid */}
      <div className="product__section--inner product__grid--inner">
        <div
          className="row row-cols-xl-3 row-cols-lg-2 row-cols-md-3 row-cols-2 mb--n30"
          data-testid="products-list"
        >
          {products.map((p) => (
            <div key={p.id} className="col custom-col-2 mb-30">
              <RokonProductCard product={p} />
            </div>
          ))}
        </div>
      </div>

      {totalPages > 1 && (
        <div className="pagination__area bg__gray--color">
          <nav className="pagination">
            <Pagination
              data-testid="product-pagination"
              page={page}
              totalPages={totalPages}
            />
          </nav>
        </div>
      )}
    </>
  )
}

export const RokonProductCard = ({
  product,
}: {
  product: HttpTypes.StoreProduct
}) => {
  const { cheapestPrice } = getProductPrice({ product })

  const mainImage =
    product.thumbnail || product.images?.[0]?.url || ROKON_PRODUCT_PLACEHOLDER
  const hoverImage = product.images?.[1]?.url || mainImage

  const onSale =
    cheapestPrice?.price_type === "sale" ||
    (!!cheapestPrice &&
      cheapestPrice.original_price !== cheapestPrice.calculated_price)

  const href = `/products/${product.handle}`

  return (
    <article className="product__card">
      <div className="product__card--thumbnail">
        <LocalizedClientLink
          className="product__card--thumbnail__link display-block"
          href={href}
        >
          <img
            className="product__card--thumbnail__img product__primary--img display-block"
            src={mainImage}
            alt={product.title}
          />
          <img
            className="product__card--thumbnail__img product__secondary--img display-block"
            src={hoverImage}
            alt={product.title}
          />
        </LocalizedClientLink>
        <ul className="product__card--action d-flex align-items-center justify-content-center">
          <li className="product__card--action__list">
            <LocalizedClientLink
              className="product__card--action__btn"
              title="View Product"
              href={href}
            >
              <svg
                className="product__card--action__btn--svg"
                xmlns="http://www.w3.org/2000/svg"
                width="24.51"
                height="22.443"
                viewBox="0 0 512 512"
              >
                <path
                  d="M221.09 64a157.09 157.09 0 10157.09 157.09A157.1 157.1 0 00221.09 64z"
                  fill="none"
                  stroke="currentColor"
                  strokeMiterlimit="10"
                  strokeWidth="32"
                ></path>
                <path
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeMiterlimit="10"
                  strokeWidth="32"
                  d="M338.29 338.29L448 448"
                ></path>
              </svg>
              <span className="visually-hidden">View Product</span>
            </LocalizedClientLink>
          </li>
          <li className="product__card--action__list">
            <LocalizedClientLink
              className="product__card--action__btn"
              title="Shop Product"
              href={href}
            >
              <svg
                className="product__card--action__btn--svg"
                xmlns="http://www.w3.org/2000/svg"
                width="25.51"
                height="22.443"
                viewBox="0 0 512 512"
              >
                <path
                  d="M352.92 80C288 80 256 144 256 144s-32-64-96.92-64c-52.76 0-94.54 44.14-95.08 96.81-1.1 109.33 86.73 187.08 183 252.42a16 16 0 0018 0c96.26-65.34 184.09-143.09 183-252.42-.54-52.67-42.32-96.81-95.08-96.81z"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="32"
                ></path>
              </svg>
              <span className="visually-hidden">Shop Product</span>
            </LocalizedClientLink>
          </li>
        </ul>
        {onSale && (
          <div className="product__badge">
            <span className="product__badge--items sale">SALE</span>
          </div>
        )}
      </div>
      <div className="product__card--content text-center">
        {product.collection && (
          <span className="product__card--meta__tag">
            {product.collection.title}
          </span>
        )}
        <h3 className="product__card--title">
          <LocalizedClientLink href={href}>
            {product.title}
          </LocalizedClientLink>
        </h3>
        <div className="product__card--price">
          <span className="current__price">
            {cheapestPrice?.calculated_price ?? ""}
          </span>
          {onSale && cheapestPrice ? (
            <>
              <span className="price__divided"></span>
              <span className="old__price">{cheapestPrice.original_price}</span>
            </>
          ) : null}
        </div>
        <LocalizedClientLink
          className="product__card--btn primary__btn"
          href={href}
        >
          View Product
        </LocalizedClientLink>
      </div>
    </article>
  )
}

export default RokonStore
