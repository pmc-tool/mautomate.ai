import { notFound } from "next/navigation"
import { Suspense } from "react"

import { HttpTypes } from "@medusajs/types"

import { listProductsWithSort } from "@lib/data/products"
import { getRegion } from "@lib/data/regions"
import { OptionValueIds } from "@lib/util/product-option-filters"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import SkeletonProductGrid from "@modules/skeletons/templates/skeleton-product-grid"
import { Pagination } from "@modules/store/components/pagination"
import RefinementList from "@modules/store/components/refinement-list"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"

import { ExzoCategorySidebar, ExzoProductCard } from "./ExzoStore"

/* ------------------------------------------------------------------ */
/* Exzo (electronics) renderer for the CATEGORY LISTING.               */
/* Same props + behavior as the Learts/Cignet CategoryTemplate —        */
/* reuses the stateful RefinementList + Pagination commerce components  */
/* and the EXACT data fetch (listProductsWithSort + getRegion),         */
/* filtered by category_id. Markup is Exzo's products1.html: the        */
/* .breadcrumbs strip carries the parent category trail, the .h4 page   */
/* title is the category name, the sidebar highlights the active        */
/* category (.categories-menu) and lists its children, and the grid is  */
/* the .product-shortcode.style-1 cards (shared with ExzoStore).        */
/* ------------------------------------------------------------------ */

const PRODUCT_LIMIT = 12

const ExzoCategory = ({
  category,
  sortBy,
  page,
  countryCode,
  optionValueIds,
}: {
  category: HttpTypes.StoreProductCategory
  sortBy?: SortOptions
  page?: string
  countryCode: string
  optionValueIds?: OptionValueIds
}) => {
  const pageNumber = page ? parseInt(page) : 1
  const sort = sortBy || "created_at"

  if (!category || !countryCode) notFound()

  const parents = [] as HttpTypes.StoreProductCategory[]

  const getParents = (cat: HttpTypes.StoreProductCategory) => {
    if (cat.parent_category) {
      parents.push(cat.parent_category)
      getParents(cat.parent_category)
    }
  }

  getParents(category)

  return (
    <div className="exzo-theme" data-testid="category-container">
      <div className="container">
        <div className="empty-space col-xs-b15 col-sm-b30"></div>

        {/* Breadcrumbs Start */}
        <div className="breadcrumbs">
          <LocalizedClientLink href="/">home</LocalizedClientLink>
          {parents
            .slice()
            .reverse()
            .map((parent) => (
              <LocalizedClientLink
                key={parent.id}
                href={`/categories/${parent.handle}`}
                data-testid="sort-by-link"
              >
                {parent.name}
              </LocalizedClientLink>
            ))}
          <a>{category.name}</a>
        </div>
        {/* Breadcrumbs End */}

        <div className="empty-space col-xs-b15 col-sm-b50"></div>

        <div className="row">
          <div className="col-md-9 col-md-push-3">
            {/* Page Title Start */}
            <div className="align-inline spacing-1">
              <div className="h4" data-testid="category-page-title">
                {category.name}
              </div>
            </div>
            {/* Page Title End */}

            {category.description && (
              <>
                <div className="empty-space col-xs-b10"></div>
                <div className="simple-article size-2">
                  {category.description}
                </div>
              </>
            )}

            <Suspense
              fallback={
                <SkeletonProductGrid
                  numberOfProducts={category.products?.length ?? 8}
                />
              }
            >
              <ExzoPaginatedProducts
                sortBy={sort}
                page={pageNumber}
                categoryId={category.id}
                countryCode={countryCode}
                optionValueIds={optionValueIds}
              />
            </Suspense>

            <div className="empty-space col-xs-b35 col-md-b70"></div>
          </div>

          <div className="col-md-3 col-md-pull-9">
            {/* Sidebar Start */}
            <ExzoCategorySidebar activeCategoryId={category.id} />

            {!!category.category_children?.length && (
              <>
                <div className="empty-space col-xs-b25 col-sm-b50"></div>
                <div className="h4 col-xs-b10">shop {category.name}</div>
                <ul className="categories-menu transparent">
                  {category.category_children.map((child) => (
                    <li key={child.id}>
                      <LocalizedClientLink
                        href={`/categories/${child.handle}`}
                      >
                        {child.name}
                      </LocalizedClientLink>
                    </li>
                  ))}
                </ul>
              </>
            )}

            <div className="empty-space col-xs-b25 col-sm-b50"></div>

            <div className="h4 col-xs-b25">Refine</div>
            <RefinementList sortBy={sort} data-testid="sort-by-container" />

            <div className="empty-space col-xs-b25 col-sm-b50"></div>

            <div className="tags light clearfix">
              <LocalizedClientLink
                className="tag"
                href={`/categories/${category.handle}`}
              >
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
  categoryId,
  countryCode,
  optionValueIds,
}: {
  sortBy?: SortOptions
  page: number
  categoryId: string
  countryCode: string
  optionValueIds?: OptionValueIds
}) {
  const queryParams: PaginatedProductsParams = {
    limit: 12,
  }

  if (categoryId) {
    queryParams["category_id"] = [categoryId]
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
        <div className="simple-article size-3">No products found.</div>
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

export default ExzoCategory
