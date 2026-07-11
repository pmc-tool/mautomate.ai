import LocalizedClientLink from "@modules/common/components/localized-client-link"
import type { BlogPostCard } from "@lib/data/blog"

/** Fallback cover used when a post has no cover_image. */
const FALLBACK_COVER = "/learts/assets/images/blog/s370/blog-1.webp"

/** Format an ISO date as e.g. "January 22, 2020". */
const formatDate = (iso: string | null): string | null => {
  if (!iso) {
    return null
  }
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return null
  }
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

/**
 * Learts `.blog` grid card (cover, meta, title, excerpt, read more).
 * Server component — links via LocalizedClientLink to `/blog/[slug]`.
 *
 * Wrapped by the caller in the Bootstrap grid column
 * (`col-lg-4 col-md-6 col-12 learts-mb-40`).
 */
export default function PostCard({ post }: { post: BlogPostCard }) {
  const href = `/blog/${post.slug}`
  const date = formatDate(post.published_at)
  const primaryCategory = post.categories?.[0]

  return (
    <div className="blog">
      <div className="image">
        <LocalizedClientLink href={href}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.cover_image || FALLBACK_COVER}
            alt={post.title}
            loading="lazy"
          />
        </LocalizedClientLink>
      </div>
      <div className="content">
        <ul className="meta">
          {date && (
            <li>
              <i className="far fa-calendar" />
              <LocalizedClientLink href={href}>{date}</LocalizedClientLink>
            </li>
          )}
          {primaryCategory && (
            <li>
              <i className="far fa-folder-open" />
              <LocalizedClientLink href={`/blog?category=${primaryCategory.slug}`}>
                {primaryCategory.name}
              </LocalizedClientLink>
            </li>
          )}
          {!!post.reading_time && (
            <li>
              <i className="far fa-clock" /> {post.reading_time} min read
            </li>
          )}
        </ul>
        <h5 className="title">
          <LocalizedClientLink href={href}>{post.title}</LocalizedClientLink>
        </h5>
        {post.excerpt && (
          <div className="desc">
            <p>{post.excerpt}</p>
          </div>
        )}
        <LocalizedClientLink href={href} className="link">
          Read More
        </LocalizedClientLink>
      </div>
    </div>
  )
}
