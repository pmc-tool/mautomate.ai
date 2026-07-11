import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { clx } from "@modules/common/components/ui"

/**
 * Server-rendered, SEO-friendly blog pagination. Each page is a real
 * `<a>` (LocalizedClientLink) carrying the `page` (and optional `category`)
 * query params, so the listing stays crawlable and works without JS.
 */
export default function BlogPagination({
  page,
  totalPages,
  category,
}: {
  page: number
  totalPages: number
  category?: string
}) {
  if (totalPages <= 1) {
    return null
  }

  const hrefFor = (p: number) => {
    const params = new URLSearchParams()
    if (category) {
      params.set("category", category)
    }
    if (p > 1) {
      params.set("page", String(p))
    }
    const qs = params.toString()
    return qs ? `/blog?${qs}` : "/blog"
  }

  // Compact window of page numbers around the current page.
  const pages: number[] = []
  const windowSize = 2
  const start = Math.max(1, page - windowSize)
  const end = Math.min(totalPages, page + windowSize)
  for (let p = start; p <= end; p++) {
    pages.push(p)
  }

  return (
    <div className="row learts-mt-50">
      <div className="col">
        <ul
          className="blog-pagination"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "8px",
            justifyContent: "center",
            alignItems: "center",
            listStyle: "none",
            padding: 0,
            margin: 0,
          }}
        >
          {page > 1 && (
            <li>
              <LocalizedClientLink
                href={hrefFor(page - 1)}
                className="btn btn-outline-dark btn-sm"
              >
                <i className="fas fa-angle-left" /> Prev
              </LocalizedClientLink>
            </li>
          )}

          {start > 1 && (
            <>
              <li>
                <LocalizedClientLink
                  href={hrefFor(1)}
                  className="btn btn-outline-dark btn-sm"
                >
                  1
                </LocalizedClientLink>
              </li>
              {start > 2 && (
                <li>
                  <span style={{ padding: "0 4px" }}>…</span>
                </li>
              )}
            </>
          )}

          {pages.map((p) => (
            <li key={p}>
              <LocalizedClientLink
                href={hrefFor(p)}
                className={clx("btn btn-sm", {
                  "btn-dark": p === page,
                  "btn-outline-dark": p !== page,
                })}
                aria-current={p === page ? "page" : undefined}
              >
                {p}
              </LocalizedClientLink>
            </li>
          ))}

          {end < totalPages && (
            <>
              {end < totalPages - 1 && (
                <li>
                  <span style={{ padding: "0 4px" }}>…</span>
                </li>
              )}
              <li>
                <LocalizedClientLink
                  href={hrefFor(totalPages)}
                  className="btn btn-outline-dark btn-sm"
                >
                  {totalPages}
                </LocalizedClientLink>
              </li>
            </>
          )}

          {page < totalPages && (
            <li>
              <LocalizedClientLink
                href={hrefFor(page + 1)}
                className="btn btn-outline-dark btn-sm"
              >
                Next <i className="fas fa-angle-right" />
              </LocalizedClientLink>
            </li>
          )}
        </ul>
      </div>
    </div>
  )
}
