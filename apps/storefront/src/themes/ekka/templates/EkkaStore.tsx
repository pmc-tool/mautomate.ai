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
/* Ekka renderer for the STORE LISTING (PLP). Same props + behavior as  */
/* the Learts/Aurora StoreTemplate — reuses the stateful RefinementList */
/* + Pagination commerce components and the EXACT data fetch            */
/* (listProductsWithSort + getRegion). The markup is Ekka's             */
/* shop-left-sidebar-col-4.html: the ec-breadcrumb strip, the           */
/* ec-shop-leftside filter sidebar (real categories + refine controls)  */
/* and the ec-product-inner card grid, so /ekka/css styles it.          */
/* ------------------------------------------------------------------ */

const PRODUCT_LIMIT = 12
const PLACEHOLDER = "/ekka/images/product-image/6_1.jpg"

const EkkaStore = ({
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
    <div className="ekka-theme">
      {/* Ec breadcrumb start */}
      <div className="sticky-header-next-sec ec-breadcrumb section-space-mb">
        <div className="container">
          <div className="row">
            <div className="col-12">
              <div className="row ec_breadcrumb_inner">
                <div className="col-md-6 col-sm-12">
                  <h2 className="ec-breadcrumb-title">
                    {query ? `Search: "${query}"` : "Shop"}
                  </h2>
                </div>
                <div className="col-md-6 col-sm-12">
                  {/* ec-breadcrumb-list start */}
                  <ul className="ec-breadcrumb-list">
                    <li className="ec-breadcrumb-item">
                      <LocalizedClientLink href="/">Home</LocalizedClientLink>
                    </li>
                    <li className="ec-breadcrumb-item active">
                      {query ? "Search Results" : "Shop"}
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

      {/* Ec Shop page */}
      <section
        className="ec-page-content section-space-p"
        data-testid="category-container"
      >
        <div className="container">
          <div className="row">
            <div className="ec-shop-rightside col-lg-9 col-md-12 order-lg-last order-md-first margin-b-30">
              {/* Shop content Start */}
              <div className="shop-pro-content">
                <Suspense fallback={<SkeletonProductGrid />}>
                  <EkkaPaginatedProducts
                    sortBy={sort}
                    page={pageNumber}
                    countryCode={countryCode}
                    optionValueIds={optionValueIds}
                    query={query}
                  />
                </Suspense>
              </div>
              {/* Shop content End */}
            </div>

            {/* Sidebar Area Start */}
            <div className="ec-shop-leftside col-lg-3 col-md-12 order-lg-first order-md-last">
              <div id="shop_sidebar">
                <div className="ec-sidebar-heading">
                  <h1>Filter Products By</h1>
                </div>
                <div className="ec-sidebar-wrap">
                  <EkkaCategorySidebar />

                  {/* Sidebar Refine Block */}
                  <div className="ec-sidebar-block">
                    <div className="ec-sb-title">
                      <h3 className="ec-sidebar-title">Refine</h3>
                    </div>
                    <div className="ec-sb-block-content">
                      <RefinementList sortBy={sort} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* Sidebar Area End */}
          </div>
        </div>
      </section>
      {/* Ec Shop page end */}
    </div>
  )
}

/* Sidebar "Category" block — REAL top-level categories via the same
 * listCategories helper Aurora uses. Never throws: a failed fetch or an
 * empty catalog simply renders nothing. */
async function EkkaCategorySidebar({
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
    <div className="ec-sidebar-block">
      <div className="ec-sb-title">
        <h3 className="ec-sidebar-title">Category</h3>
      </div>
      <div className="ec-sb-block-content">
        <ul>
          {topLevel.map((category) => (
            <li key={category.id}>
              <div className="ec-sidebar-block-item">
                <LocalizedClientLink
                  href={`/categories/${category.handle}`}
                  style={
                    category.id === activeCategoryId
                      ? { color: "var(--ekka-primary, #3474d4)", fontWeight: 600 }
                      : undefined
                  }
                >
                  {category.name}
                </LocalizedClientLink>
              </div>
            </li>
          ))}
        </ul>
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

async function EkkaPaginatedProducts({
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
      {/* Shop Top Start */}
      <div className="ec-pro-list-top d-flex">
        <div className="col-md-6 ec-grid-list">
          <span className="sort-by">
            Showing {count} {count === 1 ? "result" : "results"}
          </span>
        </div>
        {totalPages > 1 && (
          <div className="col-md-6 ec-sort-select">
            <span className="sort-by">
              Page {page} of {totalPages}
            </span>
          </div>
        )}
      </div>
      {/* Shop Top End */}

      <div className="shop-pro-inner">
        <div className="row" data-testid="products-list">
          {products.map((p) => (
            <EkkaProductCard key={p.id} product={p} />
          ))}
        </div>
      </div>

      {totalPages > 1 && (
        <div className="ec-pro-pagination">
          <span>
            Showing page {page} of {totalPages}
          </span>
          <Pagination
            data-testid="product-pagination"
            page={page}
            totalPages={totalPages}
          />
        </div>
      )}
    </>
  )
}

const EkkaProductCard = ({ product }: { product: HttpTypes.StoreProduct }) => {
  const { cheapestPrice } = getProductPrice({ product })

  const mainImage = product.thumbnail || product.images?.[0]?.url || PLACEHOLDER
  const hoverImage = product.images?.[1]?.url || mainImage

  const onSale =
    cheapestPrice?.price_type === "sale" ||
    (!!cheapestPrice &&
      cheapestPrice.original_price !== cheapestPrice.calculated_price)

  const href = `/products/${product.handle}`

  return (
    <div className="col-xl-3 col-lg-4 col-md-6 col-sm-6 col-xs-6 mb-6 pro-gl-content">
      <div className="ec-product-inner">
        <div className="ec-pro-image-outer">
          <div className="ec-pro-image">
            <LocalizedClientLink href={href} className="image">
              <img className="main-image" src={mainImage} alt={product.title} />
              <img
                className="hover-image"
                src={hoverImage}
                alt={product.title}
              />
            </LocalizedClientLink>
            {onSale && cheapestPrice?.percentage_diff ? (
              <span className="percentage">
                {cheapestPrice.percentage_diff}%
              </span>
            ) : null}
            <LocalizedClientLink
              href={href}
              className="quickview"
              title="Quick view"
            >
              <i className="fi-rr-eye"></i>
            </LocalizedClientLink>
            <div className="ec-pro-actions">
              <LocalizedClientLink
                href={href}
                className="add-to-cart"
                title="View Product"
              >
                <i className="fi-rr-shopping-basket"></i> View Product
              </LocalizedClientLink>
            </div>
          </div>
        </div>
        <div className="ec-pro-content">
          <h5 className="ec-pro-title">
            <LocalizedClientLink href={href}>
              {product.title}
            </LocalizedClientLink>
          </h5>
          <span className="ec-price">
            {onSale && cheapestPrice ? (
              <span className="old-price">{cheapestPrice.original_price}</span>
            ) : null}
            <span className="new-price">
              {cheapestPrice?.calculated_price ?? ""}
            </span>
          </span>
        </div>
      </div>
    </div>
  )
}

export default EkkaStore
