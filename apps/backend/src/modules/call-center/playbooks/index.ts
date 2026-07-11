import { defaultGuardrails } from "../guardrails"
import { codConfirmationPlaybook } from "./cod-confirmation"
import { MergeData, Playbook, PlaybookTool } from "./types"
import { wismoPlaybook } from "./wismo"

/**
 * Playbook registry + prompt compiler.
 *
 * The registry is the single lookup the agent-config endpoint uses to resolve a
 * `playbook_id` into a `Playbook`. `compileSystemPrompt` assembles the runtime
 * system prompt FRESH from the playbook + merge data on every call — the voice
 * runtime must never trust a stored/cached prompt copy, because that would let
 * a stale prompt drift from the current guardrails or expose the wrong tools.
 */

const REGISTRY: Record<string, Playbook> = {
  [codConfirmationPlaybook.id]: codConfirmationPlaybook,
  [wismoPlaybook.id]: wismoPlaybook,
}

/** Resolve a playbook by id, or null when none is registered under that id. */
export const getPlaybook = (id: string): Playbook | null => {
  return REGISTRY[id] ?? null
}

/** All registered playbooks (e.g. for an admin picker). */
export const listPlaybooks = (): Playbook[] => Object.values(REGISTRY)

/**
 * Replace `{{token}}` markers in `template` with values from `data`. Missing
 * or null values collapse to an empty string so a partial merge never leaks a
 * raw `{{token}}` to the customer.
 */
export const interpolate = (template: string, data: MergeData): string => {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key: string) => {
    const value = data[key]
    return value === undefined || value === null ? "" : String(value)
  })
}

/**
 * The hard anti-invention rule injected into every compiled prompt. The model
 * must speak only from the provided merge data / tool results and never
 * fabricate products, prices, stock, or delivery promises.
 */
const ANTI_INVENTION_RULE =
  "STRICT ANTI-INVENTION RULE: Only state facts that are present in the " +
  "provided order data or returned by a tool call. NEVER invent or guess a " +
  "product, price, discount, stock/availability, delivery date, or policy. " +
  "If you do not have a fact, say you will check or hand off to a human — do " +
  "not make one up. Do not agree to anything outside this playbook's tools."

/** Render one tool as a compact "- name: description" line for the prompt. */
const toolLine = (tool: PlaybookTool): string =>
  `- ${tool.name}: ${tool.description}`

/**
 * compileSystemPrompt — build the runtime system prompt from a playbook.
 *
 * Assembles, in order: persona, objective, the mandatory recording disclosure /
 * compliance block, the merge data the model may rely on, the CURRENT state's
 * goal, the tool list exposed in that state, the guardrail limits, the closed
 * disposition set, and finally the anti-invention rule. `stateId` selects which
 * state's `allowed_tools` are exposed; it defaults to the playbook's first
 * state (the opening), which is what the initial config fetch needs.
 *
 * Recomputed on every call — never cached — so it always reflects the live
 * playbook and guardrails.
 */
export const compileSystemPrompt = (
  playbook: Playbook,
  mergeData: MergeData,
  stateId?: string
): string => {
  const guardrails = playbook.guardrails ?? defaultGuardrails
  const state =
    playbook.states.find((s) => s.id === stateId) ?? playbook.states[0]

  const allowedToolNames = new Set(state?.allowed_tools ?? [])
  const exposedTools = playbook.tools.filter((t) => allowedToolNames.has(t.name))

  const mergeLines = playbook.merge_fields
    .map((field) => {
      const value = mergeData[field]
      const shown =
        value === undefined || value === null || value === ""
          ? "(unknown)"
          : String(value)
      return `- ${field}: ${shown}`
    })
    .join("\n")

  const sections = [
    `You are "${playbook.persona.name}", an AI voice agent.`,
    `Speak in ${playbook.persona.language}. Tone: ${playbook.persona.tone}.`,
    "",
    "OBJECTIVE:",
    playbook.objective,
    "",
    "COMPLIANCE:",
    `- At the start of the call, disclose recording: "${guardrails.recording_disclosure}"`,
    "- Be polite and never pressure or threaten the customer.",
    "- Do not disclose order details until you have verified the caller's identity.",
    "",
    "ORDER / CUSTOMER DATA YOU MAY USE (do not read fields marked (unknown) aloud):",
    mergeLines || "- (none provided)",
    "",
    `CURRENT STATE: ${state?.id ?? "(none)"}`,
    `GOAL: ${state?.goal ?? ""}`,
    "",
    "TOOLS AVAILABLE IN THIS STATE (you may call ONLY these):",
    exposedTools.length
      ? exposedTools.map(toolLine).join("\n")
      : "- (no tools in this state)",
    "",
    "GUARDRAILS:",
    `- Max turns: ${guardrails.max_turns}. Max clarification re-asks: ${guardrails.max_clarify}.`,
    `- Save a mutating change (address/reschedule/cancel) at most once: ${guardrails.save_offer_once}.`,
    "- If you hit a limit or cannot understand, set a disposition and hand off gracefully.",
    "",
    ...(playbook.dtmf_map && Object.keys(playbook.dtmf_map).length
      ? [
          "KEYPAD (DTMF) — the customer may press a phone key instead of speaking:",
          ...Object.entries(playbook.dtmf_map).map(
            ([digit, intent]) => `- Key ${digit} = ${intent}`
          ),
          "A keypad press is an EXPLICIT, unambiguous choice. When you are told " +
            "the customer pressed a key, act on that intent immediately " +
            "(confirm -> call confirmOrder with confirmed=true; cancel -> move " +
            "to cancelling; reschedule -> ask for the preferred day, then " +
            "reschedule). NEVER re-ask or second-guess a keypad press, and " +
            "prefer it whenever speech is unclear.",
          "",
        ]
      : []),
    `ALLOWED DISPOSITIONS: ${playbook.disposition_set.join(", ")}.`,
    "",
    ANTI_INVENTION_RULE,
  ]

  return sections.join("\n")
}

export { codConfirmationPlaybook, wismoPlaybook }
export * from "./types"
