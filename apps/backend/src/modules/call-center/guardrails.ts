import { Playbook, PlaybookGuardrails } from "./playbooks/types"

/**
 * Deterministic guardrails — the shared, non-negotiable limits for every
 * call-center conversation.
 *
 * These are enforced OUTSIDE the language model. The authoritative enforcement
 * lives in the Python voice runtime (it counts turns and blocks disallowed tool
 * calls in real time); this module provides the SAME constants plus lightweight
 * server-side checks so the backend (agent-config endpoint, any tool-proxy
 * route) can reject an out-of-policy request without trusting the model.
 *
 * A playbook may tighten these via its own `guardrails` block, but the runtime
 * treats whichever is stricter as the ceiling.
 */

/** The baseline guardrails applied when a playbook does not specify its own. */
export const defaultGuardrails: PlaybookGuardrails = {
  max_turns: 30,
  max_clarify: 2,
  save_offer_once: true,
  // মান নিয়ন্ত্রণের জন্য এই কলটি রেকর্ড করা হচ্ছে।
  // (EN: "This call is being recorded for quality assurance.")
  recording_disclosure: "মান নিয়ন্ত্রণের জন্য এই কলটি রেকর্ড করা হচ্ছে।",
}

/** The mutable snapshot of a live conversation the guardrails reason about. */
export type GuardrailState = {
  /** Turns taken so far (one turn = one agent<->customer exchange). */
  turns: number
  /** Clarification re-asks used so far. */
  clarify_count: number
  /** How many times a mutating "offer" has already been saved this call. */
  offers_saved: number
}

/** The outcome of a guardrail check: whether to continue and why not. */
export type GuardrailVerdict = {
  ok: boolean
  /** Set when `ok` is false: a stable machine reason code. */
  reason?:
    | "max_turns_exceeded"
    | "max_clarify_exceeded"
    | "offer_already_saved"
  /** Human-readable explanation for logs. */
  message?: string
}

/**
 * checkGuardrails — deterministic gate evaluated before each agent action.
 *
 * NOTE: this is the server-side mirror of the runtime's live counter. It does
 * NOT mutate state; the caller advances the counters. Returns `ok: false` with
 * a reason when a hard limit has been reached (the caller should then force a
 * graceful close / human handoff rather than continue).
 */
export const checkGuardrails = (
  state: GuardrailState,
  guardrails: PlaybookGuardrails = defaultGuardrails
): GuardrailVerdict => {
  if (state.turns >= guardrails.max_turns) {
    return {
      ok: false,
      reason: "max_turns_exceeded",
      message: `Turn limit (${guardrails.max_turns}) reached; close the call.`,
    }
  }

  if (state.clarify_count > guardrails.max_clarify) {
    return {
      ok: false,
      reason: "max_clarify_exceeded",
      message: `Clarify limit (${guardrails.max_clarify}) reached; hand off.`,
    }
  }

  if (guardrails.save_offer_once && state.offers_saved > 1) {
    return {
      ok: false,
      reason: "offer_already_saved",
      message: "A mutating offer was already saved; it may be saved only once.",
    }
  }

  return { ok: true }
}

/**
 * isToolAllowedInState — the HARD tool gate.
 *
 * Returns true only when `toolName` is listed in the named state's
 * `allowed_tools`. This is what stops, e.g., `cancelOrder` from being callable
 * during the opening state even if the model tries. Unknown state or tool → false.
 */
export const isToolAllowedInState = (
  playbook: Playbook,
  stateId: string,
  toolName: string
): boolean => {
  const state = playbook.states.find((s) => s.id === stateId)
  if (!state) {
    return false
  }
  return state.allowed_tools.includes(toolName)
}

/** The result of validating an attempted tool call against the playbook. */
export type ToolCallVerdict = {
  ok: boolean
  reason?: "unknown_tool" | "tool_not_allowed_in_state" | "unknown_state"
  message?: string
}

/**
 * assertToolCall — server-side validation of a proposed tool call.
 *
 * Rejects a call for a tool the playbook does not declare, a call in an unknown
 * state, or a call whose tool is not in the current state's `allowed_tools`.
 * Use from any backend tool-proxy route before executing a model-requested tool.
 */
export const assertToolCall = (
  playbook: Playbook,
  stateId: string,
  toolName: string
): ToolCallVerdict => {
  const declared = playbook.tools.some((t) => t.name === toolName)
  if (!declared) {
    return {
      ok: false,
      reason: "unknown_tool",
      message: `Tool "${toolName}" is not declared by playbook "${playbook.id}".`,
    }
  }

  const state = playbook.states.find((s) => s.id === stateId)
  if (!state) {
    return {
      ok: false,
      reason: "unknown_state",
      message: `State "${stateId}" does not exist in playbook "${playbook.id}".`,
    }
  }

  if (!state.allowed_tools.includes(toolName)) {
    return {
      ok: false,
      reason: "tool_not_allowed_in_state",
      message: `Tool "${toolName}" is not allowed in state "${stateId}".`,
    }
  }

  return { ok: true }
}
