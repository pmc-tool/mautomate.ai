import { MedusaRequest } from "@medusajs/framework/http"
import { CMS_MODULE } from "../../../modules/cms"
import type CmsModuleService from "../../../modules/cms/service"
import {
  publishBlogPost,
  unpublishBlogPost,
} from "../../../modules/cms/blog-publish-helper"
import { publishPageSnapshot } from "../../../modules/cms/publish-helper"
import {
  BLOG_POST_RELATIONS,
  estimateReadingTime,
  loadPost,
  one,
  resolveUniqueSlug,
  slugify,
} from "../blog/_helpers"
import type { JarvisWrite, Ctx } from "./_writes-money"
import { promptToImage } from "../../../modules/marketing/ai/video-generator"
import { meterAction } from "../../../modules/platform/integration/metering-guard"
import { fetchBytes, storeBytes } from "../blog/ai/_helpers"

/**
 * Pixi P3 — CONTENT write tools: BLOG POSTS + CMS STOREFRONT PAGES.
 *
 * These give Pixi the ability to write the merchant's storefront content —
 * draft and publish blog articles, and stand up simple CMS pages (About, etc.).
 * They mirror the exact contract of _writes-soft.ts / _writes-money.ts so this
 * file can be concatenated into the shared WRITES registry:
 *
 *   - `plan()` NEVER mutates. It resolves the merchant's words into concrete,
 *     tenant-owned records (a post/page by its title or slug), validates the
 *     request, and returns `{ human_summary, details, apply_args }` for the
 *     confirm card. Bad input returns `{ ok:false, error }` — a friendly
 *     sentence, never a stack trace.
 *   - `apply()` runs ONLY the ids `plan()` produced (the model never supplies a
 *     tenant, and any id it does pass is re-verified tenant-owned by loadPost /
 *     the ownership guard) by calling the SAME CMS service + publish helpers the
 *     REST routes use, and returns `{ result, undo? }`.
 *
 * Tenancy is ALWAYS taken from `ctx.tenant.id` — cross-tenant access is
 * impossible because every lookup is filtered by tenant and every write helper
 * (loadPost, publishBlogPost, publishPageSnapshot) fail-closes to "not found" on
 * a tenant mismatch.
 *
 * Tiering (mirrors _writes-social.ts / _writes-ads.ts): making content PUBLIC on
 * the live storefront is an outbound action, so `publish_blog_post` and
 * `publish_page` are `tier:"hard"` with a typed `requireText: "PUBLISH"`.
 * Drafting content (create/update, which is not yet visible to shoppers) is a
 * one-tap `tier:"soft"`.
 *
 * Undo model: the two publish tools are self-reversing — their `undo` re-invokes
 * the SAME tool's `apply()` with an inverse `unpublish` flag (publish <-> revert
 * to draft), because `apply()` reads its effect straight from `apply_args`, so no
 * hidden executor is required. Draft creation is reversible from the merchant's
 * Blog / Pages screens, so the create tools declare no automatic undo.
 */

/* -------------------------------- helpers -------------------------------- */

const str = (v: any) => String(v ?? "").trim()

const svcOf = (req: MedusaRequest): CmsModuleService =>
  req.scope.resolve(CMS_MODULE)

/** Turn any thrown error into a short, merchant-safe sentence (no internals). */
function friendly(e: any, fallback: string): string {
  const msg = String(e?.message || "")
  if (!msg || msg.length > 180 || /\b(at |Error:|node_modules|SELECT |INSERT )/i.test(msg)) {
    return fallback
  }
  return msg
}

/**
 * Convert the plain-text / lightweight-markdown a merchant dictates into the
 * "rich HTML" the blog post `content` column and the `rich_text` CMS block store
 * — the same storage format the dashboard TipTap editor produces. If the input
 * already looks like HTML it is passed through untouched. Supports #/##/###
 * headings, - / * and 1. lists, blank-line paragraphs, and inline **bold**,
 * *italic* and [text](url) links, with all other text HTML-escaped.
 */
export function contentToHtml(input: string): string {
  const raw = String(input ?? "").trim()
  if (!raw) return ""
  // Already HTML — trust it (the editor also stores authored HTML verbatim).
  if (/<(p|h[1-6]|ul|ol|li|div|br|img|blockquote|strong|em|a)\b/i.test(raw)) {
    return raw
  }

  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

  const inline = (s: string) => {
    let t = escape(s)
    // [text](url) — url is escaped above; only allow http(s) and root-relative.
    t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, text, url) => {
      const safe = /^(https?:\/\/|\/)/i.test(url) ? url : "#"
      return `<a href="${safe}">${text}</a>`
    })
    t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    t = t.replace(/__([^_]+)__/g, "<strong>$1</strong>")
    t = t.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    t = t.replace(/(^|[^_])_([^_\n]+)_/g, "$1<em>$2</em>")
    return t
  }

  const lines = raw.replace(/\r\n?/g, "\n").split("\n")
  const out: string[] = []
  let para: string[] = []
  let listType: "ul" | "ol" | null = null

  const flushPara = () => {
    if (para.length) {
      out.push(`<p>${inline(para.join(" "))}</p>`)
      para = []
    }
  }
  const closeList = () => {
    if (listType) {
      out.push(`</${listType}>`)
      listType = null
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) {
      flushPara()
      closeList()
      continue
    }
    const heading = line.match(/^(#{1,4})\s+(.*)$/)
    if (heading) {
      flushPara()
      closeList()
      const level = Math.min(heading[1].length + 1, 5) // # -> h2, ## -> h3 ...
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`)
      continue
    }
    const ul = line.match(/^[-*]\s+(.*)$/)
    const ol = line.match(/^\d+[.)]\s+(.*)$/)
    if (ul || ol) {
      flushPara()
      const want: "ul" | "ol" = ul ? "ul" : "ol"
      if (listType !== want) {
        closeList()
        out.push(`<${want}>`)
        listType = want
      }
      out.push(`<li>${inline((ul ? ul[1] : ol![1]))}</li>`)
      continue
    }
    closeList()
    para.push(line)
  }
  flushPara()
  closeList()
  return out.join("\n")
}

/** A short, one-sentence plain-text preview of authored HTML for confirm cards. */
const preview = (html: string, n = 120): string => {
  const text = String(html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
  return text.length > n ? `${text.slice(0, n)}…` : text
}

/**
 * Resolve ONE tenant-owned blog post from what the model was given: an explicit
 * id (re-verified tenant-owned via loadPost) or a title to match. Never throws.
 */
async function resolveBlogPost(
  service: CmsModuleService,
  tenantId: string,
  args: Record<string, any>
): Promise<{ ok: true; post: any } | { ok: false; error: string }> {
  const id = str(args.id ?? args.post_id)
  if (id) {
    try {
      const post = await loadPost(service, id, tenantId)
      return { ok: true, post }
    } catch {
      return { ok: false, error: "I couldn't find that blog post in your store." }
    }
  }
  const title = str(args.title ?? args.post_title ?? args.query)
  if (!title) {
    return { ok: false, error: "Tell me which blog post — give me its title." }
  }
  const needle = title.toLowerCase()
  const posts: any[] = await service
    .listCmsBlogPosts(
      { tenant_id: tenantId },
      { take: 200, order: { created_at: "DESC" } } as any
    )
    .catch(() => [])
  const exact = posts.filter((p) => (p.title || "").toLowerCase() === needle)
  const partial = posts.filter((p) => (p.title || "").toLowerCase().includes(needle))
  const matches = exact.length ? exact : partial
  if (!matches.length) {
    return { ok: false, error: `I couldn't find a blog post called "${title}".` }
  }
  if (matches.length > 1) {
    const names = matches.slice(0, 5).map((p) => `"${p.title}"`).join(", ")
    return { ok: false, error: `That matched ${matches.length} posts (${names}). Which one?` }
  }
  return { ok: true, post: matches[0] }
}

/** Resolve ONE tenant-owned CMS page by id, slug, or title. Never throws. */
async function resolvePage(
  service: CmsModuleService,
  tenantId: string,
  args: Record<string, any>
): Promise<{ ok: true; page: any } | { ok: false; error: string }> {
  const id = str(args.id ?? args.page_id)
  if (id) {
    try {
      const page = await service.retrieveCmsPage(id)
      if (!page || (page.tenant_id ?? null) !== tenantId) {
        return { ok: false, error: "I couldn't find that page in your store." }
      }
      return { ok: true, page }
    } catch {
      return { ok: false, error: "I couldn't find that page in your store." }
    }
  }
  const term = str(args.slug ?? args.title ?? args.query ?? args.page)
  if (!term) {
    return { ok: false, error: "Tell me which page — give me its title or slug." }
  }
  const needle = term.toLowerCase()
  const slugGuess = slugify(term)
  const pages: any[] = await service
    .listCmsPages(
      { tenant_id: tenantId },
      { take: 200, order: { updated_at: "DESC" } } as any
    )
    .catch(() => [])
  const bySlug = pages.filter(
    (p) => (p.slug || "").toLowerCase() === needle || (p.slug || "").toLowerCase() === slugGuess
  )
  const exact = pages.filter((p) => (p.title || "").toLowerCase() === needle)
  const partial = pages.filter((p) => (p.title || "").toLowerCase().includes(needle))
  const matches = bySlug.length ? bySlug : exact.length ? exact : partial
  if (!matches.length) {
    return { ok: false, error: `I couldn't find a page called "${term}".` }
  }
  if (matches.length > 1) {
    const names = matches.slice(0, 5).map((p) => `"${p.title}"`).join(", ")
    return { ok: false, error: `That matched ${matches.length} pages (${names}). Which one?` }
  }
  return { ok: true, page: matches[0] }
}

/** Best-effort resolve a blog category NAME to its tenant-owned id. */
async function resolveCategoryIds(
  service: CmsModuleService,
  tenantId: string,
  name?: string
): Promise<string[]> {
  const term = str(name)
  if (!term) return []
  const needle = term.toLowerCase()
  const cats: any[] = await service
    .listCmsBlogCategories({ tenant_id: tenantId }, { take: 200 } as any)
    .catch(() => [])
  const match =
    cats.find((c) => (c.name || "").toLowerCase() === needle) ??
    cats.find((c) => (c.name || "").toLowerCase().includes(needle))
  return match ? [match.id] : []
}

/* ---------------------------- 1. create_blog_post ------------------------ */

const createBlogPost: JarvisWrite = {
  name: "create_blog_post",
  description:
    "Write and save a DRAFT blog post (article) for the merchant's storefront blog. Use whenever the merchant asks to write/draft/create a blog, article or post (e.g. 'write a blog about our summer sale', 'draft an article on how to care for leather'). Give it a title and the body content; it is saved as a DRAFT and is NOT visible to shoppers until it is published with publish_blog_post. Takes a title and the article content.",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "The blog post title / headline." },
      content: {
        type: "string",
        description:
          "The full article body. Plain text or light markdown (#/## headings, - lists, **bold**) is fine — it is converted to the blog's rich HTML format.",
      },
      excerpt: {
        type: "string",
        description: "Optional short summary / teaser shown in blog listings.",
      },
      category: {
        type: "string",
        description: "Optional existing blog category name to file the post under.",
      },
      cover_prompt: {
        type: "string",
        description:
          "Optional: a short visual description to GENERATE an AI cover image for the post (e.g. 'flat lay of summer gifts on linen'). Include it whenever the merchant wants a cover/photo/image with the post. Uses image credits.",
      },
    },
    required: ["title", "content"],
    additionalProperties: false,
  },
  risk: "low",
  tier: "soft",

  async plan(req, ctx, args) {
    const tenantId = ctx.tenant?.id
    if (!tenantId) return { ok: false, error: "Your store isn't fully set up yet." }
    const title = str(args.title)
    if (!title) return { ok: false, error: "Give me a title for the blog post." }
    const html = contentToHtml(str(args.content))
    if (!html) return { ok: false, error: "Give me some content for the blog post." }

    const service = svcOf(req)
    // Validate the slug is free up front (friendly, no mutation).
    try {
      await resolveUniqueSlug(
        (f: any) => service.listCmsBlogPosts(f),
        undefined,
        title,
        undefined,
        tenantId
      )
    } catch (e: any) {
      return { ok: false, error: friendly(e, `A post titled "${title}" already exists.`) }
    }
    const categoryIds = await resolveCategoryIds(service, tenantId, args.category)

    return {
      ok: true,
      human_summary: str(args.cover_prompt)
        ? `Save a draft blog post titled "${title}" with an AI-generated cover image? It stays hidden until you publish it.`
        : `Save a draft blog post titled "${title}"? It stays hidden until you publish it.`,
      details: {
        title,
        excerpt: str(args.excerpt) || null,
        category: categoryIds.length ? str(args.category) : null,
        cover: str(args.cover_prompt) || null,
        preview: preview(html),
      },
      apply_args: {
        title,
        content: html,
        excerpt: str(args.excerpt) || null,
        category_ids: categoryIds,
        cover_prompt: str(args.cover_prompt) || null,
      },
    }
  },

  async apply(req, ctx, applyArgs) {
    const tenantId = ctx.tenant.id
    const service = svcOf(req)
    try {
      const title = str(applyArgs.title)
      const content = String(applyArgs.content ?? "")
      const slug = await resolveUniqueSlug(
        (f: any) => service.listCmsBlogPosts(f),
        undefined,
        title,
        undefined,
        tenantId
      )
      const created = one(
        await service.createCmsBlogPosts({
          tenant_id: tenantId,
          title,
          slug,
          excerpt: applyArgs.excerpt ?? null,
          content,
          status: "draft",
          reading_time: estimateReadingTime(content),
          categories: Array.isArray(applyArgs.category_ids) ? applyArgs.category_ids : [],
        })
      )
      // Optional AI cover — best-effort and metered; its failure (or an
      // empty wallet) never loses the drafted post.
      let coverGenerated = false
      const coverPrompt = str(applyArgs.cover_prompt)
      if (coverPrompt && process.env.NOVITA_API_KEY) {
        const img = await meterAction(req.scope, tenantId, "ai_image", 1, async () => {
          const vendorUrl = await promptToImage(
            process.env.NOVITA_API_KEY as string,
            coverPrompt,
            "landscape"
          )
          const bytes = await fetchBytes(vendorUrl)
          const url = await storeBytes(req.scope, tenantId, "blog-ai-cover", bytes, "image/png")
          return { result: url, actualUnits: 1 }
        }).catch(() => null)
        if (img && (img as any).ok) {
          await service
            .updateCmsBlogPosts({ id: created.id, cover_image: (img as any).result })
            .catch(() => undefined)
          coverGenerated = true
        }
      }
      const post = await service.retrieveCmsBlogPost(created.id, {
        relations: [...BLOG_POST_RELATIONS],
      })
      return {
        result: {
          ok: true,
          id: created.id,
          title,
          slug,
          status: "draft",
          cover_generated: coverGenerated,
          ...(coverPrompt && !coverGenerated
            ? { note: "The cover image could not be generated (possibly out of image credits) — the draft is saved without it." }
            : {}),
        },
        // The draft is safely reversible from the merchant's Blog screen.
        undo: {
          available: false,
          reason: `The draft "${title}" is saved — you can edit or delete it from your Blog page.`,
        },
      }
    } catch (e: any) {
      return {
        result: { ok: false, error: friendly(e, "I couldn't save that blog post.") },
        undo: { available: false, reason: "Nothing was changed." },
      }
    }
  },
}

/* ---------------------------- 2. update_blog_post ------------------------ */

const updateBlogPost: JarvisWrite = {
  name: "update_blog_post",
  description:
    "Edit an existing blog post's title, content or excerpt. Use for 'change the title of my summer sale post', 'rewrite the leather-care article', 'update the excerpt'. Identify the post by its title (or id). This edits the draft copy only — it does NOT publish; use publish_blog_post to push changes live.",
  parameters: {
    type: "object",
    properties: {
      title: {
        type: "string",
        description: "The current title of the post to edit (used to find it).",
      },
      id: { type: "string", description: "The post id, if known (alternative to title)." },
      new_title: { type: "string", description: "A new title, if changing it." },
      content: {
        type: "string",
        description: "New body content (plain text / light markdown). Replaces the existing body.",
      },
      excerpt: { type: "string", description: "New short summary / teaser." },
    },
    additionalProperties: false,
  },
  risk: "low",
  tier: "soft",

  async plan(req, ctx, args) {
    const tenantId = ctx.tenant?.id
    if (!tenantId) return { ok: false, error: "Your store isn't fully set up yet." }
    const service = svcOf(req)
    const found = await resolveBlogPost(service, tenantId, args)
    if (!found.ok) return { ok: false, error: found.error }
    const post = found.post

    const patch: Record<string, any> = {}
    const previous: Record<string, any> = {}
    const changes: string[] = []

    const newTitle = str(args.new_title)
    if (newTitle && newTitle !== post.title) {
      patch.title = newTitle
      previous.title = post.title
      changes.push(`title -> "${newTitle}"`)
    }
    if (args.content != null && str(args.content)) {
      const html = contentToHtml(str(args.content))
      patch.content = html
      patch.reading_time = estimateReadingTime(html)
      previous.content = post.content ?? null
      previous.reading_time = post.reading_time ?? null
      changes.push("body content")
    }
    if (args.excerpt != null) {
      patch.excerpt = str(args.excerpt) || null
      previous.excerpt = post.excerpt ?? null
      changes.push("excerpt")
    }

    if (!changes.length) {
      return { ok: false, error: "Tell me what to change — a new title, content or excerpt." }
    }

    return {
      ok: true,
      human_summary: `Update the blog post "${post.title}" (${changes.join(", ")})?`,
      details: { post: post.title, changes },
      apply_args: { post_id: post.id, patch, previous_patch: previous },
    }
  },

  async apply(req, ctx, applyArgs) {
    const service = svcOf(req)
    const postId = str(applyArgs.post_id)
    const patch = (applyArgs.patch ?? {}) as Record<string, any>
    if (!postId || !Object.keys(patch).length) {
      return {
        result: { ok: false, error: "There was nothing to update." },
        undo: { available: false, reason: "Nothing was changed." },
      }
    }
    try {
      await service.updateCmsBlogPosts({ id: postId, ...patch })
      const previous = applyArgs.previous_patch
      const undo =
        previous && Object.keys(previous).length
          ? {
              action: "update_blog_post",
              apply_args: { post_id: postId, patch: previous, previous_patch: patch },
            }
          : { available: false as const, reason: "There was no previous value to revert to." }
      return { result: { ok: true, id: postId }, undo }
    } catch (e: any) {
      return {
        result: { ok: false, error: friendly(e, "I couldn't update that blog post.") },
        undo: { available: false, reason: "Nothing was changed." },
      }
    }
  },
}

/* ---------------------------- 3. publish_blog_post ----------------------- */

const publishBlogPostTool: JarvisWrite = {
  name: "publish_blog_post",
  description:
    "Publish a blog post so it goes LIVE and is visible to everyone on the storefront blog. Use for 'publish my summer sale post', 'make the leather-care article live', 'put that blog post online'. Identify the post by its title (or id). This makes the post PUBLIC on your live storefront, so it is confirm-gated.",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "The title of the post to publish." },
      id: { type: "string", description: "The post id, if known (alternative to title)." },
    },
    additionalProperties: false,
  },
  risk: "med",
  tier: "hard",
  requireText: "PUBLISH",

  async plan(req, ctx, args) {
    const tenantId = ctx.tenant?.id
    if (!tenantId) return { ok: false, error: "Your store isn't fully set up yet." }
    const service = svcOf(req)
    const found = await resolveBlogPost(service, tenantId, args)
    if (!found.ok) return { ok: false, error: found.error }
    const post = found.post
    if (post.status === "published") {
      return { ok: false, error: `"${post.title}" is already published and live.` }
    }
    if (!str(post.content)) {
      return { ok: false, error: `"${post.title}" has no content yet — add some before publishing.` }
    }
    return {
      ok: true,
      human_summary: `Publish "${post.title}" to your live storefront blog for everyone to see?`,
      details: { post: post.title, slug: post.slug },
      apply_args: { post_id: post.id, title: post.title, unpublish: false },
    }
  },

  async apply(req, ctx, applyArgs) {
    const tenantId = ctx.tenant.id
    const postId = str(applyArgs.post_id)
    if (!postId) {
      return {
        result: { ok: false, error: "That post could no longer be identified." },
        undo: { available: false, reason: "Nothing was changed." },
      }
    }
    const unpublish = applyArgs.unpublish === true
    try {
      if (unpublish) {
        const result = await unpublishBlogPost(req.scope, { postId, tenant_id: tenantId })
        return {
          result: { ok: true, id: postId, status: result.post.status },
          undo: {
            action: "publish_blog_post",
            apply_args: { post_id: postId, title: applyArgs.title, unpublish: false },
          },
        }
      }
      const result = await publishBlogPost(req.scope, { postId, tenant_id: tenantId })
      return {
        result: {
          ok: true,
          id: postId,
          slug: result.post.slug,
          status: result.post.status,
          published_at: result.post.published_at,
        },
        undo: {
          action: "publish_blog_post",
          apply_args: { post_id: postId, title: applyArgs.title, unpublish: true },
        },
      }
    } catch (e: any) {
      return {
        result: { ok: false, error: friendly(e, "I couldn't publish that blog post.") },
        undo: { available: false, reason: "Nothing was changed." },
      }
    }
  },
}

/* ------------------------------ 4. create_page --------------------------- */

const createPage: JarvisWrite = {
  name: "create_page",
  description:
    "Create a simple storefront content PAGE (e.g. About us, Shipping policy, FAQ) with a title and written content. Use for 'create an About page', 'add a shipping policy page', 'make a page about our story'. The page is saved as a DRAFT and is NOT live until you publish it with publish_page. Takes a title and the page content.",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "The page title, e.g. 'About us'." },
      content: {
        type: "string",
        description:
          "The page body. Plain text or light markdown (#/## headings, - lists, **bold**) — converted to a rich-text block.",
      },
      slug: {
        type: "string",
        description: "Optional URL slug, e.g. 'about-us'. Derived from the title when omitted.",
      },
    },
    required: ["title", "content"],
    additionalProperties: false,
  },
  risk: "low",
  tier: "soft",

  async plan(req, ctx, args) {
    const tenantId = ctx.tenant?.id
    if (!tenantId) return { ok: false, error: "Your store isn't fully set up yet." }
    const title = str(args.title)
    if (!title) return { ok: false, error: "Give me a title for the page." }
    const html = contentToHtml(str(args.content))
    if (!html) return { ok: false, error: "Give me some content for the page." }
    const slug = slugify(str(args.slug) || title)
    if (!slug) return { ok: false, error: "I couldn't build a URL slug — give me an explicit slug." }

    const service = svcOf(req)
    const existing = await service
      .listCmsPages({ tenant_id: tenantId, slug })
      .catch(() => [] as any[])
    if (existing?.length) {
      return { ok: false, error: `A page at "/${slug}" already exists.` }
    }

    return {
      ok: true,
      human_summary: `Create a draft page "${title}" at /${slug}? It stays hidden until you publish it.`,
      details: { title, slug, preview: preview(html) },
      apply_args: { title, slug, html },
    }
  },

  async apply(req, ctx, applyArgs) {
    const tenantId = ctx.tenant.id
    const service = svcOf(req)
    const title = str(applyArgs.title)
    const slug = str(applyArgs.slug)
    const html = String(applyArgs.html ?? "")
    try {
      const page = one(
        await service.createCmsPages({
          tenant_id: tenantId,
          title,
          slug,
          is_home: false,
          status: "draft",
          default_locale: "en",
          fallback_locale: "en",
        })
      )
      // One rich_text section carries the body — the same block the starter
      // pages + dashboard editor use, so it renders on every theme + validates.
      await service.createCmsSections({
        tenant_id: tenantId,
        page_id: page.id,
        type: "rich_text",
        rank: 0,
        enabled: true,
        label: "Content",
        data: { html, width: "normal" },
      })
      return {
        result: { ok: true, id: page.id, title, slug, status: "draft" },
        undo: {
          available: false,
          reason: `The draft page "${title}" is saved — you can edit or delete it from your Pages screen.`,
        },
      }
    } catch (e: any) {
      return {
        result: { ok: false, error: friendly(e, "I couldn't create that page.") },
        undo: { available: false, reason: "Nothing was changed." },
      }
    }
  },
}

/* ------------------------------ 5. update_page --------------------------- */

const updatePage: JarvisWrite = {
  name: "update_page",
  description:
    "Edit a storefront page's title or content. Use for 'rename the About page', 'update the text on my shipping policy page', 'rewrite the FAQ page'. Identify the page by its title or slug. This edits the draft only — use publish_page to push the change live.",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "The current title of the page (used to find it)." },
      slug: { type: "string", description: "The page slug, e.g. 'about-us' (alternative to title)." },
      id: { type: "string", description: "The page id, if known." },
      new_title: { type: "string", description: "A new title, if changing it." },
      content: {
        type: "string",
        description: "New body content (plain text / light markdown). Replaces the page's rich-text body.",
      },
    },
    additionalProperties: false,
  },
  risk: "low",
  tier: "soft",

  async plan(req, ctx, args) {
    const tenantId = ctx.tenant?.id
    if (!tenantId) return { ok: false, error: "Your store isn't fully set up yet." }
    const service = svcOf(req)
    const found = await resolvePage(service, tenantId, args)
    if (!found.ok) return { ok: false, error: found.error }
    const page = found.page

    const newTitle = str(args.new_title)
    const hasContent = args.content != null && !!str(args.content)
    if (!newTitle && !hasContent) {
      return { ok: false, error: "Tell me what to change — a new title or new content." }
    }
    const html = hasContent ? contentToHtml(str(args.content)) : null
    const changes: string[] = []
    if (newTitle && newTitle !== page.title) changes.push(`title -> "${newTitle}"`)
    if (html) changes.push("page content")
    if (!changes.length) {
      return { ok: false, error: "That wouldn't change anything on the page." }
    }

    return {
      ok: true,
      human_summary: `Update the page "${page.title}" (${changes.join(", ")})?`,
      details: { page: page.title, slug: page.slug, changes },
      apply_args: {
        page_id: page.id,
        new_title: newTitle && newTitle !== page.title ? newTitle : null,
        html,
      },
    }
  },

  async apply(req, ctx, applyArgs) {
    const tenantId = ctx.tenant.id
    const service = svcOf(req)
    const pageId = str(applyArgs.page_id)
    if (!pageId) {
      return {
        result: { ok: false, error: "That page could no longer be identified." },
        undo: { available: false, reason: "Nothing was changed." },
      }
    }
    try {
      if (applyArgs.new_title) {
        await service.updateCmsPages({ id: pageId, title: str(applyArgs.new_title) })
      }
      if (applyArgs.html) {
        // Update the page's first rich_text section, or add one if none exists.
        const sections: any[] = await service
          .listCmsSections(
            { tenant_id: tenantId, page_id: pageId },
            { order: { rank: "ASC" } } as any
          )
          .catch(() => [])
        const richText = sections.find((s) => s.type === "rich_text")
        if (richText) {
          await service.updateCmsSections({
            id: richText.id,
            data: { ...(richText.data ?? {}), html: String(applyArgs.html), width: (richText.data as any)?.width ?? "normal" },
          })
        } else {
          const nextRank = sections.reduce((m: number, s: any) => Math.max(m, (s.rank ?? 0) + 1), 0)
          await service.createCmsSections({
            tenant_id: tenantId,
            page_id: pageId,
            type: "rich_text",
            rank: nextRank,
            enabled: true,
            label: "Content",
            data: { html: String(applyArgs.html), width: "normal" },
          })
        }
      }
      return {
        result: { ok: true, id: pageId },
        // Content edits overwrite the draft; the previous copy lives in the
        // page's revision history, restorable from the Pages editor.
        undo: {
          available: false,
          reason: "You can restore the previous version from the page's revision history.",
        },
      }
    } catch (e: any) {
      return {
        result: { ok: false, error: friendly(e, "I couldn't update that page.") },
        undo: { available: false, reason: "Nothing was changed." },
      }
    }
  },
}

/* ------------------------------ 6. publish_page -------------------------- */

const publishPage: JarvisWrite = {
  name: "publish_page",
  description:
    "Publish a storefront page so it goes LIVE and shoppers can visit it. Use for 'publish my About page', 'make the shipping policy page live', 'put the FAQ page online'. Identify the page by its title or slug. This makes the page PUBLIC on your live storefront, so it is confirm-gated.",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "The title of the page to publish." },
      slug: { type: "string", description: "The page slug (alternative to title)." },
      id: { type: "string", description: "The page id, if known." },
    },
    additionalProperties: false,
  },
  risk: "med",
  tier: "hard",
  requireText: "PUBLISH",

  async plan(req, ctx, args) {
    const tenantId = ctx.tenant?.id
    if (!tenantId) return { ok: false, error: "Your store isn't fully set up yet." }
    const service = svcOf(req)
    const found = await resolvePage(service, tenantId, args)
    if (!found.ok) return { ok: false, error: found.error }
    const page = found.page
    if (page.status === "archived") {
      return { ok: false, error: `"${page.title}" is archived — restore it before publishing.` }
    }
    return {
      ok: true,
      human_summary: `Publish the page "${page.title}" to your live storefront at /${page.slug}?`,
      details: { page: page.title, slug: page.slug },
      apply_args: { page_id: page.id, title: page.title },
    }
  },

  async apply(req, ctx, applyArgs) {
    const tenantId = ctx.tenant.id
    const service = svcOf(req)
    const pageId = str(applyArgs.page_id)
    if (!pageId) {
      return {
        result: { ok: false, error: "That page could no longer be identified." },
        undo: { available: false, reason: "Nothing was changed." },
      }
    }
    try {
      // Make sure the container is active (archived pages 404 on the store).
      await service.updateCmsPages({ id: pageId, status: "active" }).catch(() => {})
      const result = await publishPageSnapshot(req.scope, {
        pageId,
        tenant_id: tenantId,
        locale: "en" as any,
        published_by: ctx.merchant?.id ?? null,
      })
      if (!result.ok) {
        return {
          result: {
            ok: false,
            error: `I couldn't publish that page — ${result.errors.length} content block(s) need fixing.`,
          },
          undo: { available: false, reason: "Nothing was changed." },
        }
      }
      return {
        result: {
          ok: true,
          id: pageId,
          slug: result.snapshot.slug,
          version: result.snapshot.version,
          published_at: result.snapshot.published_at,
        },
        undo: {
          available: false,
          reason: "To take the page down again, unpublish it from your Pages screen.",
        },
      }
    } catch (e: any) {
      return {
        result: { ok: false, error: friendly(e, "I couldn't publish that page.") },
        undo: { available: false, reason: "Nothing was changed." },
      }
    }
  },
}

/* -------------------------------- registry ------------------------------- */

/**
 * The CONTENT (blog + CMS page) Pixi write tools. Drafting is soft (one-tap);
 * publishing to the public storefront is hard (typed "PUBLISH" confirm). Spread
 * into the shared WRITES registry in _writes.ts.
 */
export const CONTENT_WRITES: JarvisWrite[] = [
  createBlogPost,
  updateBlogPost,
  publishBlogPostTool,
  createPage,
  updatePage,
  publishPage,
]
