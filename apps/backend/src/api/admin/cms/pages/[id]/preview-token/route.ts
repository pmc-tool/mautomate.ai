import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { CMS_MODULE } from "../../../../../../modules/cms"
import { requireWriteTenant } from "../../../../../../modules/cms/tenant-scope"
import type CmsModuleService from "../../../../../../modules/cms/service"
import {
  buildPreviewUrl,
  signPreviewToken,
} from "../../../../../../modules/cms/preview-token"
import { assertLocale } from "../../_helpers"
import { publicOrigin } from "../../../visual-editor/route"

/**
 * POST /admin/cms/pages/:id/preview-token?locale=en   (locale may also be in body)
 *
 * Mints a short-lived signed preview token + the storefront preview-entry URL
 * the admin "Preview" button opens. The token (HMAC of slug + locale + exp,
 * CMS_PREVIEW_SECRET) authorizes the token-gated `/store/cms/pages/:slug/draft`
 * read; opening the returned URL enables Next draftMode on the storefront.
 *
 * Denies with 503 when CMS_PREVIEW_SECRET is unset (deny-by-default — the signer
 * throws, which we map rather than leak an insecure default).
 *
 * Response: { token, url, exp, slug, locale }
 */
export const POST = async (
  req: AuthenticatedMedusaRequest<{ locale?: string }>,
  res: MedusaResponse
) => {
  const service: CmsModuleService = req.scope.resolve(CMS_MODULE)
  const { id } = req.params

  // Pooled multi-tenant: minting a preview token is a trusted-principal action
  // and must be scoped to the owning store. Fail-closed.
  const tenantId = await requireWriteTenant(req)

  const rawLocale =
    (req.query.locale as string | undefined) ?? req.body?.locale ?? "en"
  const locale = assertLocale(rawLocale)

  // Resolve the page slug (the token & draft read key off slug, not id). The
  // page must belong to this store — a cross-tenant id is treated as not-found.
  let page: any = null
  try {
    page = await service.retrieveCmsPage(id)
  } catch {
    page = null
  }
  if (!page || (page.tenant_id ?? null) !== tenantId) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Page with id "${id}" was not found.`
    )
  }

  let token: string
  let exp: number
  try {
    ;({ token, exp } = signPreviewToken(page.slug, locale))
  } catch (e) {
    // CMS_PREVIEW_SECRET missing ⇒ deny rather than mint an insecure token.
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Preview is not configured: CMS_PREVIEW_SECRET is not set."
    )
  }

  res.status(200).json({
    token,
    url: buildPreviewUrl(token, page.slug, locale, publicOrigin(req)),
    exp,
    slug: page.slug,
    locale,
  })
}
