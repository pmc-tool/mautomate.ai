import { notFound } from "next/navigation"
import { Fragment, Suspense } from "react"

import { HttpTypes } from "@medusajs/types"

import { listProductsWithSort } from "@lib/data/products"
import { getRegion } from "@lib/data/regions"
import { OptionValueIds } from "@lib/util/product-option-filters"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import SkeletonProductGrid from "@modules/skeletons/templates/skeleton-product-grid"
import { Pagination } from "@modules/store/components/pagination"
import RefinementList from "@modules/store/components/refinement-list"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"

import { BazaroCategorySidebar, BazaroProductCard } from "./BazaroStore"

/* ------------------------------------------------------------------ */
/* Bazaro (fashion) renderer for the CATEGORY LISTING. Same props +     */
/* behavior as the Learts/Cignet CategoryTemplate — reuses the stateful */
/* RefinementList + Pagination commerce components and the EXACT data   */
/* fetch (listProductsWithSort + getRegion), filtered by category_id.   */
/* Markup is the template's product-default.html: the aq-breadcrumb     */
/* header carries the category title, description and a breadcrumb      */
/* including parent categories; the aq-product-sidebar highlights the   */
/* active category and lists its children; the grid + product cards are */
/* shared with BazaroStore.                                             */
/* ------------------------------------------------------------------ */

const PRODUCT_LIMIT = 12

const BazaroCategory = ({
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
    <div className="bazaro-theme" data-testid="category-container">
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
                  <span>
                    <LocalizedClientLink href="/store">
                      shop
                    </LocalizedClientLink>
                  </span>
                  {parents
                    .slice()
                    .reverse()
                    .map((parent) => (
                      <Fragment key={parent.id}>
                        <span>/</span>
                        <span>
                          <LocalizedClientLink
                            href={`/categories/${parent.handle}`}
                            data-testid="sort-by-link"
                          >
                            {parent.name}
                          </LocalizedClientLink>
                        </span>
                      </Fragment>
                    ))}
                  <span>/</span>
                  <span>{category.name}</span>
                </div>
                <div className="aq-breadcrumb-content">
                  <h2
                    className="aq-breadcrumb-title"
                    data-testid="category-page-title"
                  >
                    {category.name}
                  </h2>
                  {category.description && <p>{category.description}</p>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* aq breadcrumb area end */}

      {/* aq product area start */}
      <div className="aq-product-area pt-60 pb-80">
        <div className="container">
          <div className="row">
            <div className="col-xl-12">
              <div className="aq-product-wrap">
                <div className="row gx-50">
                  <div className="col-xl-3 order-xl-1 order-2">
                    <div className="aq-product-sidebar mb-40">
                      <div className="aq-product-sidebar-wrap">
                        {/* categories */}
                        <BazaroCategorySidebar activeCategoryId={category.id} />

                        {/* children */}
                        {!!category.category_children?.length && (
                          <div className="aq-product-sidebar-widget mb-25">
                            <div className="aq-product-sidebar-widget-top">
                              <h3 className="aq-product-sidebar-widget-title">
                                Shop {category.name}
                              </h3>
                            </div>
                            <div className="aq-product-sidebar-widget-content">
                              <div className="aq-product-sidebar-widget-categories">
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
                        <div className="aq-product-sidebar-widget mb-25">
                          <div className="aq-product-sidebar-widget-top">
                            <h3 className="aq-product-sidebar-widget-title">
                              Refine
                            </h3>
                          </div>
                          <div className="aq-product-sidebar-widget-content">
                            <RefinementList
                              sortBy={sort}
                              data-testid="sort-by-container"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="col-xl-9 order-xl-2 order-1">
                    <Suspense
                      fallback={
                        <SkeletonProductGrid
                          numberOfProducts={category.products?.length ?? 8}
                        />
                      }
                    >
                      <BazaroPaginatedProducts
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
          </div>
        </div>
      </div>
      {/* aq product area end */}
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
        <div className="aq-grid-layout aq-col-4" data-testid="products-list">
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

export default BazaroCategory
