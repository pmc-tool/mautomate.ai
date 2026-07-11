import { resolveTenantId } from "../../../../lib/tenant-context"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { SettingsService } from "../../../../modules/marketing/settings/settings-service"

const TENANT_ID = resolveTenantId("MARKETING_DEFAULT_TENANT")

/**
 * Commerce automations catalog — the single place the known automations are
 * enumerated. Each maps a commerce event (handled by a subscriber under
 * src/subscribers/) to a durable on/off toggle stored in marketing settings.
 * Toggles default OFF: nothing auto-drafts until a human turns it on here.
 */
const AUTOMATIONS: {
  key: string
  settingKey: string
  label: string
  description: string
}[] = [
  {
    key: "new_product",
    settingKey: "automation_new_product",
    label: "New product announcement",
    description:
      "When a product is created, draft a 'new arrival' post for review in the Post Hub.",
  },
  {
    key: "low_stock",
    settingKey: "automation_low_stock",
    label: "Low-stock last chance",
    description:
      "When a product's available stock drops to the low threshold, draft a 'last chance' post for review.",
  },
]

const byKey = (key: unknown) =>
  AUTOMATIONS.find((a) => a.key === key || a.settingKey === key)

/** Read every toggle (default false) and shape the client-facing list. */
const readAutomations = async (settings: SettingsService) => {
  return Promise.all(
    AUTOMATIONS.map(async (a) => ({
      key: a.key,
      label: a.label,
      description: a.description,
      enabled:
        (await settings.get<boolean>(TENANT_ID, a.settingKey, false)) === true,
    }))
  )
}

/**
 * GET /admin/marketing/automations
 *
 * List the known commerce automations with their current enabled state.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const settings = new SettingsService(req.scope)
    const automations = await readAutomations(settings)
    res.json({ automations })
  } catch (e: any) {
    res.status(500).json({
      message: e?.message ?? "Failed to load automations.",
    })
  }
}

/**
 * POST /admin/marketing/automations
 *
 * Body: { key, enabled }. Flip a single automation toggle, then return the
 * updated list.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const b = (req.body ?? {}) as Record<string, any>
    const automation = byKey(b.key)

    if (!automation) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Unknown automation key: ${String(b.key)}`
      )
    }
    if (typeof b.enabled !== "boolean") {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "`enabled` must be a boolean."
      )
    }

    const settings = new SettingsService(req.scope)
    await settings.set(TENANT_ID, automation.settingKey, b.enabled)

    const automations = await readAutomations(settings)
    res.json({ automations })
  } catch (e: any) {
    const status = e?.type === MedusaError.Types.INVALID_DATA ? 400 : 500
    res.status(status).json({
      message: e?.message ?? "Failed to update automation.",
    })
  }
}
