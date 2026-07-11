import { z } from "zod"

/**
 * Shared zod schema for a call agent's RICH training definition.
 *
 * This mirrors the Playbook data model in
 * `src/modules/call-center/playbooks/types.ts` (PlaybookPersona,
 * PlaybookState state-machine, PlaybookTool, PlaybookGuardrails). Every field
 * is optional so a merchant can save a partial draft and refine it over time
 * (progressive training). Unknown keys are preserved via `.passthrough()` so
 * the schema never silently drops data the voice runtime may consume later.
 *
 * Used by BOTH POST /agents (initial definition) and
 * PUT /agents/:id (edit/train), keeping create + edit validation identical.
 */

/** PlaybookPersona — TTS persona + spoken language + tone. */
const PersonaSchema = z
  .object({
    name: z.string().optional(),
    voice_provider: z.string().optional(),
    voice_id: z.string().optional(),
    language: z.string().optional(),
    tone: z.string().optional(),
    style: z.string().optional(),
  })
  .passthrough()

/** Convenience voice block ({provider, voice_id, language}) — folded in below. */
const VoiceSchema = z
  .object({
    provider: z.string().optional(),
    voice_id: z.string().optional(),
    language: z.string().optional(),
  })
  .passthrough()

/** PlaybookState — one node of the conversation state machine. */
const StateSchema = z
  .object({
    id: z.string().min(1),
    goal: z.string().optional().default(""),
    sample_lines: z.array(z.string()).optional(),
    allowed_tools: z.array(z.string()).optional().default([]),
    transitions: z
      .array(z.object({ on: z.string(), to: z.string() }).passthrough())
      .optional(),
  })
  .passthrough()

/** PlaybookTool — a model-callable tool (parameters is a JSON-schema object). */
const ToolSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().optional().default(""),
    parameters: z.record(z.string(), z.any()).optional().default({}),
  })
  .passthrough()

/** PlaybookGuardrails — deterministic, model-external limits. */
const GuardrailsSchema = z
  .object({
    max_turns: z.number().int().positive().optional(),
    max_clarify: z.number().int().nonnegative().optional(),
    save_offer_once: z.boolean().optional(),
    recording_disclosure: z.string().optional(),
  })
  .passthrough()

/**
 * The full training definition. All optional -> partial drafts allowed.
 */
export const DefinitionSchema = z
  .object({
    persona: PersonaSchema.optional(),
    voice: VoiceSchema.optional(),
    objective: z.string().optional(),
    first_message: z.string().optional(),
    prompt: z.string().optional(),
    system_prompt: z.string().optional(),
    merge_fields: z.array(z.string()).optional(),
    states: z.array(StateSchema).optional(),
    tools: z.array(ToolSchema).optional(),
    guardrails: GuardrailsSchema.optional(),
    disposition_set: z.array(z.string()).optional(),
    dtmf_map: z.record(z.string(), z.string()).optional(),
  })
  .passthrough()

export type AgentDefinition = z.infer<typeof DefinitionSchema>
