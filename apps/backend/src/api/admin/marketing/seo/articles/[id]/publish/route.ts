import { resolveTenantId } from "../../../../../../../lib/tenant-context"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../../../../modules/marketing"
import MarketingModuleService from "../../../../../../../modules/marketing/service"
import { CMS_MODULE } from "../../../../../../../modules/cms"
import type CmsModuleService from "../../../../../../../modules/cms/service"

const TENANT_ID = resolveTenantId("MARKETING_DEFAULT_TENANT")

const isNotFound = (e: any): boolean =>
  e?.type === "not_found" || /was not found|not found/i.test(e?.message ?? "")

/** Slugify a title into a URL-safe handle. */
const slugify = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "article"

/** Derive a short plain-text excerpt from a markdown body. */
const deriveExcerpt = (body: string, max = 200): string => {
  const plain = body
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`~\-]+/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
  return plain.length > max ? `${plain.slice(0, max - 1)}…` : plain
}

/**
 * Ensure the slug is unique among existing CMS blog posts by appending a short
 * numeric suffix on collision. Best-effort — if the lookup fails we fall back to
 * a random suffix so the create still has a fighting chance.
 */
const resolveUniqueSlug = async (
  cms: CmsModuleService,
  base: string
): Promise<string> => {
  try {
    const existing = await cms.listCmsBlogPosts({ slug: base })
    if (!Array.isArray(existing) || existing.length === 0) {
      return base
    }
  } catch {
    return `${base}-${Math.random().toString(36).slice(2, 6)}`
  }
  for (let i = 2; i < 50; i++) {
    const candidate = `${base}-${i}`
    try {
      const rows = await cms.listCmsBlogPosts({ slug: candidate })
      if (!Array.isArray(rows) || rows.length === 0) {
        return candidate
      }
    } catch {
      break
    }
  }
  return `${base}-${Math.random().toString(36).slice(2, 6)}`
}

/**
 * POST /admin/marketing/seo/articles/:id/publish
 *
 * Publish an article into the store's CMS blog. Reads the cached draft body/meta
 * off the source brief, creates a `cms_blog_post` (status "published"), and
 * stamps `cms_blog_post_id` + status "published" on the article.
 *
 * DEFENSIVE: the CMS blog post is created with only the minimal fields needed.
 * On ANY CMS error the article is left in status "review" (not "published") and
 * a clear message is returned with HTTP 200 — never a 500. When the article was
 * already published, the existing cms_blog_post_id is returned unchanged.
 * Response: { article, cms_blog_post_id, published, message? }
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params

  try {
    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)

    const article = await svc.retrieveMarketingBlogArticle(id)
    if (
      (article as any)?.tenant_id &&
      (article as any).tenant_id !== TENANT_ID
    ) {
      res.status(404).json({ message: `Article ${id} was not found` })
      return
    }

    // Already published — return the existing CMS link, idempotently.
    if (
      (article as any).status === "published" &&
      (article as any).cms_blog_post_id
    ) {
      res.json({
        article,
        cms_blog_post_id: (article as any).cms_blog_post_id,
        published: true,
      })
      return
    }

    // Load the cached draft body + meta from the source brief.
    const briefId = (article as any).brief_id as string | null
    let body = ""
    let metaDescription = ""
    if (briefId) {
      try {
        const brief = await svc.retrieveMarketingContentBrief(briefId)
        if ((brief as any)?.tenant_id === TENANT_ID) {
          const outline = ((brief as any).outline ?? {}) as Record<
            string,
            unknown
          >
          body =
            typeof outline.draft_body === "string" ? outline.draft_body : ""
          metaDescription =
            typeof outline.draft_meta === "string" ? outline.draft_meta : ""
        }
      } catch {
        // fall through — defensive publish tolerates a missing brief.
      }
    }

    const title = ((article as any).title as string | null)?.trim() || "Untitled article"

    if (!body.trim()) {
      // Nothing to publish — keep as review with a clear message (no 500).
      await svc
        .updateMarketingBlogArticles({ id, status: "review" } as any)
        .catch(() => {})
      const reloaded = await svc.retrieveMarketingBlogArticle(id)
      res.json({
        article: reloaded,
        cms_blog_post_id: null,
        published: false,
        message:
          "This article has no generated body yet. Generate the article before publishing.",
      })
      return
    }

    // --- Attempt the CMS publish. Any failure => leave as review, HTTP 200. --
    try {
      const cms: CmsModuleService = req.scope.resolve(CMS_MODULE)

      const slug = await resolveUniqueSlug(cms, slugify(title))

      const created: any = await cms.createCmsBlogPosts({
        title,
        slug,
        content: body,
        excerpt: metaDescription || deriveExcerpt(body),
        status: "published",
        published_at: new Date(),
        seo_title: title,
        seo_description: metaDescription || null,
      } as any)
      const post = Array.isArray(created) ? created[0] : created
      const cmsPostId = (post as any)?.id ?? null

      await svc.updateMarketingBlogArticles({
        id,
        cms_blog_post_id: cmsPostId,
        status: "published",
      } as any)

      const reloaded = await svc.retrieveMarketingBlogArticle(id)

      res.json({
        article: reloaded,
        cms_blog_post_id: cmsPostId,
        published: true,
      })
    } catch (cmsErr: any) {
      // CMS hiccup — do NOT 500. Mark the article "review" for a retry.
      await svc
        .updateMarketingBlogArticles({ id, status: "review" } as any)
        .catch(() => {})
      const reloaded = await svc.retrieveMarketingBlogArticle(id)
      res.json({
        article: reloaded,
        cms_blog_post_id: null,
        published: false,
        message:
          cmsErr?.message ??
          "Could not publish to the CMS blog. The article is kept in review — try again.",
      })
    }
  } catch (e: any) {
    res.status(isNotFound(e) ? 404 : 500).json({
      message: e?.message ?? "Failed to publish article",
    })
  }
}
