/* ------------------------------------------------------------------ */
/* Aurora (modern minimalist) renderer for the Testimonials CMS block.  */
/* Consumes the SAME resolved block-data props as the Learts version    */
/* (`<Testimonials {...block} />`), so it also carries block_type /      */
/* schema_version / countryCode which we simply ignore.                 */
/*                                                                      */
/* `title` is OPTIONAL (absent / empty => no heading). `items` is always */
/* an array (may be empty => the whole block renders null). `role` and   */
/* `avatar` are optional per item. Avatar fields hold fully-resolved     */
/* media URLs. Static server component (no client interactivity).        */
/* ------------------------------------------------------------------ */

export interface TestimonialItem {
  quote: string
  author: string
  role?: string
  avatar?: string
}

export interface TestimonialsData {
  title?: string
  items?: TestimonialItem[]
  [key: string]: unknown
}

function QuoteMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-6 w-6"
      aria-hidden="true"
    >
      <path d="M7.17 6A5.17 5.17 0 0 0 2 11.17V18h6.83v-6.83H5.5A1.67 1.67 0 0 1 7.17 9.5V6Zm11 0A5.17 5.17 0 0 0 13 11.17V18h6.83v-6.83H16.5a1.67 1.67 0 0 1 1.67-1.67V6Z" />
    </svg>
  )
}

function Initial({ author }: { author: string }) {
  const letter = (author?.trim()?.[0] ?? "").toUpperCase()
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-sm font-medium text-neutral-900">
      {letter}
    </span>
  )
}

function TestimonialCard({ item, index }: { item: TestimonialItem; index: number }) {
  return (
    <figure data-el="item" data-el-item={`items:${index}`} className="flex h-full flex-col rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm transition hover:shadow-md">
      <span
        className="mb-6 inline-flex"
        style={{ color: "var(--aurora-accent)" }}
      >
        <QuoteMark />
      </span>
      {item.quote ? (
        <blockquote data-el="quote" className="flex-1 text-base leading-relaxed text-neutral-900">
          {item.quote}
        </blockquote>
      ) : (
        <div className="flex-1" />
      )}
      <figcaption className="mt-8 flex items-center gap-3 border-t border-neutral-200 pt-6">
        {item.avatar ? (
          <img
            src={item.avatar}
            alt={item.author}
            className="h-10 w-10 shrink-0 rounded-full object-cover"
          />
        ) : (
          <Initial author={item.author} />
        )}
        <div className="min-w-0">
          <span data-el="author" className="block truncate text-sm font-medium text-neutral-900">
            {item.author}
          </span>
          {item.role ? (
            <span className="block truncate text-xs text-neutral-500">
              {item.role}
            </span>
          ) : null}
        </div>
      </figcaption>
    </figure>
  )
}

const Testimonials = (props: TestimonialsData) => {
  const items = Array.isArray(props.items) ? props.items : []

  if (!items.length) {
    return null
  }

  return (
    <section className="aurora-theme bg-white py-16 font-sans md:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {props.title ? (
          <div className="mb-12 text-center">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">
              Testimonials
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-neutral-900 md:text-4xl">
              {props.title}
            </h2>
          </div>
        ) : null}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item, i) => (
            <TestimonialCard item={item} index={i} key={i} />
          ))}
        </div>
      </div>
    </section>
  )
}

export default Testimonials
