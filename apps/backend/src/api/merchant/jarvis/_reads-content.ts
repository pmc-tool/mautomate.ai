import { MedusaRequest } from "@medusajs/framework/http"
import type { AiToolDefinition } from "../../../modules/marketing/ai/ai-provider"
import { CMS_MODULE } from "../../../modules/cms"
import type CmsModuleService from "../../../modules/cms/service"

/**
 * Pixi — CONTENT READ-ONLY tools (blog posts + CMS pages).
 *
 * Same contract as _tools.ts / _tools-more.ts: every handler is tenant-scoped
 * through `ctx` (the tenant is NEVER read from the model's arguments) and NEVER
 * throws — a failure returns `{ error }` the model can read and explain, so a
 * broken tool degrades the answer instead of breaking the run. These reads give
 * Pixi the ability to FIND posts/pages to then act on with the CONTENT write
 * tools (create/update/publish). They need no confirm gate.
 */

type Ctx = { tenant: any; merchant: any; svc: any }

const svcOf = (req: MedusaRequest): CmsModuleService =>
  req.scope.resolve(CMS_MODULE)

const clampLimit = (v: any, def: number, max: number) =>
  Math.max(1, Math.min(max, Math.floor(Number(v)) || def))

/* ----------------------------- list_blog_posts --------------------------- */

/**
 * The store's most recent blog posts with their status — draft vs published —
 * so the model can find a post to edit or publish. Tenant-scoped; optional
 * status filter ("draft" | "published") and free-text title/slug search.
 */
export async function listBlogPosts(
  req: MedusaRequest,
  ctx: Ctx,
  args: { status?: string; query?: string; limit?: number }
) {
  const tenantId = ctx.tenant?.id
  if (!tenantId) return { count: 0, posts: [] }
  try {
    const service = svcOf(req)
    const limit = clampLimit(args.limit, 10, 50)
    const filters: Record<string, unknown> = { tenant_id: tenantId }
    const status = String(args.status ?? "").trim().toLowerCase()
    if (status === "draft" || status === "published") filters.status = status
    const q = String(args.query ?? "").trim()
    if (q) {
      filters.$or = [
        { title: { $ilike: `%${q}%` } },
        { slug: { $ilike: `%${q}%` } },
      ]
    }
    const [posts, count] = await service.listAndCountCmsBlogPosts(filters, {
      take: limit,
      order: { created_at: "DESC" },
      relations: ["categories"],
    })
    return {
      count,
      posts: (posts || []).map((p: any) => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        status: p.status,
        excerpt: p.excerpt ?? null,
        categories: (p.categories || []).map((c: any) => c.name).filter(Boolean),
        published_at: p.published_at ?? null,
        updated_at: p.updated_at ?? null,
      })),
    }
  } catch (e: any) {
    return { error: e?.message || "could not read blog posts" }
  }
}

/* -------------------------------- list_pages ----------------------------- */

/**
 * The store's CMS storefront pages (About, policies, etc.) with their status —
 * draft vs active (live) vs archived — so the model can find a page to edit or
 * publish. Tenant-scoped; optional status filter and title/slug search.
 */
export async function listPages(
  req: MedusaRequest,
  ctx: Ctx,
  args: { status?: string; query?: string; limit?: number }
) {
  const tenantId = ctx.tenant?.id
  if (!tenantId) return { count: 0, pages: [] }
  try {
    const service = svcOf(req)
    const limit = clampLimit(args.limit, 20, 50)
    const filters: Record<string, unknown> = { tenant_id: tenantId }
    const status = String(args.status ?? "").trim().toLowerCase()
    if (["draft", "active", "archived"].includes(status)) filters.status = status
    const q = String(args.query ?? "").trim()
    if (q) {
      filters.$or = [
        { title: { $ilike: `%${q}%` } },
        { slug: { $ilike: `%${q}%` } },
      ]
    }
    const [pages, count] = await service.listAndCountCmsPages(filters, {
      take: limit,
      order: { updated_at: "DESC" },
    })
    return {
      count,
      pages: (pages || []).map((p: any) => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        status: p.status,
        is_home: p.is_home ?? false,
        updated_at: p.updated_at ?? null,
      })),
    }
  } catch (e: any) {
    return { error: e?.message || "could not read pages" }
  }
}

/* -------------------------------- registry ------------------------------- */

export const CONTENT_TOOL_DEFS: AiToolDefinition[] = [
  {
    name: "list_blog_posts",
    description:
      "List the store's recent blog posts with their status (draft or published). Use to find a post to edit or publish, or to answer 'what blog posts do I have', 'do I have any drafts', 'is my summer sale post published'. Optional status filter and title search.",
    parameters: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["draft", "published"],
          description: "Only return posts in this state.",
        },
        query: { type: "string", description: "Search posts by title or slug." },
        limit: { type: "number", description: "How many posts (1-50, default 10)." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "list_pages",
    description:
      "List the store's CMS pages (About, policies, FAQ, etc.) with their status (draft, active/live, or archived). Use to find a page to edit or publish, or to answer 'what pages do I have', 'is my About page live'. Optional status filter and title search.",
    parameters: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["draft", "active", "archived"],
          description: "Only return pages in this state.",
        },
        query: { type: "string", description: "Search pages by title or slug." },
        limit: { type: "number", description: "How many pages (1-50, default 20)." },
      },
      additionalProperties: false,
    },
  },
]

/** Short human label for the live "Pixi is doing X" stream event. */
export const CONTENT_TOOL_LABELS: Record<string, string> = {
  list_blog_posts: "Looking up your blog posts",
  list_pages: "Looking up your pages",
}

/** Dispatch one CONTENT read tool call -> its JSON-serialisable result. Never throws. */
export async function runContentTool(
  req: MedusaRequest,
  ctx: Ctx,
  name: string,
  args: Record<string, any>
): Promise<unknown> {
  const a = args ?? {}
  try {
    switch (name) {
      case "list_blog_posts":
        return await listBlogPosts(req, ctx, a)
      case "list_pages":
        return await listPages(req, ctx, a)
      default:
        return { error: "unknown" }
    }
  } catch (e: any) {
    return { error: e?.message || "tool failed" }
  }
}
