import { MedusaError, Modules } from "@medusajs/framework/utils"
import type { MedusaRequest } from "@medusajs/framework/http"
import { CMS_MODULE } from "../../../../modules/cms"
import type CmsModuleService from "../../../../modules/cms/service"
import {
  isSettingKey,
  type LocaleMap,
  type SettingDataMap,
  type SettingKey,
} from "../../../../modules/cms/types"
import { emitCmsPublished } from "../../../../modules/cms/publish-helper"

/**
 * Shared helpers for the admin settings routes. Files that are not `route.ts`
 * or `middlewares.ts` are ignored by Medusa's file-based router, so this module
 * is import-only (the leading underscore makes that doubly explicit).
 */

export type CmsActor = {
  user_id: string
  actor_type: string
  email: string | null
}

/**
 * Resolve the acting admin from the framework auth context. The global `/admin`
 * `authenticate` middleware populates `req.auth_context`. Email is denormalized
 * best-effort from the User module (recorded as it was at write time).
 */
export async function getActor(req: MedusaRequest): Promise<CmsActor> {
  const auth = (req as any).auth_context ?? {}
  const actorId: string | undefined = auth.actor_id
  const actorType: string = auth.actor_type ?? "unknown"

  if (!actorId) {
    throw new MedusaError(
      MedusaError.Types.UNAUTHORIZED,
      "Authentication required."
    )
  }

  let email: string | null = auth.app_metadata?.email ?? null
  if (!email && actorType === "user") {
    try {
      const userModule: any = req.scope.resolve(Modules.USER)
      const user = await userModule.retrieveUser(actorId)
      email = user?.email ?? null
    } catch {
      email = null
    }
  }

  return { user_id: actorId, actor_type: actorType, email }
}

export function assertSettingKey(key: string): SettingKey {
  if (!isSettingKey(key)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Unknown setting key "${key}". Valid keys: header, topbar, footer, theme, seo_defaults.`
    )
  }
  return key
}

/** Find the single setting row for a key (or null). */
export async function findSetting<K extends SettingKey>(
  service: CmsModuleService,
  key: K,
  tenantId: string | null
): Promise<{ id: string; key: K; data: LocaleMap<SettingDataMap[K]> } | null> {
  const rows = await service.listCmsSettings({ key, tenant_id: tenantId })
  return (rows?.[0] as any) ?? null
}

/**
 * Upsert the singleton row for `key` and write a cms_audit_log row.
 * Returns the persisted setting. Audit is best-effort and must never block the
 * business write — its failure is swallowed (logged) per §8.3.
 */
export async function upsertSettingWithAudit<K extends SettingKey>(
  req: MedusaRequest,
  service: CmsModuleService,
  key: K,
  nextData: LocaleMap<SettingDataMap[K]>,
  tenantId: string | null
): Promise<{ id: string; key: K; data: LocaleMap<SettingDataMap[K]> }> {
  const existing = await findSetting(service, key, tenantId)
  const before = existing?.data ?? null

  let saved: any
  if (existing) {
    saved = await service.updateCmsSettings({
      id: existing.id,
      data: nextData,
    })
  } else {
    saved = await service.createCmsSettings({
      key,
      data: nextData,
      tenant_id: tenantId,
    })
  }
  // createCmsSettings can return an array; normalize.
  const setting = Array.isArray(saved) ? saved[0] : saved

  // Audit (best-effort, non-blocking).
  try {
    const actor = await getActor(req)
    await service.createCmsAuditLogs({
      tenant_id: tenantId,
      actor_id: actor.user_id,
      actor_email: actor.email,
      action: existing ? "setting.update" : "setting.create",
      entity_type: "global_setting",
      entity_key: key,
      before,
      after: nextData,
    })
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[cms] audit log write failed (non-blocking):", e)
  }

  // Emit cms.published so the storefront revalidates the global `cms-settings`
  // tag. Settings are locale-invariant locale-maps, so locale is null and the
  // subscriber keys the revalidation off entity_type === "global". Best-effort.
  await emitCmsPublished(req.scope, {
    entity_type: "global",
    slug: key,
    locale: null,
    tenant_id: tenantId,
  })

  return setting
}
