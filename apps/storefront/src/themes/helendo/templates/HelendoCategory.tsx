import { notFound } from "next/navigation"
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
/* Helendo (furniture) renderer for the CATEGORY LISTING.               */
/* Same props + behavior as the Cignet/Learts CategoryTemplate —        */
/* reuses the stateful RefinementList + Pagination commerce components  */
/* and the EXACT data fetch (listProductsWithSort + getRegion),         */
/* filtered by category_id. Markup is Helendo's shop-left-sidebar.html: */
/* the breadcrumb-area carries the category title and parent trail; the */
/* sidebar highlights the active category and lists its children.       */
/* ------------------------------------------------------------------ */

const PRODUCT_LIMIT = 12
const PLACEHOLDER = "/helendo/images/product/single-product-01.jpg"

/* Breadcrumb strip from shop-left-sidebar.html (~lines 122-144). */
const HelendoBreadcrumb = ({
  title,
  trail,
  active,
}: {
  title: string
  trail?: { label: string; href: string }[]
  active: string
}) => (
  <div className="breadcrumb-area">
    <div className="container">
      <div className="row">
        <div className="col-12">
          <div className="row breadcrumb_box align-items-center">
            <div className="col-lg-6 col-md-6 col-sm-6 text-center text-sm-left">
              <h2
                className="breadcrumb-title"
                data-testid="category-page-title"
              >
                {title}
              </h2>
            </div>
            <div className="col-lg-6 col-md-6 col-sm-6">
              {/* breadcrumb-list start */}
              <ul className="breadcrumb-list text-center text-sm-right">
                <li className="breadcrumb-item">
                  <LocalizedClientLink href="/">Home</LocalizedClientLink>
                </li>
                {(trail ?? []).map((crumb) => (
                  <li key={crumb.href} className="breadcrumb-item">
                    <LocalizedClientLink
                      href={crumb.href}
                      data-testid="sort-by-link"
                    >
                      {crumb.label}
                    </LocalizedClientLink>
                  </li>
                ))}
                <li className="breadcrumb-item active">{active}</li>
              </ul>
              {/* breadcrumb-list end */}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
)

const HelendoCategory = ({
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
    <div className="helendo-theme" data-testid="category-container">
      <HelendoBreadcrumb
        title={category.name}
        trail={parents
          .slice()
          .reverse()
          .map((parent) => ({
            label: parent.name,
            href: `/categories/${parent.handle}`,
          }))}
        active={category.name}
      />

      <div id="main-wrapper">
        <div className="site-wrapper-reveal border-bottom">
          {/* Product Area Start */}
          <div className="product-wrapper section-space--ptb_120">
            <div className="container">
              <div className="row">
                <div className="col-lg-3 col-md-3 order-md-1 order-2 small-mt__40">
                  <HelendoCategorySidebar activeCategoryId={category.id} />

                  {!!category.category_children?.length && (
                    <div className="shop-widget widget-shop-categories">
                      <div className="product-filter">
                        <h6 className="mb-20">Shop {category.name}</h6>
                        <ul className="widget-nav-list">
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
                  )}

                  {/* Product Filter */}
                  <div className="shop-widget">
                    <div className="product-filter">
                      <h6 className="mb-20">Refine</h6>
                      <RefinementList
                        sortBy={sort}
                        data-testid="sort-by-container"
                      />
                    </div>
                  </div>
                </div>

                <div className="col-lg-9 col-md-9 order-md-2 order-1">
                  {category.description && (
                    <div className="shop-toolbar__items shop-toolbar__item--left">
                      <p className="result-count">{category.description}</p>
                    </div>
                  )}

                  <Suspense
                    fallback={
                      <SkeletonProductGrid
                        numberOfProducts={category.products?.length ?? 8}
                      />
                    }
                  >
                    <HelendoPaginatedProducts
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
          {/* Product Area End */}
        </div>
      </div>
    </div>
  )
}

/* Sidebar "Categories" widget — REAL top-level categories via the same
 * listCategories helper, highlighting the active category. Never throws:
 * a failed fetch or an empty catalog renders nothing. */
async function HelendoCategorySidebar({
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
    <div className="shop-widget widget-shop-categories">
      <div className="product-filter">
        <h6 className="mb-20">Categories</h6>
        <ul className="widget-nav-list">
          {topLevel.map((category) => (
            <li key={category.id}>
              <LocalizedClientLink
                href={`/categories/${category.handle}`}
                style={
                  category.id === activeCategoryId
                    ? { color: "#dcb14a", fontWeight: 500 }
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

async function HelendoPaginatedProducts({
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

  const from = (page - 1) * PRODUCT_LIMIT + 1
  const to = Math.min(page * PRODUCT_LIMIT, count)

  return (
    <>
      {/* Shop toolbar (shop-left-sidebar.html) — result count + page info. */}
      <div className="row">
        <div className="col-lg-6 col-md-8">
          <div className="shop-toolbar__items shop-toolbar__item--left">
            <div className="shop-toolbar__item shop-toolbar__item--result">
              <p className="result-count">
                Showing {from}&ndash;{to} of {count}
              </p>
            </div>
          </div>
        </div>
        {totalPages > 1 && (
          <div className="col-lg-6 col-md-4">
            <div className="shop-toolbar__items shop-toolbar__item--right">
              <div className="shop-toolbar__item">
                <p className="result-count">
                  Page {page} of {totalPages}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="tab-content">
        <div className="tab-pane fade show active" id="tab_columns_01">
          <div className="row" data-testid="products-list">
            {products.map((p) => (
              <div key={p.id} className="col-lg-4 col-md-4 col-sm-6">
                <HelendoProductCard product={p} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="text-center mt-40">
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

const HelendoProductCard = ({
  product,
}: {
  product: HttpTypes.StoreProduct
}) => {
  const { cheapestPrice } = getProductPrice({ product })

  const mainImage = product.thumbnail || product.images?.[0]?.url || PLACEHOLDER

  const onSale =
    cheapestPrice?.price_type === "sale" ||
    (!!cheapestPrice &&
      cheapestPrice.original_price !== cheapestPrice.calculated_price)

  const href = `/products/${product.handle}`

  return (
    /* Single Product Item Start */
    <div className="single-product-item text-center">
      <div className="products-images">
        <LocalizedClientLink href={href} className="product-thumbnail">
          <img src={mainImage} className="img-fluid" alt={product.title} />
          {onSale && <span className="ribbon onsale">Sale</span>}
        </LocalizedClientLink>
      </div>
      <div className="product-content">
        <h6 className="prodect-title">
          <LocalizedClientLink href={href}>{product.title}</LocalizedClientLink>
        </h6>
        <div className="prodect-price">
          <span className="new-price">
            {cheapestPrice?.calculated_price ?? ""}
          </span>
          {onSale && cheapestPrice ? (
            <>
              {" "}
              <span className="old-price">{cheapestPrice.original_price}</span>
            </>
          ) : null}
        </div>
      </div>
    </div>
    /* Single Product Item End */
  )
}

export default HelendoCategory
