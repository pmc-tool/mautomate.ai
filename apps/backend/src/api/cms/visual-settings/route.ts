import crypto from "crypto"
import { MedusaError } from "@medusajs/framework/utils"
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CMS_MODULE } from "../../../modules/cms"
import { requireWriteTenant } from "../../../modules/cms/tenant-scope"
import type CmsModuleService from "../../../modules/cms/service"
import { emitCmsPublished } from "../../../modules/cms/publish-helper"
import { isSettingKey } from "../../../modules/cms/types"

/**
 * POST /cms/visual-settings   (secret-gated, server-to-server)
 *
 * The chrome (header/topbar/footer/theme/seo_defaults) publish path for the
 * visual editor. Body: { key, data } where `data` is the resolved EN settings
 * object for that key. Stored as the `en` slice of the setting's locale-map
 * (any `bn` sparse overrides are preserved), then cms.published is emitted so
 * the storefront revalidates `cms-settings`.
 */
function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a, "utf8").digest()
  const hb = crypto.createHash("sha256").update(b, "utf8").digest()
  return crypto.timingSafeEqual(Uint8Array.from(ha), Uint8Array.from(hb))
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const provided = req.headers["x-cms-secret"]
  const expected = process.env.CMS_REVALIDATE_SECRET
  if (!expected || typeof provided !== "string" || !safeEqual(provided, expected)) {
    throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "Invalid secret.")
  }

  const body = (req.body ?? {}) as { key?: string; data?: Record<string, unknown> }
  const key = body.key
  const data = body.data

  if (!key || !isSettingKey(key)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Invalid setting key "${key}".`
    )
  }
  if (!data || typeof data !== "object") {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "`data` is required.")
  }

  const service: CmsModuleService = req.scope.resolve(CMS_MODULE)
  // Trusted storefront proxy asserts the tenant (secret-gated). Fail-closed.
  const tenantId = await requireWriteTenant(req)
  const rows = await service.listCmsSettings({ key, tenant_id: tenantId })
  const existing = rows?.[0] as any
  const before = existing?.data ?? null
  const nextData = { ...(existing?.data ?? {}), en: data }

  if (existing) {
    await service.updateCmsSettings({ id: existing.id, data: nextData })
  } else {
    await service.createCmsSettings({ key, data: nextData, tenant_id: tenantId })
  }

  // Audit (best-effort, non-blocking).
  try {
    await service.createCmsAuditLogs({
      tenant_id: tenantId,
      actor_id: "visual-editor",
      actor_email: null,
      action: existing ? "setting.update" : "setting.create",
      entity_type: "global_setting",
      entity_key: key,
      before,
      after: nextData,
    })
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[cms] visual-settings audit failed (non-blocking):", e)
  }

  await emitCmsPublished(req.scope, {
    entity_type: "global",
    slug: key,
    locale: null,
    tenant_id: tenantId,
  })

  res.json({ ok: true, key })
}
