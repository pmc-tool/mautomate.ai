import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { CMS_MODULE } from "../../../../modules/cms"
import {
  cmsTenantId,
  requireWriteTenant,
} from "../../../../modules/cms/tenant-scope"
import type CmsModuleService from "../../../../modules/cms/service"
import { one, recordPageAudit, slugify } from "./_helpers"

/**
 * GET /admin/cms/pages
 * List page containers (DRAFT roots), paginated. Query: q?, status?, limit,
 * offset. Returns shallow rows (no sections) — use GET /pages/:id for the tree.
 *
 * Response: { pages, count, limit, offset }
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const service: CmsModuleService = req.scope.resolve(CMS_MODULE)

  const q = (req.query.q as string | undefined)?.trim()
  const status = req.query.status as string | undefined
  const limit = Math.min(Number(req.query.limit ?? 50) || 50, 200)
  const offset = Number(req.query.offset ?? 0) || 0

  // Pooled multi-tenant: scope the listing to the acting store. Fail-closed —
  // an unresolved tenant sees an empty list, never another store's pages.
  const tenantId = await cmsTenantId(req)
  if (!tenantId) {
    res.json({ pages: [], count: 0, limit, offset })
    return
  }

  const filters: Record<string, unknown> = { tenant_id: tenantId }
  if (status) {
    filters.status = status
  }
  if (q) {
    // Searchable title (DML .searchable()) + slug contains.
    filters.$or = [
      { title: { $ilike: `%${q}%` } },
      { slug: { $ilike: `%${q}%` } },
    ]
  }

  const [pages, count] = await service.listAndCountCmsPages(filters, {
    take: limit,
    skip: offset,
    order: { updated_at: "DESC" },
  })

  res.json({ pages, count, limit, offset })
}

type CreateBody = {
  title?: string
  slug?: string
  is_home?: boolean
  status?: "draft" | "active" | "archived"
  default_locale?: string
  fallback_locale?: string
  seo_title?: string | null
  seo_description?: string | null
  seo_keywords?: string | null
  og_image?: string | null
  canonical_url?: string | null
}

/**
 * POST /admin/cms/pages
 * Create a new page container (empty draft, no sections). Slug is derived from
 * the title when omitted, and a uniqueness pre-check yields a friendly 422
 * before the DB partial-unique index would reject it.
 *
 * Body: { title, slug?, is_home?, status?, ...seo? }  Response: { page }
 */
export const POST = async (
  req: AuthenticatedMedusaRequest<CreateBody>,
  res: MedusaResponse
) => {
  const service: CmsModuleService = req.scope.resolve(CMS_MODULE)
  const body = req.body ?? {}

  // Pooled multi-tenant: writes bind to the authenticated store. Fail-closed.
  const tenantId = await requireWriteTenant(req)

  const title = (body.title ?? "").trim()
  if (!title) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "`title` is required to create a page."
    )
  }

  const slug = (body.slug?.trim() || slugify(title)) || ""
  if (!slug) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Could not derive a valid slug — provide an explicit `slug`."
    )
  }

  // Friendly uniqueness pre-check (the DB partial-unique index is the hard guard).
  const existing = await service.listCmsPages({ tenant_id: tenantId, slug })
  if (existing?.length) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `A page with slug "${slug}" already exists.`
    )
  }

  const created = one(
    await service.createCmsPages({
      tenant_id: tenantId,
      title,
      slug,
      is_home: body.is_home ?? false,
      status: body.status ?? "draft",
      default_locale: body.default_locale ?? "en",
      fallback_locale: body.fallback_locale ?? "en",
      seo_title: body.seo_title ?? null,
      seo_description: body.seo_description ?? null,
      seo_keywords: body.seo_keywords ?? null,
      og_image: body.og_image ?? null,
      canonical_url: body.canonical_url ?? null,
    })
  )

  await recordPageAudit(req, service, "page.create", "page", created.id, {
    after: created,
  })

  res.status(201).json({ page: created })
}
