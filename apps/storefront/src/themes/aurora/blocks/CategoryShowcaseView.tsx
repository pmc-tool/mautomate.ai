import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ------------------------------------------------------------------ */
/* Aurora PRESENTATIONAL view for the category_showcase block. Pure,     */
/* client-safe (no data fetching, no server-only imports) — it takes the */
/* already-resolved `tiles` as props and renders the Aurora minimalist   */
/* category grid. Rendered BYTE-IDENTICALLY by both the live async server */
/* block (CategoryShowcase.tsx) and the visual-editor canvas (which       */
/* fetches the same tiles from /api/puck/category-tiles).                */
/* ------------------------------------------------------------------ */

interface CategoryTile {
  index: number
  label: string
  image: string
  href: string
  count?: number
}

export interface CategoryShowcaseViewProps {
  sub_title?: string
  title?: string
  tiles: CategoryTile[]
  sectionScope?: string
}

const FALLBACK_IMAGES = [
  "/learts/assets/images/banner/category/banner-s5-1.webp",
  "/learts/assets/images/banner/category/banner-s5-2.webp",
  "/learts/assets/images/banner/category/banner-s5-3.webp",
  "/learts/assets/images/banner/category/banner-s5-4.webp",
  "/learts/assets/images/banner/category/banner-s5-5.webp",
]

const CategoryShowcaseView = (props: CategoryShowcaseViewProps) => {
  const { sub_title, title } = props
  const tiles = Array.isArray(props.tiles) ? props.tiles : []

  if (tiles.length === 0) {
    return null
  }

  return (
    <section className="aurora-theme font-sans bg-white py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-10 md:mb-14 max-w-2xl">
          {sub_title ? (
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">
              {sub_title}
            </p>
          ) : null}
          {title ? (
            <h2 data-el="title" className="mt-3 text-3xl md:text-4xl font-semibold tracking-tight text-neutral-900">
              {title}
            </h2>
          ) : null}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          {tiles.map((tile, i) => (
            <LocalizedClientLink
              href={tile.href}
              data-el="tile"
              data-el-item={`items:${tile.index}`}
              key={i}
              className="group block overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition hover:shadow-md"
            >
              <div className="aspect-[4/5] overflow-hidden bg-neutral-100">
                <img
                  src={tile.image || FALLBACK_IMAGES[i % FALLBACK_IMAGES.length]}
                  alt={tile.label}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                />
              </div>
              <div className="flex items-center justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-medium text-neutral-900">
                    {tile.label}
                  </h3>
                  {typeof tile.count === "number" ? (
                    <p className="mt-0.5 text-xs text-neutral-500">
                      {tile.count} Items
                    </p>
                  ) : null}
                </div>
                <span
                  className="shrink-0 transition-transform group-hover:translate-x-0.5"
                  style={{ color: "var(--aurora-accent)" }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="h-4 w-4"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
                    />
                  </svg>
                </span>
              </div>
            </LocalizedClientLink>
          ))}
        </div>
      </div>
    </section>
  )
}

export default CategoryShowcaseView
