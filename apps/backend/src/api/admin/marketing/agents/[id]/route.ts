import { resolveTenantId } from "../../../../../lib/tenant-context"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { MARKETING_MODULE } from "../../../../../modules/marketing"

const TENANT_ID = resolveTenantId("MARKETING_DEFAULT_TENANT")

const AGENT_KINDS = ["content", "social", "inbox", "seo"] as const

const isNotFound = (e: any): boolean =>
  e?.type === "not_found" || /was not found|not found/i.test(e?.message ?? "")

/** The definition-shaping fields; a change to any of these forces a new version. */
const DEFINITION_FIELDS = [
  "name",
  "kind",
  "instructions",
  "model",
  "brand_voice_id",
  "playbook",
  "tools",
] as const

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

/** Load an agent + verify tenant. Returns null (and 404s) on miss/mismatch. */
const loadAgent = async (
  svc: any,
  id: string,
  res: MedusaResponse
): Promise<any | null> => {
  const agent = await svc.retrieveMarketingAgent(id)
  if (agent.tenant_id !== TENANT_ID) {
    res.status(404).json({ message: `Agent ${id} was not found` })
    return null
  }
  return agent
}

/**
 * GET /admin/marketing/agents/:id
 *
 * Retrieve an agent plus its versions (newest first).
 * Response: { agent, versions }
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params

  try {
    const svc: any = req.scope.resolve(MARKETING_MODULE)

    const agent = await loadAgent(svc, id, res)
    if (!agent) {
      return
    }

    const versions = await svc.listMarketingAgentVersions(
      { tenant_id: TENANT_ID, agent_id: id },
      { take: 100, order: { version: "DESC" } }
    )

    res.json({ agent, versions })
  } catch (e: any) {
    res.status(isNotFound(e) ? 404 : 500).json({
      message: e?.message ?? "Failed to retrieve agent",
    })
  }
}

/**
 * POST /admin/marketing/agents/:id
 *
 * Update an agent. When any definition-shaping field changes, a new published
 * agent-version is created (version bumped) and `current_version_id` is
 * repointed to it.
 * Body: { name?, kind?, instructions?, brand_voice_id?, model?, playbook?,
 *         tools?, active? }
 * Response: { agent, versions }
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params
  const b = (req.body ?? {}) as Record<string, any>

  try {
    const svc: any = req.scope.resolve(MARKETING_MODULE)

    const current = await loadAgent(svc, id, res)
    if (!current) {
      return
    }

    const data: Record<string, any> = {}
    if (b.name !== undefined) {
      const name = String(b.name).trim()
      if (!name) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "Agent `name` cannot be empty."
        )
      }
      data.name = name
    }
    if (b.kind !== undefined) {
      const kind = String(b.kind).trim()
      if (!(AGENT_KINDS as readonly string[]).includes(kind)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Agent \`kind\` must be one of: ${AGENT_KINDS.join(", ")}.`
        )
      }
      data.kind = kind
    }
    if (b.instructions !== undefined) {
      data.instructions = b.instructions ?? null
    }
    if (b.brand_voice_id !== undefined) {
      data.brand_voice_id = b.brand_voice_id ?? null
    }
    if (b.model !== undefined) {
      data.model = b.model ?? null
    }
    if (b.playbook !== undefined) {
      data.playbook = b.playbook ?? null
    }
    if (b.tools !== undefined) {
      data.tools = b.tools ?? null
    }
    if (b.active !== undefined) {
      data.active = b.active === true
    }

    const updated = await svc.updateMarketingAgents({ id, ...data })
    let agent = Array.isArray(updated) ? updated[0] : updated

    // Did any definition-shaping field actually change?
    const definitionChanged = DEFINITION_FIELDS.some(
      (f) => data[f] !== undefined && data[f] !== (current as any)[f]
    )

    if (definitionChanged) {
      const versions = await svc.listMarketingAgentVersions(
        { tenant_id: TENANT_ID, agent_id: id },
        { take: 1, order: { version: "DESC" } }
      )
      const lastVersion = Array.isArray(versions) ? versions[0] : null
      const nextNumber = (lastVersion?.version ?? 0) + 1

      const versionCreated = await svc.createMarketingAgentVersions({
        tenant_id: TENANT_ID,
        agent_id: id,
        version: nextNumber,
        definition: definitionFromAgent(agent),
        published: true,
      })
      const version = Array.isArray(versionCreated)
        ? versionCreated[0]
        : versionCreated

      const repointed = await svc.updateMarketingAgents({
        id,
        current_version_id: version.id,
      })
      agent = Array.isArray(repointed) ? repointed[0] : repointed
    }

    const allVersions = await svc.listMarketingAgentVersions(
      { tenant_id: TENANT_ID, agent_id: id },
      { take: 100, order: { version: "DESC" } }
    )

    res.json({ agent, versions: allVersions })
  } catch (e: any) {
    const status = e?.type === MedusaError.Types.INVALID_DATA ? 400 : 500
    res.status(isNotFound(e) ? 404 : status).json({
      message: e?.message ?? "Failed to update agent",
    })
  }
}

/**
 * DELETE /admin/marketing/agents/:id
 *
 * Delete an agent (tenant-scoped) and its versions.
 * Response: { id, object, deleted }
 */
export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params

  try {
    const svc: any = req.scope.resolve(MARKETING_MODULE)

    const current = await loadAgent(svc, id, res)
    if (!current) {
      return
    }

    const versions = await svc.listMarketingAgentVersions(
      { tenant_id: TENANT_ID, agent_id: id },
      { take: 1000 }
    )
    const versionIds = (Array.isArray(versions) ? versions : []).map(
      (v: any) => v.id
    )
    if (versionIds.length) {
      await svc.deleteMarketingAgentVersions(versionIds)
    }

    await svc.deleteMarketingAgents(id)

    res.json({ id, object: "marketing_agent", deleted: true })
  } catch (e: any) {
    res.status(isNotFound(e) ? 404 : 500).json({
      message: e?.message ?? "Failed to delete agent",
    })
  }
}
