import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { MARKETING_MODULE } from "../../../../../modules/marketing"
import MarketingModuleService from "../../../../../modules/marketing/service"
import {
  AUTONOMOUS_KINDS,
  validatePlaybook,
} from "../../../../../modules/marketing/agents/playbook"
import { resolveMerchant } from "../../../_helpers"

const KINDS = AUTONOMOUS_KINDS as readonly string[]

const isNotFound = (e: any): boolean =>
  e?.type === "not_found" || /was not found|not found/i.test(e?.message ?? "")

/** Load an agent and assert tenant ownership. Fail-closed: 404 otherwise. */
const loadOwned = async (
  svc: MarketingModuleService,
  id: string,
  tenantId: string,
  res: MedusaResponse
): Promise<any | null> => {
  const agent = await (svc as any).retrieveMarketingAgent(id).catch(() => null)
  if (!agent || agent.tenant_id !== tenantId) {
    res.status(404).json({ message: `Agent ${id} was not found` })
    return null
  }
  return agent
}

/**
 * GET /merchant/marketing/agents/:id
 * Tenant-scoped. Response: { agent }
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  try {
    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)
    const agent = await loadOwned(svc, req.params.id, ctx.tenant.id, res)
    if (!agent) return
    res.json({ agent })
  } catch (e: any) {
    res
      .status(isNotFound(e) ? 404 : 500)
      .json({ message: e?.message ?? "Failed to retrieve agent" })
  }
}

/**
 * PUT /merchant/marketing/agents/:id
 *
 * Update an agent (tenant-scoped). Only provided fields change. A supplied
 * `playbook` REPLACES the previous one and is fully re-validated (including the
 * media-required capability gate); the server-owned `_runtime` block is carried
 * forward, never taken from the client.
 * Body: { name?, kind?, instructions?, model?, brand_voice_id?, active?,
 *         playbook? }
 * Response: { agent }
 */
export const PUT = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const { id } = req.params
  const b = (req.body ?? {}) as Record<string, any>

  try {
    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)
    const current = await loadOwned(svc, id, ctx.tenant.id, res)
    if (!current) return

    const data: Record<string, any> = {}

    if (b.name !== undefined) {
      const name = String(b.name).trim()
      if (!name) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "`name` cannot be empty."
        )
      }
      data.name = name
    }
    if (b.kind !== undefined) {
      if (!KINDS.includes(String(b.kind))) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `\`kind\` must be one of: ${KINDS.join(", ")}.`
        )
      }
      data.kind = String(b.kind)
    }
    if (b.instructions !== undefined) {
      data.instructions =
        typeof b.instructions === "string"
          ? b.instructions.trim() || null
          : null
    }
    if (b.model !== undefined) {
      data.model =
        typeof b.model === "string" && b.model.trim() ? b.model.trim() : null
    }
    if (b.tools !== undefined) {
      data.tools = Array.isArray(b.tools) ? b.tools : null
    }
    if (b.active !== undefined) {
      data.active = b.active === true
    }

    if (b.brand_voice_id !== undefined) {
      const bvId =
        typeof b.brand_voice_id === "string" && b.brand_voice_id.trim()
          ? b.brand_voice_id.trim()
          : null
      if (bvId) {
        const bv = await (svc as any)
          .retrieveMarketingBrandVoice(bvId)
          .catch(() => null)
        if (!bv || bv.tenant_id !== ctx.tenant.id) {
          throw new MedusaError(
            MedusaError.Types.INVALID_DATA,
            `Brand voice ${bvId} was not found.`
          )
        }
      }
      data.brand_voice_id = bvId
    }

    if (b.playbook !== undefined) {
      if (b.playbook === null) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "`playbook` cannot be null — an agent needs { platforms, mode }."
        )
      }
      const playbook = validatePlaybook(b.playbook, current.playbook)
      if (playbook.schedule_id) {
        const s = await (svc as any)
          .retrieveMarketingSchedule(playbook.schedule_id)
          .catch(() => null)
        if (!s || s.tenant_id !== ctx.tenant.id) {
          throw new MedusaError(
            MedusaError.Types.INVALID_DATA,
            `Schedule ${playbook.schedule_id} was not found.`
          )
        }
      }
      data.playbook = playbook
    }

    if (data.playbook) {
      // MikroORM's assign() DEEP-MERGES plain-object json columns, so a plain
      // update would leave keys the merchant removed (e.g. an old `topics` list)
      // behind in the playbook. Null the column first to force a true replace.
      await (svc as any).updateMarketingAgents({ id, playbook: null })
    }

    const updated = await (svc as any).updateMarketingAgents({ id, ...data })
    const agent = Array.isArray(updated) ? updated[0] : updated

    res.json({ agent })
  } catch (e: any) {
    const status = e?.type === MedusaError.Types.INVALID_DATA ? 400 : 500
    res
      .status(isNotFound(e) ? 404 : status)
      .json({ message: e?.message ?? "Failed to update agent" })
  }
}

/**
 * DELETE /merchant/marketing/agents/:id
 * Tenant-scoped. Posts the agent already produced are kept (they carry their own
 * lifecycle); only the agent is removed. Response: { id, object, deleted }
 */
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const { id } = req.params

  try {
    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)
    const current = await loadOwned(svc, id, ctx.tenant.id, res)
    if (!current) return

    await (svc as any).deleteMarketingAgents(id)

    res.json({ id, object: "marketing_agent", deleted: true })
  } catch (e: any) {
    res
      .status(isNotFound(e) ? 404 : 500)
      .json({ message: e?.message ?? "Failed to delete agent" })
  }
}
