import { Suspense } from "react"

import { HttpTypes } from "@medusajs/types"

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
/* Aurora (modern minimalist) renderer for the STORE LISTING (PLP).    */
/* Same props + behavior as the Learts StoreTemplate — reuses the      */
/* stateful RefinementList + Pagination commerce components and the     */
/* EXACT data fetch (listProductsWithSort + getRegion). Only the        */
/* layout, markup and styling are re-skinned with pure Tailwind.        */
/* ------------------------------------------------------------------ */

const PRODUCT_LIMIT = 12
const PLACEHOLDER = "/learts/assets/images/product/s328/product-1.webp"

const AuroraStore = ({
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
    <div className="aurora-theme bg-white text-neutral-900">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 md:py-16 lg:px-8">
        <header className="mb-10">
          {query ? (
            <>
              <p className="text-sm font-medium uppercase tracking-wide text-neutral-500">
                Search results
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
                &ldquo;{query}&rdquo;
              </h1>
            </>
          ) : (
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
              All products
            </h1>
          )}
        </header>

        <div
          className="flex flex-col gap-8 md:flex-row md:items-start"
          data-testid="category-container"
        >
          <RefinementList sortBy={sort} />
          <div className="w-full">
            <Suspense fallback={<SkeletonProductGrid />}>
              <AuroraPaginatedProducts
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

async function AuroraPaginatedProducts({
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
      <div className="aurora-theme" data-testid="products-list">
        <p className="py-10 text-neutral-500">
          {query
            ? `No products found for “${query}”.`
            : "No products found."}
        </p>
      </div>
    )
  }

  return (
    <div className="aurora-theme">
      <div
        className="grid grid-cols-2 gap-6 md:grid-cols-3 xl:grid-cols-4"
        data-testid="products-list"
      >
        {products.map((p) => (
          <AuroraProductCard key={p.id} product={p} />
        ))}
      </div>
      {totalPages > 1 && (
        <div className="mt-12">
          <Pagination
            data-testid="product-pagination"
            page={page}
            totalPages={totalPages}
          />
        </div>
      )}
    </div>
  )
}

const AuroraProductCard = ({
  product,
}: {
  product: HttpTypes.StoreProduct
}) => {
  const { cheapestPrice } = getProductPrice({ product })

  const images = product.images ?? []
  const mainImage = product.thumbnail || images[0]?.url || PLACEHOLDER
  const hoverImage = images[1]?.url || images[0]?.url || mainImage

  const onSale =
    cheapestPrice?.price_type === "sale" ||
    (!!cheapestPrice &&
      cheapestPrice.original_price !== cheapestPrice.calculated_price)

  const href = `/products/${product.handle}`

  return (
    <LocalizedClientLink
      href={href}
      className="group block overflow-hidden rounded-2xl border border-neutral-200 bg-white transition hover:shadow-md"
    >
      <div className="relative aspect-square overflow-hidden bg-neutral-50">
        {onSale && cheapestPrice?.percentage_diff ? (
          <span
            className="absolute left-3 top-3 z-10 rounded-full px-2.5 py-1 text-xs font-medium text-white"
            style={{ backgroundColor: "var(--aurora-accent)" }}
          >
            -{cheapestPrice.percentage_diff}%
          </span>
        ) : null}
        <img
          src={mainImage}
          alt={product.title}
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-300 group-hover:opacity-0"
        />
        <img
          src={hoverImage}
          alt={product.title}
          className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        />
      </div>
      <div className="p-4">
        <h3 className="truncate text-sm font-medium text-neutral-900">
          {product.title}
        </h3>
        <div className="mt-2 text-sm">
          {onSale && cheapestPrice ? (
            <span className="flex items-center gap-2">
              <span className="text-neutral-400 line-through">
                {cheapestPrice.original_price}
              </span>
              <span
                className="font-semibold"
                style={{ color: "var(--aurora-accent)" }}
              >
                {cheapestPrice.calculated_price}
              </span>
            </span>
          ) : (
            <span className="font-semibold text-neutral-900">
              {cheapestPrice?.calculated_price ?? ""}
            </span>
          )}
        </div>
      </div>
    </LocalizedClientLink>
  )
}

export default AuroraStore
