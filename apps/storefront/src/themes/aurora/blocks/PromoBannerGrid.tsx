import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ------------------------------------------------------------------ */
/* Aurora (modern minimalist) renderer for the promo_banner_grid CMS   */
/* block. Consumes the SAME resolved block data the Learts renderer     */
/* does — received as the spread prop bag from the storefront           */
/* SectionRenderer (`<PromoBannerGrid {...block} />`), so it also        */
/* carries block_type / schema_version / countryCode which we ignore.   */
/* intro / sale / instagram are OPTIONAL groups (absent => not          */
/* rendered). `categories` is always treated as an array (may be empty).*/
/* Interfaces are re-declared here (copied from the Learts source) so    */
/* this file is fully self-contained.                                    */
/* ------------------------------------------------------------------ */

export interface PromoIntro {
  title: string
  body: string
  link_label: string
  href: string
}

export interface PromoSale {
  image: string
  special_title: string
  title: string
  link_label: string
  href: string
}

export interface PromoCategoryTile {
  image: string
  title: string
  count_label: string
  href: string
  wide?: boolean
}

export interface PromoInstagram {
  image: string
  sub_title: string
  handle: string
  href: string
}

export interface PromoBannerGridData {
  intro?: PromoIntro
  sale?: PromoSale
  categories?: PromoCategoryTile[]
  instagram?: PromoInstagram
  [key: string]: unknown
}

function ArrowIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  )
}

function InstagramIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  )
}

function CategoryTile({ cat }: { cat: PromoCategoryTile }) {
  const spanClass = cat.wide ? "sm:col-span-2" : ""

  return (
    <LocalizedClientLink
      href={cat.href}
      className={`group relative flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition hover:shadow-md ${spanClass}`}
    >
      <div className="aspect-[4/3] overflow-hidden">
        <img
          src={cat.image}
          alt={cat.title}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
      </div>
      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <h3 className="text-base font-semibold tracking-tight text-neutral-900">
          {cat.title}
        </h3>
        {cat.count_label ? (
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">
            {cat.count_label}
          </span>
        ) : null}
      </div>
    </LocalizedClientLink>
  )
}

const PromoBannerGrid = (props: PromoBannerGridData) => {
  const { intro, sale, instagram } = props
  const categories = Array.isArray(props.categories) ? props.categories : []

  // Preserve the original Learts content order: intro, sale, the regular
  // (non-wide) category tiles, the instagram banner, then the wide tiles.
  const regularCats = categories.filter((c) => !c.wide)
  const wideCats = categories.filter((c) => c.wide)

  // Nothing to render -> render null (mirror the original empty guards).
  if (!intro && !sale && !instagram && categories.length === 0) {
    return null
  }

  return (
    <section className="aurora-theme bg-white py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {/* Intro editorial blockquote */}
          {intro ? (
            <div className="flex flex-col justify-center rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm sm:col-span-2">
              <h2 className="text-3xl font-semibold tracking-tight text-neutral-900 md:text-4xl">
                {intro.title}
              </h2>
              {intro.body ? (
                <p className="mt-4 max-w-prose text-base leading-relaxed text-neutral-500">
                  {intro.body}
                </p>
              ) : null}
              {intro.href ? (
                <LocalizedClientLink
                  href={intro.href}
                  className="mt-6 inline-flex w-fit items-center justify-center gap-2 rounded-full bg-neutral-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-neutral-700"
                >
                  {intro.link_label}
                  <ArrowIcon />
                </LocalizedClientLink>
              ) : null}
            </div>
          ) : null}

          {/* Sale highlight */}
          {sale ? (
            <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition hover:shadow-md">
              <div className="aspect-[4/3] overflow-hidden">
                <img
                  src={sale.image}
                  alt={sale.title}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                />
              </div>
              <div className="flex flex-1 flex-col p-5">
                {sale.special_title ? (
                  <span
                    className="text-xs font-medium uppercase tracking-[0.2em]"
                    style={{ color: "var(--aurora-accent)" }}
                  >
                    {sale.special_title}
                  </span>
                ) : null}
                <h2 className="mt-2 text-xl font-semibold tracking-tight text-neutral-900">
                  {sale.title}
                </h2>
                {sale.href ? (
                  <LocalizedClientLink
                    href={sale.href}
                    className="mt-4 inline-flex w-fit items-center gap-2 text-sm font-medium text-neutral-900 transition hover:text-neutral-500"
                  >
                    {sale.link_label}
                    <ArrowIcon />
                  </LocalizedClientLink>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* Regular category tiles */}
          {regularCats.map((cat, i) => (
            <CategoryTile key={`reg-${i}`} cat={cat} />
          ))}

          {/* Instagram */}
          {instagram ? (
            <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition hover:shadow-md">
              <div className="aspect-[4/3] overflow-hidden">
                <img
                  src={instagram.image}
                  alt={instagram.handle}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                />
              </div>
              <div className="flex flex-1 flex-col p-5">
                <span
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 text-neutral-900"
                  style={{ color: "var(--aurora-accent)" }}
                >
                  <InstagramIcon />
                </span>
                {instagram.sub_title ? (
                  <span className="mt-3 text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">
                    {instagram.sub_title}
                  </span>
                ) : null}
                <h3 className="mt-1 text-lg font-semibold tracking-tight text-neutral-900">
                  <a
                    href={instagram.href || "#"}
                    className="transition hover:text-neutral-500"
                  >
                    {instagram.handle}
                  </a>
                </h3>
              </div>
            </div>
          ) : null}

          {/* Wide category tiles (e.g. Toys) */}
          {wideCats.map((cat, i) => (
            <CategoryTile key={`wide-${i}`} cat={cat} />
          ))}
        </div>
      </div>
    </section>
  )
}

export default PromoBannerGrid
