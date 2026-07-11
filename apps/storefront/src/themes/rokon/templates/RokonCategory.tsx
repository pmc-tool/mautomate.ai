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

import { RokonCategorySidebar, RokonProductCard } from "./RokonStore"

/* ------------------------------------------------------------------ */
/* Rokon renderer for the CATEGORY LISTING.                             */
/* Same props + behavior as the Learts/Cignet CategoryTemplate —        */
/* reuses the stateful RefinementList + Pagination commerce components  */
/* and the EXACT data fetch (listProductsWithSort + getRegion),         */
/* filtered by category_id. Markup is Rokon's shop.html: the            */
/* breadcrumb__section carries the category title and a breadcrumb      */
/* including parent categories; the widget__area sidebar highlights the */
/* active category and lists its children.                              */
/* ------------------------------------------------------------------ */

const PRODUCT_LIMIT = 12

const RokonCategory = ({
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
    <div className="rokon-theme" data-testid="category-container">
      {/* Start breadcrumb section */}
      <section className="breadcrumb__section breadcrumb__bg">
        <div className="container">
          <div className="row row-cols-1">
            <div className="col">
              <div className="breadcrumb__content">
                <h1
                  className="breadcrumb__content--title mb-10"
                  data-testid="category-page-title"
                >
                  {category.name}
                </h1>
                <ul className="breadcrumb__content--menu d-flex">
                  <li className="breadcrumb__content--menu__items">
                    <LocalizedClientLink href="/">Home</LocalizedClientLink>
                  </li>
                  {parents
                    .slice()
                    .reverse()
                    .map((parent) => (
                      <li
                        key={parent.id}
                        className="breadcrumb__content--menu__items"
                      >
                        <LocalizedClientLink
                          href={`/categories/${parent.handle}`}
                          data-testid="sort-by-link"
                        >
                          {parent.name}
                        </LocalizedClientLink>
                      </li>
                    ))}
                  <li className="breadcrumb__content--menu__items">
                    <span className="text__secondary">{category.name}</span>
                  </li>
                </ul>
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
      {/* End breadcrumb section */}

      {/* Start shop section */}
      <section className="shop__section section--padding">
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
                        href={`/categories/${category.handle}`}
                      >
                        Clear All
                      </LocalizedClientLink>
                    </li>
                  </ul>
                </div>

                <RokonCategorySidebar activeCategoryId={category.id} />

                {!!category.category_children?.length && (
                  <div className="single__widget widget__bg">
                    <h2 className="widget__title position__relative h3">
                      Shop {category.name}
                    </h2>
                    <ul className="widget__categories--menu">
                      {category.category_children.map((child) => (
                        <li
                          key={child.id}
                          className="widget__categories--menu__list"
                        >
                          <LocalizedClientLink
                            className="widget__categories--menu__label d-flex align-items-center"
                            href={`/categories/${child.handle}`}
                          >
                            <span className="widget__categories--menu__text">
                              {child.name}
                            </span>
                          </LocalizedClientLink>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="single__widget widget__bg">
                  <h2 className="widget__title position__relative h3">
                    Refine
                  </h2>
                  <RefinementList sortBy={sort} data-testid="sort-by-container" />
                </div>
              </div>
            </div>

            <div className="col-xl-9 col-lg-8">
              <div className="shop__product--wrapper">
                <Suspense
                  fallback={
                    <SkeletonProductGrid
                      numberOfProducts={category.products?.length ?? 8}
                    />
                  }
                >
                  <RokonPaginatedProducts
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
      {/* End shop section */}
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

export default RokonCategory
