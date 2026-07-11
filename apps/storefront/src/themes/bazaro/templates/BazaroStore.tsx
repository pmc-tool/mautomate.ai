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
/* Bazaro (fashion) renderer for the STORE LISTING (PLP).               */
/* Same props + behavior as the Learts/Cignet StoreTemplate — reuses    */
/* the stateful RefinementList + Pagination commerce components and the */
/* EXACT data fetch (listProductsWithSort + getRegion). The markup is   */
/* the template's product-default.html: aq-breadcrumb-area header, the  */
/* aq-product-sidebar (real categories + refine controls) and the       */
/* aq-grid-layout of aq-product-item cards, so /bazaro/css styles it    */
/* faithfully. The template's data-bg-color hook needs its JS, so the   */
/* breadcrumb background is applied inline instead. The jQuery price    */
/* slider / color / brand widgets were dropped (no backing data).       */
/* ------------------------------------------------------------------ */

const PRODUCT_LIMIT = 12
export const BAZARO_PRODUCT_PLACEHOLDER =
  "/bazaro/img/fashion-1/product/product-1/front-img-1.jpg"

const BazaroStore = ({
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
    <div className="bazaro-theme">
      {/* aq breadcrumb area start */}
      <div
        className="aq-breadcrumb-area pt-20 pb-30"
        style={{ backgroundColor: "#F0EFED" }}
      >
        <div className="container">
          <div className="row align-items-center">
            <div className="col-xl-12">
              <div className="aq-breadcrumb-wrap">
                <div className="aq-breadcrumb-list mb-15">
                  <span>
                    <LocalizedClientLink href="/">home</LocalizedClientLink>
                  </span>
                  <span>/</span>
                  <span>{query ? "search" : "shop"}</span>
                </div>
                <div className="aq-breadcrumb-content">
                  <h2 className="aq-breadcrumb-title">
                    {query ? `Search: "${query}"` : "Shop"}
                  </h2>
                  <p>
                    {query
                      ? "Everything matching your search"
                      : "Shop through our latest selection of products"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* aq breadcrumb area end */}

      {/* aq product area start */}
      <div
        className="aq-product-area pt-60 pb-80"
        data-testid="category-container"
      >
        <div className="container">
          <div className="row">
            <div className="col-xl-12">
              <div className="aq-product-wrap">
                <div className="row gx-50">
                  <div className="col-xl-3 order-xl-1 order-2">
                    <div className="aq-product-sidebar mb-40">
                      <div className="aq-product-sidebar-wrap">
                        {/* categories */}
                        <BazaroCategorySidebar />

                        {/* refine */}
                        <div className="aq-product-sidebar-widget mb-25">
                          <div className="aq-product-sidebar-widget-top">
                            <h3 className="aq-product-sidebar-widget-title">
                              Refine
                            </h3>
                          </div>
                          <div className="aq-product-sidebar-widget-content">
                            <RefinementList sortBy={sort} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="col-xl-9 order-xl-2 order-1">
                    <Suspense fallback={<SkeletonProductGrid />}>
                      <BazaroPaginatedProducts
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
          </div>
        </div>
      </div>
      {/* aq product area end */}
    </div>
  )
}

/* Sidebar "Products Category" widget — REAL top-level categories via the
 * same listCategories helper the other themes use, highlighting the active
 * category when given one. Never throws: a failed fetch or an empty catalog
 * simply renders nothing. Shared with BazaroCategory. */
export async function BazaroCategorySidebar({
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
    <div className="aq-product-sidebar-widget mb-25">
      <div className="aq-product-sidebar-widget-top">
        <h3 className="aq-product-sidebar-widget-title">Products Category</h3>
      </div>
      <div className="aq-product-sidebar-widget-content">
        <div className="aq-product-sidebar-widget-categories">
          <ul>
            {topLevel.map((category) => (
              <li key={category.id}>
                <LocalizedClientLink
                  className={
                    category.id === activeCategoryId ? "active" : undefined
                  }
                  href={`/categories/${category.handle}`}
                >
                  {category.name}
                </LocalizedClientLink>
              </li>
            ))}
          </ul>
        </div>
      </div>
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

async function BazaroPaginatedProducts({
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
      {/* toolbar */}
      <div className="aq-product-sidebar-top pb-10">
        <div className="row align-items-center">
          <div className="col-md-6">
            <div className="aq-product-sidebar-left mb-20">
              <div className="aq-product-sidebar-text">
                <p className="mb-0">
                  There {count === 1 ? "is" : "are"} {count}{" "}
                  {count === 1 ? "result" : "results"} in total
                </p>
              </div>
            </div>
          </div>
          {totalPages > 1 && (
            <div className="col-md-6">
              <div className="aq-product-sidebar-right justify-content-md-end mb-20">
                <p className="mb-0">
                  Page {page} of {totalPages}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* product grid */}
      <div className="aq-product-content">
        <div
          className="aq-grid-layout aq-col-4"
          data-testid="products-list"
        >
          {products.map((p) => (
            <BazaroProductCard key={p.id} product={p} />
          ))}
        </div>
      </div>

      {totalPages > 1 && (
        <div className="aq-product-bottom mb-40">
          <div className="row">
            <div className="col-lg-12">
              <div className="aq-pagination">
                <Pagination
                  data-testid="product-pagination"
                  page={page}
                  totalPages={totalPages}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export const BazaroProductCard = ({
  product,
}: {
  product: HttpTypes.StoreProduct
}) => {
  const { cheapestPrice } = getProductPrice({ product })

  const frontImage =
    product.thumbnail || product.images?.[0]?.url || BAZARO_PRODUCT_PLACEHOLDER
  const hoverImage =
    product.images?.find((image) => image.url && image.url !== frontImage)
      ?.url || frontImage

  const onSale =
    cheapestPrice?.price_type === "sale" ||
    (!!cheapestPrice &&
      cheapestPrice.original_price !== cheapestPrice.calculated_price)

  const href = `/products/${product.handle}`

  return (
    <div className="aq-product-item aq-product-main mb-40">
      <div className="aq-product-thumb aq-img-hover-wrap p-relative mb-10">
        {onSale && cheapestPrice && (
          <div className="aq-product-badge">
            <span className="clr-sale">
              {cheapestPrice.percentage_diff
                ? `-${cheapestPrice.percentage_diff}%`
                : "Sale"}
            </span>
          </div>
        )}
        <div className="aq-product-action">
          <LocalizedClientLink
            href={href}
            className="aq-product-action-btn aq-tooltip"
            aria-label="Shop product"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
            >
              <path
                d="M6.19751 0.75L3.30151 3.654M11.3015 0.75L14.1975 3.654M6.95776 10.3501V13.1901M10.6375 10.3501V13.1901M1.94997 7.14993L3.07797 14.0619C3.33397 15.6139 3.94997 16.7499 6.23796 16.7499H11.062C13.55 16.7499 13.918 15.6619 14.206 14.1579L15.55 7.14993M0.75 5.42996C0.75 3.94996 1.542 3.82996 2.526 3.82996H14.974C15.958 3.82996 16.75 3.94996 16.75 5.42996C16.75 7.14996 15.958 7.02996 14.974 7.02996H2.526C1.542 7.02996 0.75 7.14996 0.75 5.42996Z"
                stroke="currentcolor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <span className="aq-tooltip-item">Shop Product</span>
          </LocalizedClientLink>
          <LocalizedClientLink
            href={href}
            className="aq-product-action-btn aq-tooltip"
            aria-label="View product"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="19"
              height="16"
              viewBox="0 0 19 16"
              fill="none"
            >
              <path
                d="M12.0557 7.75429C12.0557 9.42922 10.7022 10.7827 9.0273 10.7827C7.35238 10.7827 5.99891 9.42922 5.99891 7.75429C5.99891 6.07937 7.35238 4.72589 9.0273 4.72589C10.7022 4.72589 12.0557 6.07937 12.0557 7.75429Z"
                stroke="currentcolor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M9.02734 14.75C12.0134 14.75 14.7965 12.9905 16.7337 9.94517C17.495 8.75242 17.495 6.74758 16.7337 5.55483C14.7965 2.50952 12.0134 0.75 9.02734 0.75C6.04124 0.75 3.25816 2.50952 1.321 5.55483C0.559668 6.74758 0.559668 8.75242 1.321 9.94517C3.25816 12.9905 6.04124 14.75 9.02734 14.75Z"
                stroke="currentcolor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="aq-tooltip-item">View Product</span>
          </LocalizedClientLink>
        </div>
        <LocalizedClientLink href={href}>
          <img className="aq-product-img" src={frontImage} alt={product.title} />
          <img className="aq-img-hover" src={hoverImage} alt="" />
        </LocalizedClientLink>
      </div>
      <div className="aq-product-content text-center text-md-start">
        <h4 className="aq-product-title mb-10">
          <LocalizedClientLink href={href}>{product.title}</LocalizedClientLink>
        </h4>
        <div className="aq-product-price">
          <ins>
            <span className="aq-product-new-price">
              {cheapestPrice?.calculated_price ?? ""}
            </span>
          </ins>
          {onSale && cheapestPrice ? (
            <del>
              <span className="aq-product-old-price">
                {cheapestPrice.original_price}
              </span>
            </del>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default BazaroStore
