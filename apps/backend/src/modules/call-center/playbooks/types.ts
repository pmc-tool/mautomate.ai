/**
 * Playbook schema — the TypeScript source of truth for a call-center "brain".
 *
 * A Playbook is a declarative, versioned description of ONE conversation use
 * case (e.g. COD order confirmation). It is deliberately data-only: it names a
 * persona, an objective, the ordered conversation states, the tools the model
 * may call, and the deterministic guardrails. The voice runtime never invents
 * behaviour — it fetches a compiled config (see `/telephony/agent-config`) that
 * is assembled fresh from one of these objects at call time.
 *
 * Nothing here depends on the backend: a Playbook is a plain serializable value
 * so it can travel across the wire to the Python voice service unchanged.
 */

/**
 * A tool the model may call during the conversation. `parameters` is a JSON
 * Schema object (draft-07 style) describing the tool's arguments — the same
 * shape the runtime forwards to the LLM's function-calling API.
 */
export type PlaybookTool = {
  name: string
  description: string
  /** JSON-schema object describing the tool arguments. */
  parameters: object
}

/**
 * One node in the conversation state machine. `goal` is what the model is
 * trying to accomplish while in this state; `allowed_tools` is the HARD gate on
 * which tools are exposed here (a tool absent from this list must never be
 * callable in this state — see `guardrails.ts`). `transitions` describe the
 * edges out of the state keyed by a semantic event name.
 */
export type PlaybookState = {
  id: string
  goal: string
  /** Optional example lines to anchor tone; NOT a script to read verbatim. */
  sample_lines?: string[]
  /** Whitelist of tool names exposed while in this state. */
  allowed_tools: string[]
  transitions?: { on: string; to: string }[]
}

/**
 * The persona the voice runtime should adopt: which TTS provider/voice, the
 * spoken language (BCP-47, e.g. "bn" for Bengali), and the tone descriptor.
 */
export type PlaybookPersona = {
  name: string
  voice_provider: string
  voice_id?: string
  /** BCP-47 language tag, e.g. "bn" (Bengali). */
  language: string
  tone: string
}

/**
 * Deterministic guardrails. These are enforced OUTSIDE the model (server-side
 * here and, authoritatively, in the Python runtime) so a jailbreak or model
 * error cannot exceed them.
 */
export type PlaybookGuardrails = {
  /** Hard cap on conversation turns before the call is force-ended. */
  max_turns: number
  /** Hard cap on clarification re-asks before falling back to a human/hangup. */
  max_clarify: number
  /** A mutating "offer" (reschedule/address change) may be saved at most once. */
  save_offer_once: boolean
  /** The mandatory call-recording disclosure spoken up front. */
  recording_disclosure: string
}

/**
 * A complete playbook — the unit the registry stores and the agent-config
 * endpoint compiles.
 */
export type Playbook = {
  id: string
  use_case: string
  version: number
  persona: PlaybookPersona
  objective: string
  /** The first thing the agent says once connected (may contain merge tokens). */
  first_message: string
  /** Whitelist of order/customer fields the model is permitted to read. */
  merge_fields: string[]
  states: PlaybookState[]
  tools: PlaybookTool[]
  guardrails: PlaybookGuardrails
  /** The closed set of allowed call outcomes. */
  disposition_set: string[]
  /**
   * Optional keypad (DTMF) shortcuts: maps a pressed digit to an intent
   * (e.g. "1" -> "confirm"). A keypad press is an EXPLICIT, unambiguous choice
   * that bypasses speech recognition entirely — critical where STT is weak
   * (e.g. Bengali, where numbers and the word "order" transcribe poorly). The
   * runtime treats a press as the customer's definitive intent and acts on it
   * without re-asking. See the Python pipeline's DTMF handling.
   */
  dtmf_map?: Record<string, string>
}

/**
 * Flat key/value data interpolated into `first_message` and made available to
 * the compiled prompt. Only keys listed in a playbook's `merge_fields` are ever
 * populated (the endpoint enforces the whitelist).
 */
export type MergeData = Record<string, string | number | null | undefined>
