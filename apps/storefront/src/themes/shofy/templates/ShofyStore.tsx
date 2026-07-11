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
/* Shofy (multipurpose) renderer for the STORE LISTING (PLP).          */
/* Same props + behavior as the Learts/Cignet StoreTemplate — reuses    */
/* the stateful RefinementList + Pagination commerce components and the */
/* EXACT data fetch (listProductsWithSort + getRegion). The markup is   */
/* Shofy's shop.html: breadcrumb__area header, the tp-shop-sidebar      */
/* (real categories + refine controls) and the tp-product-item-2 grid,  */
/* so the template's own CSS styles it faithfully. The jQuery price     */
/* slider / color filters were dropped (no backing data) per the brief. */
/* ------------------------------------------------------------------ */

const PRODUCT_LIMIT = 12
export const SHOFY_PRODUCT_PLACEHOLDER = "/shofy/img/product/product-1.jpg"

const ShofyStore = ({
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
    <div className="shofy-theme">
      {/* breadcrumb area start */}
      <section className="breadcrumb__area include-bg pt-100 pb-50">
        <div className="container">
          <div className="row">
            <div className="col-xxl-12">
              <div className="breadcrumb__content p-relative z-index-1">
                <h3 className="breadcrumb__title">
                  {query ? `Search: "${query}"` : "Shop"}
                </h3>
                <div className="breadcrumb__list">
                  <span>
                    <LocalizedClientLink href="/">Home</LocalizedClientLink>
                  </span>
                  <span>{query ? "Search Results" : "Shop"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* breadcrumb area end */}

      {/* shop area start */}
      <section className="tp-shop-area pb-120" data-testid="category-container">
        <div className="container">
          <div className="row">
            <div className="col-xl-3 col-lg-4">
              <div className="tp-shop-sidebar mr-10">
                {/* filter header */}
                <div className="tp-shop-widget mb-35">
                  <h3 className="tp-shop-widget-title no-border">Filter By</h3>
                  <div className="tp-shop-widget-content">
                    <LocalizedClientLink href="/store">
                      Clear All
                    </LocalizedClientLink>
                  </div>
                </div>

                {/* categories */}
                <ShofyCategorySidebar />

                {/* refine */}
                <div className="tp-shop-widget mb-50">
                  <h3 className="tp-shop-widget-title">Refine</h3>
                  <div className="tp-shop-widget-content">
                    <RefinementList sortBy={sort} />
                  </div>
                </div>
              </div>
            </div>

            <div className="col-xl-9 col-lg-8">
              <div className="tp-shop-main-wrapper">
                <Suspense fallback={<SkeletonProductGrid />}>
                  <ShofyPaginatedProducts
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
      {/* shop area end */}
    </div>
  )
}

/* Sidebar "Categories" widget — REAL top-level categories via the same
 * listCategories helper the other themes use. Never throws: a failed
 * fetch or an empty catalog simply renders nothing. */
export async function ShofyCategorySidebar({
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
    <div className="tp-shop-widget mb-50">
      <h3 className="tp-shop-widget-title">Categories</h3>
      <div className="tp-shop-widget-content">
        <div className="tp-shop-widget-categories">
          <ul>
            {topLevel.map((category) => (
              <li key={category.id}>
                <LocalizedClientLink
                  href={`/categories/${category.handle}`}
                  style={
                    category.id === activeCategoryId
                      ? { color: "var(--tp-theme-primary, #0989ff)" }
                      : undefined
                  }
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

async function ShofyPaginatedProducts({
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
      {/* shop top result bar */}
      <div className="tp-shop-top mb-45">
        <div className="row">
          <div className="col-xl-6">
            <div className="tp-shop-top-left d-flex align-items-center">
              <div className="tp-shop-top-result">
                <p>
                  Showing {count} {count === 1 ? "result" : "results"}
                </p>
              </div>
            </div>
          </div>
          {totalPages > 1 && (
            <div className="col-xl-6">
              <div className="tp-shop-top-right d-sm-flex align-items-center justify-content-xl-end">
                <div className="tp-shop-top-result">
                  <p>
                    Page {page} of {totalPages}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* product grid */}
      <div className="tp-shop-items-wrapper tp-shop-item-primary">
        <div className="row" data-testid="products-list">
          {products.map((p) => (
            <div key={p.id} className="col-xl-4 col-md-6 col-sm-6">
              <ShofyProductCard product={p} />
            </div>
          ))}
        </div>
      </div>

      {totalPages > 1 && (
        <div className="tp-shop-pagination mt-20">
          <div className="tp-pagination">
            <Pagination
              data-testid="product-pagination"
              page={page}
              totalPages={totalPages}
            />
          </div>
        </div>
      )}
    </>
  )
}

export const ShofyProductCard = ({
  product,
}: {
  product: HttpTypes.StoreProduct
}) => {
  const { cheapestPrice } = getProductPrice({ product })

  const mainImage =
    product.thumbnail || product.images?.[0]?.url || SHOFY_PRODUCT_PLACEHOLDER

  const onSale =
    cheapestPrice?.price_type === "sale" ||
    (!!cheapestPrice &&
      cheapestPrice.original_price !== cheapestPrice.calculated_price)

  const href = `/products/${product.handle}`

  return (
    <div className="tp-product-item-2 mb-40">
      <div className="tp-product-thumb-2 p-relative z-index-1 fix w-img">
        <LocalizedClientLink href={href}>
          <img src={mainImage} alt={product.title} />
        </LocalizedClientLink>
        {/* product action */}
        <div className="tp-product-action-2 tp-product-action-blackStyle">
          <div className="tp-product-action-item-2 d-flex flex-column">
            <LocalizedClientLink
              href={href}
              className="tp-product-action-btn-2 tp-product-add-cart-btn"
              aria-label="Shop product"
            >
              <svg
                width="17"
                height="17"
                viewBox="0 0 17 17"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M3.34706 4.53799L3.85961 10.6239C3.89701 11.0923 4.28036 11.4436 4.74871 11.4436H4.75212H14.0265H14.0282C14.4711 11.4436 14.8493 11.1144 14.9122 10.6774L15.7197 5.11162C15.7384 4.97924 15.7053 4.84687 15.6245 4.73995C15.5446 4.63218 15.4273 4.5626 15.2947 4.54393C15.1171 4.55072 7.74498 4.54054 3.34706 4.53799ZM4.74722 12.7162C3.62777 12.7162 2.68001 11.8438 2.58906 10.728L1.81046 1.4837L0.529505 1.26308C0.181854 1.20198 -0.0501969 0.873587 0.00930333 0.526523C0.0705036 0.17946 0.406255 -0.0462578 0.746256 0.00805037L2.51426 0.313534C2.79901 0.363599 3.01576 0.5995 3.04042 0.888012L3.24017 3.26484C15.3748 3.26993 15.4139 3.27587 15.4726 3.28266C15.946 3.3514 16.3625 3.59833 16.6464 3.97849C16.9303 4.35779 17.0493 4.82535 16.9813 5.29376L16.1747 10.8586C16.0225 11.9177 15.1011 12.7162 14.0301 12.7162H14.0259H4.75402H4.74722Z"
                  fill="currentColor"
                />
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M12.6629 7.67446H10.3067C9.95394 7.67446 9.66919 7.38934 9.66919 7.03804C9.66919 6.68673 9.95394 6.40161 10.3067 6.40161H12.6629C13.0148 6.40161 13.3004 6.68673 13.3004 7.03804C13.3004 7.38934 13.0148 7.67446 12.6629 7.67446Z"
                  fill="currentColor"
                />
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M4.38067 16.5815C3.77376 16.5815 3.28076 16.0884 3.28076 15.4826C3.28076 14.8767 3.77376 14.3845 4.38067 14.3845C4.98757 14.3845 5.48142 14.8767 5.48142 15.4826C5.48142 16.0884 4.98757 16.5815 4.38067 16.5815Z"
                  fill="currentColor"
                />
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M13.969 16.5815C13.3621 16.5815 12.8691 16.0884 12.8691 15.4826C12.8691 14.8767 13.3621 14.3845 13.969 14.3845C14.5768 14.3845 15.0706 14.8767 15.0706 15.4826C15.0706 16.0884 14.5768 16.5815 13.969 16.5815Z"
                  fill="currentColor"
                />
              </svg>
              <span className="tp-product-tooltip tp-product-tooltip-right">
                Shop Now
              </span>
            </LocalizedClientLink>
            <LocalizedClientLink
              href={href}
              className="tp-product-action-btn-2 tp-product-quick-view-btn"
              aria-label="View product"
            >
              <svg
                width="18"
                height="15"
                viewBox="0 0 18 15"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M8.99948 5.06828C7.80247 5.06828 6.82956 6.04044 6.82956 7.23542C6.82956 8.42951 7.80247 9.40077 8.99948 9.40077C10.1965 9.40077 11.1703 8.42951 11.1703 7.23542C11.1703 6.04044 10.1965 5.06828 8.99948 5.06828ZM8.99942 10.7482C7.0581 10.7482 5.47949 9.17221 5.47949 7.23508C5.47949 5.29705 7.0581 3.72021 8.99942 3.72021C10.9407 3.72021 12.5202 5.29705 12.5202 7.23508C12.5202 9.17221 10.9407 10.7482 8.99942 10.7482Z"
                  fill="currentColor"
                />
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M1.41273 7.2346C3.08674 10.9265 5.90646 13.1215 8.99978 13.1224C12.0931 13.1215 14.9128 10.9265 16.5868 7.2346C14.9128 3.54363 12.0931 1.34863 8.99978 1.34773C5.90736 1.34863 3.08674 3.54363 1.41273 7.2346ZM9.00164 14.4703H8.99804H8.99714C5.27471 14.4676 1.93209 11.8629 0.0546754 7.50073C-0.0182251 7.33091 -0.0182251 7.13864 0.0546754 6.96883C1.93209 2.60759 5.27561 0.00288103 8.99714 0.000185582C8.99894 -0.000712902 8.99894 -0.000712902 8.99984 0.000185582C9.00164 -0.000712902 9.00164 -0.000712902 9.00254 0.000185582C12.725 0.00288103 16.0676 2.60759 17.945 6.96883C18.0188 7.13864 18.0188 7.33091 17.945 7.50073C16.0685 11.8629 12.725 14.4676 9.00254 14.4703H9.00164Z"
                  fill="currentColor"
                />
              </svg>
              <span className="tp-product-tooltip tp-product-tooltip-right">
                View Product
              </span>
            </LocalizedClientLink>
          </div>
        </div>
      </div>
      <div className="tp-product-content-2 pt-15">
        {product.collection && (
          <div className="tp-product-tag-2">
            <LocalizedClientLink
              href={`/collections/${product.collection.handle}`}
            >
              {product.collection.title}
            </LocalizedClientLink>
          </div>
        )}
        <h3 className="tp-product-title-2">
          <LocalizedClientLink href={href}>
            {product.title}
          </LocalizedClientLink>
        </h3>
        <div className="tp-product-price-wrapper-2">
          <span className="tp-product-price-2 new-price">
            {cheapestPrice?.calculated_price ?? ""}
          </span>
          {onSale && cheapestPrice ? (
            <span className="tp-product-price-2 old-price">
              {cheapestPrice.original_price}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default ShofyStore
