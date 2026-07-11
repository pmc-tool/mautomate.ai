import { notFound } from "next/navigation"
import { Suspense } from "react"

import SkeletonProductGrid from "@modules/skeletons/templates/skeleton-product-grid"
import StoreFilters from "@modules/store/components/store-filters"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import PaginatedProducts from "@modules/store/templates/paginated-products"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { HttpTypes } from "@medusajs/types"
import { OptionValueIds } from "@lib/util/product-option-filters"

export default function CategoryTemplate({
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
}) {
  const pageNumber = page ? parseInt(page) : 1
  const sort = sortBy || "created_at"

  if (!category || !countryCode) notFound()

  const parents = [] as HttpTypes.StoreProductCategory[]

  const getParents = (category: HttpTypes.StoreProductCategory) => {
    if (category.parent_category) {
      parents.push(category.parent_category)
      getParents(category.parent_category)
    }
  }

  getParents(category)

  return (
    <div
      className="learts-theme section section-fluid section-padding bg-white"
      data-testid="category-container"
    >
      <div className="container">
        {/* Breadcrumb */}
        <div
          className="text-center"
          style={{
            fontSize: 13,
            letterSpacing: "0.04em",
            color: "#999",
            marginBottom: 8,
          }}
        >
          <LocalizedClientLink href="/" style={{ color: "#999" }}>
            Home
          </LocalizedClientLink>
          <span> / </span>
          {parents
            .slice()
            .reverse()
            .map((parent) => (
              <span key={parent.id}>
                <LocalizedClientLink
                  href={`/categories/${parent.handle}`}
                  style={{ color: "#999" }}
                  data-testid="sort-by-link"
                >
                  {parent.name}
                </LocalizedClientLink>
                <span> / </span>
              </span>
            ))}
          <span style={{ color: "#333" }}>{category.name}</span>
        </div>

        {/* Section title */}
        <div className="section-title text-center">
          <h2
            className="title title-icon-both"
            data-testid="category-page-title"
          >
            {category.name}
          </h2>
        </div>

        {category.description && (
          <div
            className="text-center"
            style={{ maxWidth: 680, margin: "0 auto 30px", color: "#777" }}
          >
            <p>{category.description}</p>
          </div>
        )}

        {/* Sub-categories as pills */}
        {!!category.category_children?.length && (
          <div
            className="text-center"
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              justifyContent: "center",
              marginBottom: 36,
            }}
          >
            {category.category_children.map((c) => (
              <LocalizedClientLink
                key={c.id}
                href={`/categories/${c.handle}`}
                style={{
                  border: "1px solid #e5e5e5",
                  borderRadius: 30,
                  padding: "7px 20px",
                  fontSize: 14,
                  color: "#333",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                {c.name}
              </LocalizedClientLink>
            ))}
          </div>
        )}

        {/* Sidebar + grid */}
        <div className="flex flex-col small:flex-row small:items-start">
          <StoreFilters
            sortBy={sort}
            data-testid="sort-by-container"
            hideOptionsPicker
          />
          <div className="w-full">
            <Suspense
              fallback={
                <SkeletonProductGrid
                  numberOfProducts={category.products?.length ?? 8}
                />
              }
            >
              <PaginatedProducts
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
  )
}
