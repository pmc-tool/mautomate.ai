import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ------------------------------------------------------------------ */
/* Compiled block data (mirrors backend brand_strip resolved schema).  */
/* Received as the spread prop bag from the storefront SectionRenderer */
/* (`<BrandStrip {...block} />`), so it also carries block_type /       */
/* schema_version which we simply ignore.                              */
/* `title` is OPTIONAL (absent / empty => heading not rendered).        */
/* `brands` is always an array (may be empty). Each image field holds   */
/* a fully-resolved media URL (absolute backend urls or /learts paths   */
/* both work in <img>).                                                 */
/* ------------------------------------------------------------------ */

export interface BrandStripItem {
  image: string
  href: string
}

export interface BrandStripData {
  title?: string
  brands?: BrandStripItem[]
  [key: string]: unknown
}

const BrandStrip = (props: BrandStripData) => {
  const { title } = props
  const brands = Array.isArray(props.brands) ? props.brands : []

  if (!brands.length) {
    return null
  }

  return (
    <section className="aurora-theme bg-white py-16 md:py-24 font-sans">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {title ? (
          <div className="mb-12 text-center">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">
              Trusted by
            </p>
            <h2 className="mt-3 text-3xl md:text-4xl font-semibold tracking-tight text-neutral-900">
              {title}
            </h2>
          </div>
        ) : null}
        <div className="grid grid-cols-2 items-center gap-px overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-200 shadow-sm sm:grid-cols-3 lg:grid-cols-6">
          {brands.map((brand, i) => (
            <LocalizedClientLink
              key={i}
              href={brand.href || "#"}
              className="group flex items-center justify-center bg-white px-6 py-10 transition hover:bg-neutral-50"
            >
              <img
                src={brand.image}
                alt="Brand"
                className="h-10 w-auto max-w-[140px] object-contain opacity-60 grayscale transition duration-300 group-hover:opacity-100 group-hover:grayscale-0"
              />
            </LocalizedClientLink>
          ))}
        </div>
      </div>
    </section>
  )
}

export default BrandStrip
