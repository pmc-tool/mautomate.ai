import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PLATFORM_MODULE } from "../../../../modules/platform"

const slugify = (s: string) =>
  String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80)

/** GET /admin/platform/blog — all posts (draft + published), newest first. */
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const svc: any = req.scope.resolve(PLATFORM_MODULE)
  const posts = await svc.listBlogPosts({}, { order: { created_at: "DESC" }, take: 500 })
  // Console UI expects `content`; DB stores `body`. Mirror both names.
  res.json({
    posts: (posts || []).map((p: any) => ({
      ...p,
      content: p.body ?? "",
    })),
  })
}

/** POST /admin/platform/blog — create a post. */
export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const svc: any = req.scope.resolve(PLATFORM_MODULE)
  const b = (req.body ?? {}) as any
  if (!b.title) return res.status(400).json({ message: "title required" })
  const slug = slugify(b.slug || b.title) || "post-" + Date.now().toString(36)
  const dup = await svc.listBlogPosts({ slug }, { take: 1 })
  if (dup.length) return res.status(409).json({ message: `slug "${slug}" already exists` })
  const bodyText = typeof b.content === "string" ? b.content : (b.body || "")
  const [row] = await svc.createBlogPosts([{
    slug, title: b.title, excerpt: b.excerpt || null, body: bodyText,
    status: b.status === "published" ? "published" : "draft",
    published_at: b.status === "published" ? new Date() : null,
  }])
  res.status(201).json({ ...row, content: row.body ?? "" })
}
