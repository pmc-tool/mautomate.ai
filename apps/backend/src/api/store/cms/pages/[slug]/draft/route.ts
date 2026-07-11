import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { CMS_MODULE } from "../../../../../../modules/cms"
import { cmsTenantId } from "../../../../../../modules/cms/tenant-scope"
import type CmsModuleService from "../../../../../../modules/cms/service"
import {
  compilePageSnapshot,
  PUBLISH_PAGE_RELATIONS,
} from "../../../../../../modules/cms/publish-helper"
import { verifyPreviewToken } from "../../../../../../modules/cms/preview-token"
import {
  DEFAULT_LOCALE,
  isLocale,
  type Locale,
} from "../../../../../../modules/cms/types"

/**
 * GET /store/cms/pages/:slug/draft?token=...&lang=bn   (phase-6 preview)
 *
 * Token-gated DRAFT read. Compiles the CURRENT cms_page DRAFT (page meta +
 * enabled sections in rank order, each deep-merged with its locale translation)
 * using the SAME `compilePageSnapshot` the publish pipeline uses — but WITHOUT
 * writing a snapshot. The response shape mirrors the live store read
 * (`/store/cms/pages/:slug`) so the storefront renders a preview identically.
 *
 * Auth: a signed HMAC preview token (covers slug + locale + exp,
 * CMS_PREVIEW_SECRET, constant-time compare). No token / bad token / wrong
 * locale / expired ⇒ 401. The `locale` query param is reserved & stripped by
 * Medusa, so the locale is read from the `x-medusa-locale` header (sent by the
 * storefront SDK) or the non-reserved `lang` param, then verified against the
 * token claims.
 *
 * Response: { page: { ...compiled, slug, locale, resolved_locale, version: null, draft: true } }
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const service: CmsModuleService = req.scope.resolve(CMS_MODULE)
  const slug = req.params.slug

  // Locale (never from the reserved `locale` query param).
  const requestedRaw =
    (req.headers["x-medusa-locale"] as string) ??
    (req.query.lang as string) ??
    (req.query.locale as string) ??
    DEFAULT_LOCALE
  const locale: Locale = isLocale(requestedRaw) ? requestedRaw : DEFAULT_LOCALE

  // Token gate. The signature binds the token to this exact (slug, locale).
  const token = (req.query.token as string) ?? ""
  const verified = verifyPreviewToken(token, { slug, locale })
  if (!verified.ok) {
    throw new MedusaError(
      MedusaError.Types.UNAUTHORIZED,
      `Invalid preview token: ${verified.reason}.`
    )
  }

  // Pooled multi-tenant: bind the preview to the requesting store so a token for
  // one store's slug can never render another store's draft. Fail-closed.
  const tenantId = await cmsTenantId(req)
  if (!tenantId) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `No page found for slug "${slug}".`
    )
  }

  // Load the current draft tree (NOT a snapshot).
  const pages = await service.listCmsPages(
    { tenant_id: tenantId, slug },
    { relations: [...PUBLISH_PAGE_RELATIONS], take: 1 }
  )
  const page = pages?.[0]
  if (!page) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `No page found for slug "${slug}".`
    )
  }

  // Compile + validate the draft for the requested locale (no snapshot write).
  const compiled = compilePageSnapshot(page, locale)
  if (!compiled.ok) {
    res.status(422).json({
      type: "invalid_data",
      message: `Cannot preview: ${compiled.errors.length} block validation error(s).`,
      errors: compiled.errors,
    })
    return
  }

  // Same shape as the live read; no snapshot ⇒ version is null, flagged draft.
  const data = compiled.data as Record<string, unknown>
  res.json({
    page: {
      ...data,
      slug,
      locale,
      resolved_locale: locale,
      version: null,
      draft: true,
    },
  })
}
