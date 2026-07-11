import { resolveTenantId } from "../../../../lib/tenant-context"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { MARKETING_MODULE } from "../../../../modules/marketing"

const TENANT_ID = resolveTenantId("MARKETING_DEFAULT_TENANT")

const AGENT_KINDS = ["content", "social", "inbox", "seo"] as const

/** Build the immutable version `definition` snapshot from an agent row. */
const definitionFromAgent = (agent: any): Record<string, any> => ({
  name: agent.name,
  kind: agent.kind,
  instructions: agent.instructions ?? null,
  model: agent.model ?? null,
  brand_voice_id: agent.brand_voice_id ?? null,
  playbook: agent.playbook ?? null,
  tools: agent.tools ?? null,
})

/**
 * GET /admin/marketing/agents
 *
 * Paginated list of agents, tenant-scoped. Optional `kind` filter.
 * Response: { agents, count, limit, offset }
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const svc: any = req.scope.resolve(MARKETING_MODULE)

    const limit = parseInt((req.query.limit as string) ?? "50")
    const offset = parseInt((req.query.offset as string) ?? "0")

    const filter: Record<string, any> = { tenant_id: TENANT_ID }
    const kind = (req.query.kind as string) ?? ""
    if (kind && (AGENT_KINDS as readonly string[]).includes(kind)) {
      filter.kind = kind
    }

    const [agents, count] = await svc.listAndCountMarketingAgents(filter, {
      take: limit,
      skip: offset,
      order: { created_at: "DESC" },
    })

    res.json({ agents, count, limit, offset })
  } catch (e: any) {
    res.status(500).json({
      message: e?.message ?? "Failed to list agents",
    })
  }
}

/**
 * POST /admin/marketing/agents
 *
 * Create an agent, plus its first published agent-version (v1) whose
 * `definition` is the agent config, and point `current_version_id` at it.
 * Body: { name, kind, instructions?, brand_voice_id?, model?, playbook?, tools? }
 * Response: { agent }
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const b = (req.body ?? {}) as {
    name?: string
    kind?: string
    instructions?: string
    brand_voice_id?: string
    model?: string
    playbook?: any
    tools?: any
  }

  try {
    const name = b.name?.trim()
    if (!name) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "An agent `name` is required."
      )
    }

    const kind = (b.kind ?? "content").trim()
    if (!(AGENT_KINDS as readonly string[]).includes(kind)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Agent \`kind\` must be one of: ${AGENT_KINDS.join(", ")}.`
      )
    }

    const svc: any = req.scope.resolve(MARKETING_MODULE)

    const created = await svc.createMarketingAgents({
      tenant_id: TENANT_ID,
      name,
      kind,
      instructions: b.instructions?.trim() ? b.instructions.trim() : null,
      brand_voice_id: b.brand_voice_id ?? null,
      model: b.model?.trim() ? b.model.trim() : null,
      playbook: b.playbook ?? null,
      tools: b.tools ?? null,
      active: true,
    })

    const agent = Array.isArray(created) ? created[0] : created

    const versionCreated = await svc.createMarketingAgentVersions({
      tenant_id: TENANT_ID,
      agent_id: agent.id,
      version: 1,
      definition: definitionFromAgent(agent),
      published: true,
    })
    const version = Array.isArray(versionCreated)
      ? versionCreated[0]
      : versionCreated

    const updated = await svc.updateMarketingAgents({
      id: agent.id,
      current_version_id: version.id,
    })
    const finalAgent = Array.isArray(updated) ? updated[0] : updated

    res.status(201).json({ agent: finalAgent })
  } catch (e: any) {
    const status = e?.type === MedusaError.Types.INVALID_DATA ? 400 : 500
    res.status(status).json({
      message: e?.message ?? "Failed to create agent",
    })
  }
}
