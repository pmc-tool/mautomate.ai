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
/* Cignet (jewellery) renderer for the CATEGORY LISTING.               */
/* Same props + behavior as the Learts/Aurora CategoryTemplate —        */
/* reuses the stateful RefinementList + Pagination commerce components  */
/* and the EXACT data fetch (listProductsWithSort + getRegion),         */
/* filtered by category_id. Markup is Cignet's products.html: the       */
/* page-header carries the category title, description and a            */
/* breadcrumb including parent categories; the sidebar highlights the   */
/* active category and lists its children.                              */
/* ------------------------------------------------------------------ */

const PRODUCT_LIMIT = 12
const PLACEHOLDER = "/cignet/images/product-image-1.png"
const PAGE_HEADER_BG = "/cignet/images/page-header-bg-image.jpg"

const CignetCategory = ({
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
    <div className="cignet-theme" data-testid="category-container">
      {/* Page Header Start */}
      <div
        className="page-header dark-section"
        style={{
          backgroundImage: `url(${PAGE_HEADER_BG})`,
          backgroundPosition: "center center",
          backgroundRepeat: "no-repeat",
          backgroundSize: "cover",
        }}
      >
        <div className="container">
          <div className="row">
            <div className="col-lg-12">
              {/* Page Header Box Start */}
              <div className="page-header-box">
                <h1 data-testid="category-page-title">{category.name}</h1>
                <nav className="wow fadeInUp" aria-label="Breadcrumb">
                  <ol className="breadcrumb">
                    <li className="breadcrumb-item">
                      <LocalizedClientLink href="/">home</LocalizedClientLink>
                    </li>
                    {parents
                      .slice()
                      .reverse()
                      .map((parent) => (
                        <li key={parent.id} className="breadcrumb-item">
                          <LocalizedClientLink
                            href={`/categories/${parent.handle}`}
                            data-testid="sort-by-link"
                          >
                            {parent.name}
                          </LocalizedClientLink>
                        </li>
                      ))}
                    <li className="breadcrumb-item active" aria-current="page">
                      {category.name}
                    </li>
                  </ol>
                </nav>
                {category.description && (
                  <p
                    style={{
                      color: "var(--white-color)",
                      maxWidth: "620px",
                      margin: "15px 0 0",
                    }}
                  >
                    {category.description}
                  </p>
                )}
              </div>
              {/* Page Header Box End */}
            </div>
          </div>
        </div>
      </div>
      {/* Page Header End */}

      {/* Page Products Section Start */}
      <div className="page-products">
        <div className="container">
          <div className="row">
            <div className="col-xl-3 col-lg-4">
              {/* Page Single Sidebar Start */}
              <div className="page-single-sidebar">
                <div className="product-category-filter-header wow fadeInUp">
                  <div className="product-category-filter-title">
                    <img src="/cignet/images/icon-filter.svg" alt="" />
                    <h2>Filter By</h2>
                  </div>
                  <div className="product-category-filter-clear-btn">
                    <LocalizedClientLink
                      href={`/categories/${category.handle}`}
                    >
                      Clear All
                    </LocalizedClientLink>
                  </div>
                </div>

                <div className="product-category-item-list">
                  <CignetCategorySidebar activeCategoryId={category.id} />

                  {!!category.category_children?.length && (
                    <div className="product-category-item wow fadeInUp">
                      <h2 className="product-category-item-title">
                        Shop {category.name}
                      </h2>
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
                  )}

                  <div className="product-category-item wow fadeInUp">
                    <h2 className="product-category-item-title">Refine</h2>
                    <RefinementList
                      sortBy={sort}
                      data-testid="sort-by-container"
                    />
                  </div>
                </div>
              </div>
              {/* Page Single Sidebar End */}
            </div>

            <div className="col-xl-9 col-lg-8">
              {/* Product item List Box Start */}
              <div className="product-item-list-box">
                <Suspense
                  fallback={
                    <SkeletonProductGrid
                      numberOfProducts={category.products?.length ?? 8}
                    />
                  }
                >
                  <CignetPaginatedProducts
                    sortBy={sort}
                    page={pageNumber}
                    categoryId={category.id}
                    countryCode={countryCode}
                    optionValueIds={optionValueIds}
                  />
                </Suspense>
              </div>
              {/* Product item List Box End */}
            </div>
          </div>
        </div>
      </div>
      {/* Page Products Section End */}
    </div>
  )
}

/* Sidebar "Categories" block — REAL top-level categories via the same
 * listCategories helper Aurora uses, highlighting the active category.
 * Never throws: a failed fetch or an empty catalog renders nothing. */
async function CignetCategorySidebar({
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
    <div className="product-category-item wow fadeInUp">
      <h2 className="product-category-item-title">Categories</h2>
      <ul>
        {topLevel.map((category) => (
          <li key={category.id}>
            <LocalizedClientLink
              href={`/categories/${category.handle}`}
              style={
                category.id === activeCategoryId
                  ? { color: "var(--primary-color)", fontWeight: 600 }
                  : undefined
              }
            >
              {category.name}
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

async function CignetPaginatedProducts({
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
      {/* Product Category Filter Header Start */}
      <div className="product-category-filter-header wow fadeInUp">
        <div className="product-category-filter-title">
          <h2>
            Showing {count} {count === 1 ? "result" : "results"}
          </h2>
        </div>
        {totalPages > 1 && (
          <div className="product-category-result-info">
            <div className="product-category-result-pagination">
              <ul>
                <li>Page {page}</li>
                <li>{totalPages}</li>
              </ul>
            </div>
          </div>
        )}
      </div>
      {/* Product Category Filter Header End */}

      {/* Product item List Start */}
      <div className="product-item-list" data-testid="products-list">
        {products.map((p) => (
          <CignetProductCard key={p.id} product={p} />
        ))}
      </div>
      {/* Product item List End */}

      {totalPages > 1 && (
        <div className="product-learn-more-btn wow fadeInUp">
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

const CignetProductCard = ({
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
    <div className="product-item wow fadeInUp">
      {/* Product Item Header Start */}
      <div className="product-item-header">
        <div className="product-item-image">
          <LocalizedClientLink href={href}>
            <figure>
              <img src={mainImage} alt={product.title} />
            </figure>
          </LocalizedClientLink>
        </div>

        <div className="product-item-action">
          <ul>
            <li>
              <LocalizedClientLink href={href} aria-label="View product">
                <img
                  src="/cignet/images/icon-preview-primary.svg"
                  alt="View product"
                />
              </LocalizedClientLink>
            </li>
            <li>
              <LocalizedClientLink href={href} aria-label="Shop product">
                <img
                  src="/cignet/images/icon-cart-primary.svg"
                  alt="Shop product"
                />
              </LocalizedClientLink>
            </li>
          </ul>
        </div>
      </div>
      {/* Product Item Header End */}

      {/* Product Item Body Start */}
      <div className="product-item-body">
        <div className="product-item-content">
          <h2 className="product-item-title">
            <LocalizedClientLink href={href}>
              {product.title}
            </LocalizedClientLink>
          </h2>
        </div>

        <div className="product-item-price">
          <h3>
            {cheapestPrice?.calculated_price ?? ""}
            {onSale && cheapestPrice ? (
              <span>{cheapestPrice.original_price}</span>
            ) : null}
          </h3>
        </div>
      </div>
      {/* Product Item Body End */}
    </div>
  )
}

export default CignetCategory
