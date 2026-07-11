import { HttpTypes } from "@medusajs/types"

import { getProductPrice } from "@lib/util/get-product-price"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ------------------------------------------------------------------ */
/* Aurora PRESENTATIONAL view for the product_tabs block. Pure, client-  */
/* safe (no data fetching, no server-only imports) — it takes the        */
/* already-resolved per-tab `groups` as props and renders the Aurora     */
/* minimalist product sections. Rendered BYTE-IDENTICALLY by both the     */
/* live async server block (ProductTabs.tsx) and the visual-editor        */
/* canvas (which fetches the same groups from /api/puck/product-tab-      */
/* groups), so the editor preview matches the storefront.                */
/*                                                                      */
/* Data mapping mirrors the original Learts switcher's three slots        */
/* (new / sale / best): the first three configured tabs map onto them,    */
/* and the sale slot falls back to the new-arrivals products when it has  */
/* none of its own.                                                      */
/* ------------------------------------------------------------------ */

interface ProductTabGroup {
  label: string
  products: HttpTypes.StoreProduct[]
}

export interface ProductTabsViewProps {
  /** Per-tab resolved products, aligned 1:1 with the block's tabs. */
  groups: ProductTabGroup[]
}

const PLACEHOLDER = "/learts/assets/images/product/s328/product-1.webp"

/** Minimal Aurora product card — image, title, price. */
const ProductCard = ({ product }: { product: HttpTypes.StoreProduct }) => {
  const { cheapestPrice } = getProductPrice({ product })

  const images = product.images ?? []
  const mainImage = product.thumbnail || images[0]?.url || PLACEHOLDER

  const onSale =
    cheapestPrice?.price_type === "sale" ||
    (!!cheapestPrice &&
      cheapestPrice.original_price !== cheapestPrice.calculated_price)

  const href = `/products/${product.handle}`

  return (
    <LocalizedClientLink
      href={href}
      className="group flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition hover:shadow-md"
    >
      <div className="relative aspect-square overflow-hidden bg-neutral-50">
        {onSale && cheapestPrice?.percentage_diff ? (
          <span
            className="absolute left-3 top-3 z-10 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium text-white"
            style={{ backgroundColor: "var(--aurora-accent)" }}
          >
            -{cheapestPrice.percentage_diff}%
          </span>
        ) : null}
        <img
          src={mainImage}
          alt={product.title}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="text-sm font-medium tracking-tight text-neutral-900 line-clamp-2">
          {product.title}
        </h3>
        <div className="mt-auto flex items-baseline gap-2">
          {onSale && cheapestPrice ? (
            <>
              <span className="text-sm font-semibold text-neutral-900">
                {cheapestPrice.calculated_price}
              </span>
              <span className="text-xs text-neutral-400 line-through">
                {cheapestPrice.original_price}
              </span>
            </>
          ) : (
            <span className="text-sm font-semibold text-neutral-900">
              {cheapestPrice?.calculated_price ?? ""}
            </span>
          )}
        </div>
      </div>
    </LocalizedClientLink>
  )
}

const ProductGroup = ({
  label,
  products,
}: {
  label: string
  products: HttpTypes.StoreProduct[]
}) => {
  if (!products.length) {
    return null
  }

  return (
    <div className="mt-16 first:mt-0">
      <div className="mb-8 flex items-end justify-between border-b border-neutral-200 pb-4">
        <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-neutral-900">
          {label}
        </h2>
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">
          {products.length} item{products.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </div>
  )
}

const ProductTabsView = (props: ProductTabsViewProps) => {
  const g = Array.isArray(props.groups) ? props.groups : []
  const newArrivals = g[0]?.products ?? []
  const saleItems = g[1]?.products ?? []
  const bestSellers = g[2]?.products ?? []

  if (!newArrivals.length && !saleItems.length && !bestSellers.length) {
    return null
  }

  // Same data mapping as the Learts switcher: the sale slot falls back to the
  // new-arrivals products when it has none of its own.
  const groups = [
    { label: "New arrivals", products: newArrivals },
    { label: "Sale items", products: saleItems.length ? saleItems : newArrivals },
    { label: "Best sellers", products: bestSellers },
  ]

  return (
    <section className="aurora-theme bg-white py-16 md:py-24 font-sans">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {groups.map((g) => (
          <ProductGroup key={g.label} label={g.label} products={g.products} />
        ))}
      </div>
    </section>
  )
}

export default ProductTabsView
