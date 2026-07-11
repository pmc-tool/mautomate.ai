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
/* Exzo (electronics) renderer for the STORE LISTING (PLP).            */
/* Same props + behavior as the Learts/Cignet StoreTemplate — reuses    */
/* the stateful RefinementList + Pagination commerce components and the */
/* EXACT data fetch (listProductsWithSort + getRegion). The markup is   */
/* Exzo's products1.html: the .breadcrumbs strip, the col-md-9 main     */
/* column with the .h4 page title + "SHOWING X OF Y RESULTS" line and   */
/* the .product-shortcode.style-1 card grid, and the col-md-3 sidebar   */
/* with the .categories-menu list and refine controls, so Exzo's own    */
/* CSS styles it faithfully. Template swipers/price slider dropped (no  */
/* template JS per the brief).                                          */
/* ------------------------------------------------------------------ */

const PRODUCT_LIMIT = 12
export const EXZO_PRODUCT_PLACEHOLDER = "/exzo/img/product-preview-4.jpg"

const ExzoStore = ({
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
    <div className="exzo-theme">
      <div className="container">
        <div className="empty-space col-xs-b15 col-sm-b30"></div>

        {/* Breadcrumbs Start */}
        <div className="breadcrumbs">
          <LocalizedClientLink href="/">home</LocalizedClientLink>
          <a>{query ? "search results" : "products"}</a>
        </div>
        {/* Breadcrumbs End */}

        <div className="empty-space col-xs-b15 col-sm-b50"></div>

        <div className="row" data-testid="category-container">
          <div className="col-md-9 col-md-push-3">
            {/* Page Title Start */}
            <div className="align-inline spacing-1">
              <div className="h4">
                {query ? `Search: "${query}"` : "Our Products"}
              </div>
            </div>
            {/* Page Title End */}

            <Suspense fallback={<SkeletonProductGrid />}>
              <ExzoPaginatedProducts
                sortBy={sort}
                page={pageNumber}
                countryCode={countryCode}
                optionValueIds={optionValueIds}
                query={query}
              />
            </Suspense>

            <div className="empty-space col-xs-b35 col-md-b70"></div>
          </div>

          <div className="col-md-3 col-md-pull-9">
            {/* Sidebar Start */}
            <ExzoCategorySidebar />

            <div className="empty-space col-xs-b25 col-sm-b50"></div>

            <div className="h4 col-xs-b25">Refine</div>
            <RefinementList sortBy={sort} />

            <div className="empty-space col-xs-b25 col-sm-b50"></div>

            <div className="tags light clearfix">
              <LocalizedClientLink className="tag" href="/store">
                clear all filters
              </LocalizedClientLink>
            </div>

            <div className="empty-space col-xs-b25 col-sm-b50"></div>
            {/* Sidebar End */}
          </div>
        </div>
      </div>
    </div>
  )
}

/* Sidebar "popular categories" block — REAL top-level categories via the
 * same listCategories helper Cignet uses. Never throws: a failed fetch or
 * an empty catalog simply renders nothing. */
export async function ExzoCategorySidebar({
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
    <>
      <div className="h4 col-xs-b10">popular categories</div>
      <ul className="categories-menu transparent">
        {topLevel.map((category) => (
          <li key={category.id}>
            <LocalizedClientLink
              href={`/categories/${category.handle}`}
              style={
                category.id === activeCategoryId
                  ? { color: "#b8cd06", fontWeight: 700 }
                  : undefined
              }
            >
              {category.name}
            </LocalizedClientLink>
          </li>
        ))}
      </ul>
    </>
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

async function ExzoPaginatedProducts({
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
        <div className="empty-space col-xs-b25"></div>
        <div className="simple-article size-3">
          {query ? `No products found for "${query}".` : "No products found."}
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Results Count Start */}
      <div className="align-inline spacing-1">
        <div className="simple-article size-1">
          SHOWING <b className="grey">{products.length}</b> OF{" "}
          <b className="grey">{count}</b> RESULTS
        </div>
      </div>
      {/* Results Count End */}

      <div className="empty-space col-xs-b25 col-sm-b60"></div>

      {/* Products Grid Start */}
      <div className="products-content">
        <div className="products-wrapper">
          <div className="row nopadding" data-testid="products-list">
            {products.map((p) => (
              <div className="col-sm-4" key={p.id}>
                <ExzoProductCard product={p} />
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Products Grid End */}

      {totalPages > 1 && (
        <>
          <div className="empty-space col-xs-b35 col-sm-b0"></div>
          <div className="row">
            <div className="col-sm-12 text-center">
              <div className="pagination-wrapper">
                <Pagination
                  data-testid="product-pagination"
                  page={page}
                  totalPages={totalPages}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}

export const ExzoProductCard = ({
  product,
}: {
  product: HttpTypes.StoreProduct
}) => {
  const { cheapestPrice } = getProductPrice({ product })

  const mainImage =
    product.thumbnail || product.images?.[0]?.url || EXZO_PRODUCT_PLACEHOLDER

  const onSale =
    cheapestPrice?.price_type === "sale" ||
    (!!cheapestPrice &&
      cheapestPrice.original_price !== cheapestPrice.calculated_price)

  const href = `/products/${product.handle}`

  const snippet = product.description
    ? product.description.length > 90
      ? `${product.description.slice(0, 90)}...`
      : product.description
    : null

  return (
    <div className="product-shortcode style-1">
      <div className="title">
        {product.collection && (
          <div className="simple-article size-1 color col-xs-b5">
            <LocalizedClientLink
              href={`/collections/${product.collection.handle}`}
            >
              {product.collection.title}
            </LocalizedClientLink>
          </div>
        )}
        <div className="h6 animate-to-green">
          <LocalizedClientLink href={href}>{product.title}</LocalizedClientLink>
        </div>
      </div>
      <div className="preview">
        <img src={mainImage} alt={product.title} />
        <div className="preview-buttons valign-middle">
          <div className="valign-middle-content">
            <LocalizedClientLink className="button size-2 style-2" href={href}>
              <span className="button-wrapper">
                <span className="icon">
                  <img src="/exzo/img/icon-1.png" alt="" />
                </span>
                <span className="text">Learn More</span>
              </span>
            </LocalizedClientLink>
            <LocalizedClientLink className="button size-2 style-3" href={href}>
              <span className="button-wrapper">
                <span className="icon">
                  <img src="/exzo/img/icon-3.png" alt="" />
                </span>
                <span className="text">Shop Now</span>
              </span>
            </LocalizedClientLink>
          </div>
        </div>
      </div>
      <div className="price">
        {onSale && cheapestPrice ? (
          <div className="simple-article size-4">
            <span className="color">{cheapestPrice.calculated_price}</span>
            &nbsp;&nbsp;&nbsp;
            <span className="line-through">{cheapestPrice.original_price}</span>
          </div>
        ) : (
          <div className="simple-article size-4 dark">
            {cheapestPrice?.calculated_price ?? ""}
          </div>
        )}
      </div>
      <div className="description">
        {snippet && (
          <div className="simple-article text size-2">{snippet}</div>
        )}
        <div className="icons">
          <LocalizedClientLink
            className="entry"
            href={href}
            aria-label="View product"
          >
            <i className="fa fa-eye" aria-hidden="true"></i>
          </LocalizedClientLink>
          <LocalizedClientLink
            className="entry"
            href={href}
            aria-label="Shop product"
          >
            <i className="fa fa-shopping-cart" aria-hidden="true"></i>
          </LocalizedClientLink>
        </div>
      </div>
    </div>
  )
}

export default ExzoStore
