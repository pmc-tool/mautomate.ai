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

import { ShofyCategorySidebar, ShofyProductCard } from "./ShofyStore"

/* ------------------------------------------------------------------ */
/* Shofy (multipurpose) renderer for the CATEGORY LISTING.             */
/* Same props + behavior as the Learts/Cignet CategoryTemplate —        */
/* reuses the stateful RefinementList + Pagination commerce components  */
/* and the EXACT data fetch (listProductsWithSort + getRegion),         */
/* filtered by category_id. Markup is Shofy's shop.html: the            */
/* breadcrumb__area carries the category title, description and a       */
/* breadcrumb including parent categories; the sidebar highlights the   */
/* active category and lists its children. Grid/sidebar markup is       */
/* shared with ShofyStore (ShofyProductCard + ShofyCategorySidebar).    */
/* ------------------------------------------------------------------ */

const PRODUCT_LIMIT = 12

const ShofyCategory = ({
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
    <div className="shofy-theme" data-testid="category-container">
      {/* breadcrumb area start */}
      <section className="breadcrumb__area include-bg pt-100 pb-50">
        <div className="container">
          <div className="row">
            <div className="col-xxl-12">
              <div className="breadcrumb__content p-relative z-index-1">
                <h3
                  className="breadcrumb__title"
                  data-testid="category-page-title"
                >
                  {category.name}
                </h3>
                <div className="breadcrumb__list" aria-label="Breadcrumb">
                  <span>
                    <LocalizedClientLink href="/">Home</LocalizedClientLink>
                  </span>
                  {parents
                    .slice()
                    .reverse()
                    .map((parent) => (
                      <span key={parent.id}>
                        <LocalizedClientLink
                          href={`/categories/${parent.handle}`}
                          data-testid="sort-by-link"
                        >
                          {parent.name}
                        </LocalizedClientLink>
                      </span>
                    ))}
                  <span>{category.name}</span>
                </div>
                {category.description && (
                  <p style={{ maxWidth: "620px", margin: "15px 0 0" }}>
                    {category.description}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* breadcrumb area end */}

      {/* shop area start */}
      <section className="tp-shop-area pb-120">
        <div className="container">
          <div className="row">
            <div className="col-xl-3 col-lg-4">
              <div className="tp-shop-sidebar mr-10">
                {/* filter header */}
                <div className="tp-shop-widget mb-35">
                  <h3 className="tp-shop-widget-title no-border">Filter By</h3>
                  <div className="tp-shop-widget-content">
                    <LocalizedClientLink
                      href={`/categories/${category.handle}`}
                    >
                      Clear All
                    </LocalizedClientLink>
                  </div>
                </div>

                {/* categories */}
                <ShofyCategorySidebar activeCategoryId={category.id} />

                {/* child categories */}
                {!!category.category_children?.length && (
                  <div className="tp-shop-widget mb-50">
                    <h3 className="tp-shop-widget-title">
                      Shop {category.name}
                    </h3>
                    <div className="tp-shop-widget-content">
                      <div className="tp-shop-widget-categories">
                        <ul>
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
                      </div>
                    </div>
                  </div>
                )}

                {/* refine */}
                <div className="tp-shop-widget mb-50">
                  <h3 className="tp-shop-widget-title">Refine</h3>
                  <div className="tp-shop-widget-content">
                    <RefinementList
                      sortBy={sort}
                      data-testid="sort-by-container"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="col-xl-9 col-lg-8">
              <div className="tp-shop-main-wrapper">
                <Suspense
                  fallback={
                    <SkeletonProductGrid
                      numberOfProducts={category.products?.length ?? 8}
                    />
                  }
                >
                  <ShofyPaginatedProducts
                    sortBy={sort}
                    page={pageNumber}
                    categoryId={category.id}
                    countryCode={countryCode}
                    optionValueIds={optionValueIds}
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
        <p>No products found.</p>
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

export default ShofyCategory
