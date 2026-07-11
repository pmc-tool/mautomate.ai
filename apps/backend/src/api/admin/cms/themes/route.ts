import { MedusaError } from "@medusajs/framework/utils"
import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { CMS_MODULE } from "../../../../modules/cms"
import {
  cmsTenantId,
  requireWriteTenant,
} from "../../../../modules/cms/tenant-scope"
import type CmsModuleService from "../../../../modules/cms/service"
import { emitCmsPublished } from "../../../../modules/cms/publish-helper"
import { getActor } from "../settings/_helpers"
import { publicOrigin } from "../visual-editor/route"
import {
  catalogWithPreviewUrls,
  DEFAULT_THEME_ID,
  isKnownTheme,
} from "./_catalog"

const ACTIVE_THEME_KEY = "active_theme"

/** Read the currently active theme id (defaults to learts when unset). */
async function readActiveTheme(
  service: CmsModuleService,
  tenantId: string | null
): Promise<string> {
  const rows = await service.listCmsSettings({
    key: ACTIVE_THEME_KEY,
    tenant_id: tenantId,
  })
  const value = (rows?.[0] as any)?.data?.value
  return typeof value === "string" && isKnownTheme(value)
    ? value
    : DEFAULT_THEME_ID
}

/**
 * GET /admin/cms/themes
 * Returns the selectable theme catalog (with absolute preview URLs) and the
 * currently active theme id.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const service: CmsModuleService = req.scope.resolve(CMS_MODULE)
  const storefrontUrl =
    publicOrigin(req) || process.env.STOREFRONT_URL || "http://localhost:8000"

  const tenantId = await cmsTenantId(req)
  const active = await readActiveTheme(service, tenantId)

  res.json({
    themes: catalogWithPreviewUrls(storefrontUrl),
    active,
  })
}

/**
 * POST /admin/cms/themes  { id: string }
 * Activate a theme: validate the id against the catalog, upsert the
 * locale-invariant `active_theme` setting row, audit, and emit cms.published so
 * the storefront revalidates `cms-settings` and re-renders with the new theme.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const service: CmsModuleService = req.scope.resolve(CMS_MODULE)
  const id = (req.body as { id?: string })?.id

  if (!id || !isKnownTheme(id)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Unknown theme "${id}". Activate one of the catalog themes.`
    )
  }

  const tenantId = await requireWriteTenant(req)
  const rows = await service.listCmsSettings({
    key: ACTIVE_THEME_KEY,
    tenant_id: tenantId,
  })
  const existing = rows?.[0] as any
  const before = existing?.data ?? null
  const nextData = { value: id }

  if (existing) {
    await service.updateCmsSettings({ id: existing.id, data: nextData })
  } else {
    await service.createCmsSettings({
      key: ACTIVE_THEME_KEY,
      data: nextData,
      tenant_id: tenantId,
    })
  }

  // Audit (best-effort, non-blocking).
  try {
    const actor = await getActor(req)
    await service.createCmsAuditLogs({
      actor_id: actor.user_id,
      actor_email: actor.email,
      action: "theme.activate",
      entity_type: "global_setting",
      entity_key: ACTIVE_THEME_KEY,
      before,
      after: nextData,
    })
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[cms] theme audit write failed (non-blocking):", e)
  }

  // Theme SWITCH -> reset the home to the newly-activated theme's demo. A
  // published home snapshot overrides the theme's `defaultSections` fallback
  // (and may contain blocks the new theme can't render), so on a REAL switch we
  // demote the live home snapshot(s) — they stay in history and are restorable —
  // and the storefront then renders the new theme's demo home. Re-activating the
  // same theme does NOT touch the home.
  const prevTheme = (before as { value?: string } | null)?.value ?? null
  if (prevTheme !== id) {
    try {
      const liveHomes = (await service.listCmsSnapshots({
        tenant_id: tenantId,
        entity_type: "page",
        slug: "home",
        is_live: true,
      })) as any[]
      for (const h of liveHomes ?? []) {
        await service.updateCmsSnapshots({ id: h.id, is_live: false })
      }
      if (liveHomes?.length) {
        await emitCmsPublished(req.scope, {
          entity_type: "page",
          slug: "home",
          locale: null,
          tenant_id: tenantId,
        })
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[cms] theme-switch home reset failed (non-blocking):", e)
    }
  }

  // Revalidate the storefront chrome (active_theme rides the cms-settings tag).
  await emitCmsPublished(req.scope, {
    entity_type: "global",
    slug: ACTIVE_THEME_KEY,
    locale: null,
    tenant_id: tenantId,
  })

  res.json({ active: id })
}
