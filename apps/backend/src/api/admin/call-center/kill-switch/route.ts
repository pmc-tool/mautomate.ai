import { resolveTenantId } from "../../../../lib/tenant-context"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { CALL_CENTER_MODULE } from "../../../../modules/call-center"
import CallCenterModuleService from "../../../../modules/call-center/service"
import { SettingsService } from "../../../../modules/call-center/settings/settings-service"

const TENANT_ID = resolveTenantId("CALL_CENTER_DEFAULT_TENANT")

/**
 * Emergency kill-switch for outbound calling.
 *
 * `outbound_halted` is a DURABLE, DB-backed flag (call_center_setting, key
 * "outbound_halted") — the authoritative stop that both the dialer and the
 * campaign-runner jobs check (fail-safe) before dispatching any call. A "halt"
 * also pauses every running campaign as an extra, visible effect; a "resume"
 * clears the durable flag (campaigns are then resumed individually).
 *
 * `enabled` reflects the process-level env flag CALL_CENTER_ENABLED — the
 * master compile-time gate, read-only here.
 */

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const cc: CallCenterModuleService = req.scope.resolve(CALL_CENTER_MODULE)
    const settings = new SettingsService(req.scope)

    const [, runningCount] = await cc.listAndCountCampaigns(
      { tenant_id: TENANT_ID, status: "running" },
      { take: 1 }
    )

    res.json({
      enabled: process.env.CALL_CENTER_ENABLED === "true",
      outbound_halted: await settings.isOutboundHalted(TENANT_ID),
      running_campaigns: runningCount,
    })
  } catch (e: any) {
    res.status(500).json({
      message: e?.message ?? "Failed to read kill-switch state",
    })
  }
}

/**
 * POST /admin/call-center/kill-switch — Body: { action: "halt" | "resume" }.
 *   - "halt": set the durable outbound_halted flag AND pause every running
 *     campaign for the tenant. Returns how many were paused.
 *   - "resume": clear the durable flag. Campaigns are re-run individually via
 *     POST /admin/call-center/campaigns/:id (status "running").
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const body = (req.body ?? {}) as { action?: string }
  const action = body.action

  try {
    if (action !== "halt" && action !== "resume") {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        'An `action` of "halt" or "resume" is required.'
      )
    }

    const cc: CallCenterModuleService = req.scope.resolve(CALL_CENTER_MODULE)
    const settings = new SettingsService(req.scope)

    if (action === "halt") {
      await settings.setOutboundHalted(TENANT_ID, true)

      const updated = await cc.updateCampaigns({
        selector: { tenant_id: TENANT_ID, status: "running" },
        data: { status: "paused" },
      })
      const paused = Array.isArray(updated) ? updated.length : updated ? 1 : 0

      res.json({ action: "halt", outbound_halted: true, paused_campaigns: paused })
      return
    }

    // action === "resume" — clear the durable stop
    await settings.setOutboundHalted(TENANT_ID, false)
    res.json({
      action: "resume",
      outbound_halted: false,
      message:
        "Outbound resumed. Re-run each campaign via POST /admin/call-center/campaigns/:id with status \"running\".",
    })
  } catch (e: any) {
    const status = e?.type === MedusaError.Types.INVALID_DATA ? 400 : 500
    res.status(status).json({
      message: e?.message ?? "Failed to toggle kill-switch",
    })
  }
}
