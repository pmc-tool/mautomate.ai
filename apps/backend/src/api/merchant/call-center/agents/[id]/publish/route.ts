import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CALL_CENTER_MODULE } from "../../../../../../modules/call-center"
import CallCenterModuleService from "../../../../../../modules/call-center/service"
import { resolveMerchant } from "../../../../_helpers"

const isNotFound = (e: any): boolean =>
  e?.type === "not_found" || /was not found|not found/i.test(e?.message ?? "")

/**
 * POST /merchant/call-center/agents/:id/publish
 *
 * Snapshot the agent's current (draft) definition as a NEW immutable
 * PlaybookVersion, mark it published, point the agent's `current_version_id`
 * at it, flip the agent `status` to "published", and unpublish prior versions.
 * Tenant-scoped. Response: { agent, version }
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const tenant_id = ctx.merchant.tenant_id
  if (!tenant_id) {
    return res.status(401).json({ message: "merchant tenant not resolved" })
  }

  const { id } = req.params

  try {
    const cc: CallCenterModuleService = req.scope.resolve(CALL_CENTER_MODULE)

    const agent = await (cc as any).retrievePlaybook(id).catch(() => null)
    if (!agent || agent.tenant_id !== tenant_id) {
      return res.status(404).json({ message: `Agent ${id} was not found` })
    }

    // Read the whole version set (tenant-scoped) to find the current definition
    // and the next version number.
    const versions = await (cc as any).listPlaybookVersions(
      { playbook_id: id, tenant_id },
      { take: 1000, order: { version: "DESC" } }
    )
    const list = Array.isArray(versions) ? versions : []

    const source =
      list.find((v: any) => v.id === agent.current_version_id) ?? list[0]
    const definition = source?.definition ?? {}
    const nextVersion = list.reduce(
      (max: number, v: any) => Math.max(max, Number(v.version) || 0),
      0
    ) + 1

    const published = await (cc as any).createPlaybookVersions({
      tenant_id,
      playbook_id: id,
      version: nextVersion,
      definition,
      published: true,
    })

    // Unpublish every prior version (only the new snapshot is live).
    const stale = list
      .filter((v: any) => v.published)
      .map((v: any) => v.id)
    for (const vid of stale) {
      await (cc as any).updatePlaybookVersions({ id: vid, published: false })
    }

    await (cc as any).updatePlaybooks({
      id,
      current_version_id: published.id,
      status: "published",
    })

    res.status(201).json({
      agent: {
        id,
        name: agent.name,
        use_case: agent.use_case,
        status: "published",
        current_version_id: published.id,
      },
      version: {
        id: published.id,
        version: published.version,
        published: true,
        definition,
      },
    })
  } catch (e: any) {
    res.status(isNotFound(e) ? 404 : 500).json({
      message: e?.message ?? "Failed to publish agent",
    })
  }
}
