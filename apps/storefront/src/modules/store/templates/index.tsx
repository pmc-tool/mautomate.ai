import { Suspense } from "react"

import { OptionValueIds } from "@lib/util/product-option-filters"
import SkeletonProductGrid from "@modules/skeletons/templates/skeleton-product-grid"
import StoreFilters from "@modules/store/components/store-filters"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"

import PaginatedProducts from "./paginated-products"

const StoreTemplate = ({
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
    <div className="learts-theme section section-fluid section-padding bg-white">
      <div className="container">
        <div className="section-title text-center">
          {query ? (
            <>
              <h3 className="sub-title">Search results</h3>
              <h2 className="title title-icon-both">&ldquo;{query}&rdquo;</h2>
            </>
          ) : (
            <h2 className="title title-icon-both">All products</h2>
          )}
        </div>
        <div
          className="flex flex-col small:flex-row small:items-start"
          data-testid="category-container"
        >
          <StoreFilters sortBy={sort} />
          <div className="w-full">
            <Suspense fallback={<SkeletonProductGrid />}>
              <PaginatedProducts
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

export default StoreTemplate
