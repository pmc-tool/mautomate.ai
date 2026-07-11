import { CALL_CENTER_MODULE } from "../../../modules/call-center"
import type {
  Playbook,
  PlaybookTool,
} from "../../../modules/call-center/playbooks/types"

/**
 * Bridge: resolve a MERCHANT-TRAINED playbook (stored in the call_center DB as
 * a Playbook + live PlaybookVersion.definition) into the same `Playbook` shape
 * the static in-code registry returns, so `/telephony/agent-config` can compile
 * a config for agents built in the dashboard — not just the two reference
 * playbooks. Fail-closed and STRICTLY tenant-scoped: a missing agent, a missing
 * definition, or any tenant mismatch returns null (the caller then 404s).
 *
 * `compileSystemPrompt` builds its prompt from persona + objective + states and
 * does NOT read a free-form `system_prompt`, so we fold the definition's
 * `system_prompt`/`prompt` into the objective, and synthesize a single "main"
 * state (exposing all tools) when the merchant defined none.
 */
const toTool = (t: any): PlaybookTool => ({
  name: String(t?.name ?? "").trim(),
  description: String(t?.description ?? ""),
  parameters: (t?.parameters ?? {}) as object,
})

const adapt = (agent: any, version: any, def: any): Playbook => {
  const persona = def?.persona ?? {}
  const voice = def?.voice ?? {}
  const tools: PlaybookTool[] = Array.isArray(def?.tools)
    ? def.tools.map(toTool).filter((t: PlaybookTool) => t.name)
    : []
  const toolNames = tools.map((t) => t.name)

  // compileSystemPrompt ignores a free-form prompt -> fold it into objective.
  const objective =
    [def?.objective, def?.system_prompt ?? def?.prompt]
      .filter((s) => typeof s === "string" && s.trim())
      .join("\n\n") || "Assist the caller as the store's voice agent."

  const states =
    Array.isArray(def?.states) && def.states.length
      ? def.states.map((s: any) => ({
          id: String(s?.id ?? "main"),
          goal: String(s?.goal ?? ""),
          sample_lines: Array.isArray(s?.sample_lines)
            ? s.sample_lines
            : undefined,
          allowed_tools: Array.isArray(s?.allowed_tools)
            ? s.allowed_tools
            : toolNames,
          transitions: Array.isArray(s?.transitions)
            ? s.transitions
            : undefined,
        }))
      : [{ id: "main", goal: def?.objective ?? "", allowed_tools: toolNames }]

  return {
    id: agent.id,
    use_case: agent.use_case ?? "custom",
    version: Number(version?.version ?? 1),
    persona: {
      name: persona.name ?? agent.name ?? "Assistant",
      voice_provider: persona.voice_provider ?? voice.provider ?? "elevenlabs",
      voice_id: persona.voice_id ?? voice.voice_id ?? undefined,
      language: persona.language ?? voice.language ?? "en",
      tone: persona.tone ?? "warm, professional",
    },
    objective,
    first_message:
      def?.first_message ?? "Hello, thanks for calling. How can I help you?",
    merge_fields: Array.isArray(def?.merge_fields) ? def.merge_fields : [],
    states,
    tools,
    guardrails: {
      max_turns: Number(def?.guardrails?.max_turns ?? 60),
      max_clarify: Number(def?.guardrails?.max_clarify ?? 2),
      save_offer_once: Boolean(def?.guardrails?.save_offer_once ?? true),
      recording_disclosure: String(def?.guardrails?.recording_disclosure ?? ""),
    },
    disposition_set: Array.isArray(def?.disposition_set)
      ? def.disposition_set
      : [],
    dtmf_map:
      def?.dtmf_map && typeof def.dtmf_map === "object" ? def.dtmf_map : {},
  }
}

/**
 * Load a DB-backed playbook by id, compiled to a `Playbook`. Returns null when
 * not found or when `tenantId` does not STRICTLY match the agent's tenant.
 */
export const loadDbPlaybook = async (
  scope: any,
  id: string,
  tenantId: string
): Promise<Playbook | null> => {
  try {
    const cc: any = scope.resolve(CALL_CENTER_MODULE)
    const agent = await cc.retrievePlaybook(id).catch(() => null)
    if (!agent) return null
    // Fail-closed cross-tenant guard.
    if (!tenantId || agent.tenant_id !== tenantId) return null

    let version: any = null
    if (agent.current_version_id) {
      version = await cc
        .retrievePlaybookVersion(agent.current_version_id)
        .catch(() => null)
    }
    if (!version) {
      const versions = await cc
        .listPlaybookVersions(
          { playbook_id: agent.id, tenant_id: agent.tenant_id },
          { take: 1, order: { version: "DESC" } }
        )
        .catch(() => [])
      version = Array.isArray(versions) && versions.length ? versions[0] : null
    }
    if (!version?.definition) return null
    return adapt(agent, version, version.definition)
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[telephony] agent-config: DB playbook load failed:", e)
    return null
  }
}
