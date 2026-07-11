import { NextRequest } from "next/server"

import { getBlogPosts, BLOG_LIST_TAG } from "@lib/data/blog"

/* RSS 2.0 feed of the most recent published blog posts. Cached under the
 * shared `cms-blog` tag, so a publish/unpublish revalidates the feed too. */

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function getBaseUrl(req: NextRequest): string {
  const fromEnv = process.env.NEXT_PUBLIC_BASE_URL
  if (fromEnv) {
    return fromEnv.replace(/\/$/, "")
  }
  return req.nextUrl.origin
}

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ countryCode: string }> }
) {
  const { countryCode } = await props.params
  const base = getBaseUrl(req)
  const blogBase = `${base}/${countryCode}/blog`

  const { posts, locale } = await getBlogPosts({ limit: 20, offset: 0 })

  const items = posts
    .map((post) => {
      const link = `${blogBase}/${post.slug}`
      const pubDate = post.published_at
        ? new Date(post.published_at).toUTCString()
        : new Date().toUTCString()
      const categories = (post.categories ?? [])
        .map((c) => `      <category>${escapeXml(c.name)}</category>`)
        .join("\n")
      const author = post.author?.name
        ? `      <dc:creator>${escapeXml(post.author.name)}</dc:creator>\n`
        : ""

      return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <pubDate>${pubDate}</pubDate>
${author}${
        post.excerpt
          ? `      <description>${escapeXml(post.excerpt)}</description>\n`
          : ""
      }${categories ? `${categories}\n` : ""}    </item>`
    })
    .join("\n")

  const lastBuild =
    posts[0]?.published_at != null
      ? new Date(posts[0].published_at).toUTCString()
      : new Date().toUTCString()

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Forever Finds Blog</title>
    <link>${escapeXml(blogBase)}</link>
    <description>Handmade stories, gift ideas and craft inspiration from Forever Finds.</description>
    <language>${escapeXml(locale ?? "en")}</language>
    <lastBuildDate>${lastBuild}</lastBuildDate>
    <atom:link href="${escapeXml(
      `${blogBase}/rss.xml`
    )}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600",
      "x-cms-blog-tag": BLOG_LIST_TAG,
    },
  })
}
