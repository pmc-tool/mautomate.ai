import { Metadata } from "next"
import { notFound } from "next/navigation"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import {
  getBlogPost,
  type BlogPostCard,
  type BlogPostDetail,
} from "@lib/data/blog"

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/**
 * Conservative server-side HTML sanitizer for admin-authored blog content.
 * The content originates from the authenticated CMS, but we still strip the
 * obvious XSS vectors before rendering with dangerouslySetInnerHTML:
 *  - <script>/<style>/<iframe>/<object>/<embed> blocks (and self-closing)
 *  - inline event-handler attributes (on*)
 *  - javascript: URIs in href/src
 */
function sanitizeBlogHtml(html: string): string {
  return html
    .replace(
      /<\s*(script|style|iframe|object|embed)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,
      ""
    )
    .replace(/<\s*(script|style|iframe|object|embed)\b[^>]*\/?>/gi, "")
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, "")
    .replace(/(href|src)\s*=\s*"\s*javascript:[^"]*"/gi, '$1="#"')
    .replace(/(href|src)\s*=\s*'\s*javascript:[^']*'/gi, "$1='#'")
}

function formatDate(value: string | null): string {
  if (!value) {
    return ""
  }
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) {
    return ""
  }
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

/* ------------------------------------------------------------------ */
/* Metadata                                                           */
/* ------------------------------------------------------------------ */

export async function generateMetadata(props: {
  params: Promise<{ slug: string; countryCode: string }>
}): Promise<Metadata> {
  const { slug } = await props.params
  const bundle = await getBlogPost(slug)

  if (!bundle) {
    return { title: "Post not found" }
  }

  const { post } = bundle
  const title = post.seo?.title ?? post.title
  const description = post.seo?.description ?? post.excerpt ?? undefined
  const ogImage = post.seo?.og_image ?? post.cover_image ?? undefined

  return {
    title: `${title}`,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      ...(post.published_at
        ? { publishedTime: post.published_at }
        : {}),
      ...(ogImage ? { images: [{ url: ogImage }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  }
}

/* ------------------------------------------------------------------ */
/* Related post card (Learts "related-blog" markup)                    */
/* ------------------------------------------------------------------ */

function RelatedCard({ post }: { post: BlogPostCard }) {
  return (
    <div className="col-md-6 col-12 learts-mb-40">
      <div className="blog">
        <div className="image">
          <LocalizedClientLink href={`/blog/${post.slug}`}>
            <img
              src={
                post.cover_image ?? "/learts/assets/images/blog/s370/blog-2.webp"
              }
              alt={post.title}
            />
          </LocalizedClientLink>
        </div>
        <div className="content">
          <ul className="meta">
            {post.published_at && (
              <li>
                <i className="far fa-calendar" />
                <span>{formatDate(post.published_at)}</span>
              </li>
            )}
            {post.reading_time ? (
              <li>
                <i className="far fa-clock" /> {post.reading_time} min read
              </li>
            ) : null}
          </ul>
          <h5 className="title mb-0">
            <LocalizedClientLink href={`/blog/${post.slug}`}>
              {post.title}
            </LocalizedClientLink>
          </h5>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Page                                                               */
/* ------------------------------------------------------------------ */

export default async function BlogPostPage(props: {
  params: Promise<{ slug: string; countryCode: string }>
}) {
  const { slug } = await props.params
  const bundle = await getBlogPost(slug)

  if (!bundle) {
    notFound()
  }

  const post: BlogPostDetail = bundle.post
  const related = bundle.related ?? []
  const safeContent = post.content ? sanitizeBlogHtml(post.content) : ""

  return (
    <div className="learts-theme">
      {/* Page title */}
      <div
        className="page-title-section section"
        style={{
          backgroundImage: "url(/learts/assets/images/bg/page-title-1.webp)",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="container">
          <div className="row">
            <div className="col">
              <div className="page-title">
                <h1 className="title">Blog</h1>
                <ul className="breadcrumb">
                  <li className="breadcrumb-item">
                    <LocalizedClientLink href="/">Home</LocalizedClientLink>
                  </li>
                  <li className="breadcrumb-item">
                    <LocalizedClientLink href="/blog">Blog</LocalizedClientLink>
                  </li>
                  <li className="breadcrumb-item active">{post.title}</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Single Blog Section */}
      <div className="section section-padding">
        <div className="container">
          <div className="row">
            <div className="col-12">
              <div className="single-blog">
                {post.categories.length > 0 && (
                  <ul className="category justify-content-center">
                    {post.categories.map((cat) => (
                      <li key={cat.id}>
                        <LocalizedClientLink href={`/blog?category=${cat.slug}`}>
                          {cat.name}
                        </LocalizedClientLink>
                      </li>
                    ))}
                  </ul>
                )}
                <h2 className="title text-center mb-5">{post.title}</h2>

                {post.cover_image && (
                  <div className="image mb-5">
                    <img src={post.cover_image} alt={post.title} />
                  </div>
                )}

                <div className="row">
                  <div className="col-xl-9 col-lg-10 col-12 mx-auto">
                    <div className="content">
                      <ul className="meta justify-content-center">
                        {post.author && (
                          <li>
                            <i className="far fa-user" /> By{" "}
                            <span>{post.author.name}</span>
                          </li>
                        )}
                        {post.published_at && (
                          <li>
                            <i className="far fa-calendar" />
                            <span>{formatDate(post.published_at)}</span>
                          </li>
                        )}
                        {post.reading_time ? (
                          <li>
                            <i className="far fa-clock" /> {post.reading_time}{" "}
                            min read
                          </li>
                        ) : null}
                      </ul>

                      {post.excerpt && (
                        <p className="lead text-center mb-5">{post.excerpt}</p>
                      )}

                      {safeContent ? (
                        <div
                          className="desc"
                          dangerouslySetInnerHTML={{ __html: safeContent }}
                        />
                      ) : null}
                    </div>

                    {post.categories.length > 0 && (
                      <div className="blog-footer row g-0 justify-content-between align-items-center">
                        <div className="col-auto">
                          <ul className="tags">
                            <li className="icon">
                              <i className="fas fa-tags" />
                            </li>
                            {post.categories.map((cat) => (
                              <li key={cat.id}>
                                <LocalizedClientLink
                                  href={`/blog?category=${cat.slug}`}
                                >
                                  {cat.name}
                                </LocalizedClientLink>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Author bio + related */}
              <div className="row">
                <div className="col-xl-9 col-lg-10 col-12 mx-auto">
                  {post.author && (post.author.bio || post.author.avatar) && (
                    <div className="blog-author">
                      {post.author.avatar && (
                        <div className="thumbnail">
                          <img
                            src={post.author.avatar}
                            alt={post.author.name}
                          />
                        </div>
                      )}
                      <div className="content">
                        <span className="name">{post.author.name}</span>
                        {post.author.bio && <p>{post.author.bio}</p>}
                      </div>
                    </div>
                  )}

                  {related.length > 0 && (
                    <div className="related-blog">
                      <div className="block-title pb-0 border-bottom-0">
                        <h2 className="title">Related Posts</h2>
                      </div>
                      <div className="row learts-mb-n40">
                        {related.map((rp) => (
                          <RelatedCard key={rp.id} post={rp} />
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="text-center mt-5">
                    <LocalizedClientLink
                      href="/blog"
                      className="btn btn-dark btn-outline-hover-dark"
                    >
                      Back to Blog
                    </LocalizedClientLink>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
