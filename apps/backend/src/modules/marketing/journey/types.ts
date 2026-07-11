/**
 * Journey step-node schema — the typed shape of `marketing_journey.steps` (a
 * JSON array). The runner interprets these in order; the action executor
 * performs `action` nodes; the admin editor builds them. v1 is a linear
 * sequence with `wait`, `condition` (gate: continue or exit), and `action`
 * nodes. Branching (yes/no edges) is a v2/visual-builder extension.
 */

/** A data check evaluated against the enrollment's live context/contact. */
export type JourneyCondition = {
  /** Dotted path into the eval context, e.g. "contact.score", "order.total". */
  field: string
  op: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "exists" | "not_exists" | "contains"
  value?: unknown
}

/** An action a journey performs at a step. */
export type JourneyAction =
  | { type: "send_email"; template_id?: string; subject?: string; html?: string; brief?: string; brand_voice_id?: string }
  | { type: "send_dm"; channel: string; text: string }
  | { type: "add_tag"; tag: string }
  | { type: "remove_tag"; tag: string }
  | { type: "add_score"; points: number }
  | { type: "discount"; percentage?: number; amount?: number; expires_hours?: number }
  | { type: "webhook"; url: string }

/** One node in a journey. */
export type JourneyStep =
  | { type: "wait"; delay_seconds: number; label?: string }
  | { type: "condition"; condition: JourneyCondition; on_fail?: "exit" | "skip"; label?: string }
  | { type: "action"; action: JourneyAction; label?: string }

/** The full ordered program. */
export type JourneySteps = JourneyStep[]

/**
 * The context an enrollment carries + resolves for conditions and templating:
 * the contact, plus any commerce objects loaded for this run and free-form data
 * written by earlier steps.
 */
export type JourneyContext = {
  contact?: Record<string, unknown> | null
  order?: Record<string, unknown> | null
  cart?: Record<string, unknown> | null
  customer?: Record<string, unknown> | null
  data?: Record<string, unknown>
}

/** Result of executing one action (returned by the action executor). */
export type ActionResult = {
  ok: boolean
  /** Data to merge back into the enrollment context (e.g. { discount_code }). */
  context?: Record<string, unknown>
  error?: string
  /** When true, the runner should stop the enrollment (e.g. hard failure). */
  stop?: boolean
}

/** Trigger events a journey can enroll on. */
export const JOURNEY_TRIGGERS = [
  "order.placed",
  "order.completed",
  "cart.updated",
  "customer.created",
  "manual",
  "segment",
] as const
export type JourneyTrigger = (typeof JOURNEY_TRIGGERS)[number]
