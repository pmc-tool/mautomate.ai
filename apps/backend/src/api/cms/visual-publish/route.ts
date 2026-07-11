import crypto from "crypto"
import { MedusaError } from "@medusajs/framework/utils"
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CMS_MODULE } from "../../../modules/cms"
import { requireWriteTenant } from "../../../modules/cms/tenant-scope"
import type CmsModuleService from "../../../modules/cms/service"
import {
  compilePageSnapshot,
  emitCmsPublished,
} from "../../../modules/cms/publish-helper"
import { isLocale, DEFAULT_LOCALE, type Locale } from "../../../modules/cms/types"

/**
 * POST /cms/visual-publish   (secret-gated, server-to-server)
 *
 * The bridge the storefront's visual editor (Puck) publishes through. Body:
 *   { slug, locale, sections: [{ block_type, ...data }] }
 *
 * Flow (reuses the SAME pipeline as the form editor so revisions, validation
 * and on-demand revalidation all apply):
 *   1. auth: x-cms-secret must equal CMS_REVALIDATE_SECRET,
 *   2. validate the incoming blocks by compiling a pseudo-page — on failure
 *      return 422 WITHOUT mutating any draft (non-destructive),
 *   3. publish the compiled payload DIRECTLY as a new snapshot
 *      (service.publishSnapshot — version++/demote/insert) + emit cms.published
 *      so the storefront revalidates.
 *
 * NOTE: non-destructive — it does NOT mutate the page's draft section rows, so
 * the visual editor publishes snapshots independently of the form editor's
 * draft. Bi-directional draft sync (so both editors share one draft) is a
 * follow-up; for now the visual editor is a direct-to-live snapshot surface.
 */
/** Constant-time secret compare (hash first so length isn't leaked). */
function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a, "utf8").digest()
  const hb = crypto.createHash("sha256").update(b, "utf8").digest()
  return crypto.timingSafeEqual(Uint8Array.from(ha), Uint8Array.from(hb))
}

/** Hard cap on blocks per page — bounds payload size / compile work. */
const MAX_SECTIONS = 200

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const provided = req.headers["x-cms-secret"]
  const expected = process.env.CMS_REVALIDATE_SECRET
  if (
    !expected ||
    typeof provided !== "string" ||
    !safeEqual(provided, expected)
  ) {
    throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "Invalid secret.")
  }

  const body = (req.body ?? {}) as {
    slug?: string
    locale?: string
    sections?: { block_type: string; [k: string]: unknown }[]
  }
  const slug = body.slug
  const locale: Locale = isLocale(body.locale) ? body.locale : DEFAULT_LOCALE
  const incoming = Array.isArray(body.sections) ? body.sections : []

  if (!slug || typeof slug !== "string") {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "`slug` is required.")
  }
  if (incoming.length > MAX_SECTIONS) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Too many sections (${incoming.length} > ${MAX_SECTIONS}).`
    )
  }
  if (incoming.some((b) => !b || typeof b.block_type !== "string")) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Every section must have a string block_type."
    )
  }

  const service: CmsModuleService = req.scope.resolve(CMS_MODULE)

  // Pooled multi-tenant: bind this publish to the store the TRUSTED storefront
  // proxy asserted (secret-gated -> x-tenant-pak). Fail-closed — never a shared
  // row, and a bare pak with no secret grants nothing (requireWriteTenant).
  const tenantId = await requireWriteTenant(req)

  let page = (await service.listCmsPages({ tenant_id: tenantId, slug }))?.[0] as any
  if (page && (page.tenant_id ?? null) !== tenantId) {
    // Defensive: never publish over a page owned by a different store.
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "This page belongs to a different store."
    )
  }
  if (!page) {
    // First publish to this slug — create the page (enables new pages from the
    // visual editor). "home" keeps its is_home flag.
    const created = await service.createCmsPages({
      tenant_id: tenantId,
      slug,
      title: slug === "home" ? "Home" : slug,
      is_home: slug === "home",
    })
    page = Array.isArray(created) ? created[0] : created
  }

  // 2. Validate + compile a pseudo-page (no DB mutation).
  const pseudoSections = incoming.map((b, i) => {
    const { block_type, ...data } = b
    return { id: `tmp-${i}`, type: block_type, rank: i, enabled: true, data, translations: [] }
  })
  const compiled = compilePageSnapshot({ ...page, sections: pseudoSections }, locale)
  if (!compiled.ok) {
    return res.status(422).json({ type: "invalid_data", errors: compiled.errors })
  }

  // 3. Publish the compiled payload directly as a new snapshot (version++/
  //    demote prior live/insert), then revalidate the storefront.
  const snapshot = await service.publishSnapshot({
    tenant_id: tenantId,
    entity_type: "page",
    entity_id: page.id,
    slug,
    locale,
    data: compiled.data,
    published_by: "visual-editor",
  })

  await emitCmsPublished(req.scope, {
    entity_type: "page",
    slug,
    locale,
    tenant_id: tenantId,
  })

  // Publish succeeded -> the autosave draft is now redundant; clear it so the
  // editor next opens from the freshly-published snapshot (not a stale draft).
  try {
    const d = (await (service as any).listCmsPageDrafts(
      { tenant_id: tenantId, slug, locale },
      { take: 1 }
    ))?.[0]
    if (d) await (service as any).deleteCmsPageDrafts(d.id)
  } catch {
    // non-fatal: a leftover draft is harmless (it just equals what we published)
  }

  res.json({
    published: true,
    slug,
    locale,
    version: (snapshot as any)?.version,
  })
}
