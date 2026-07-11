/**
 * AI Call Center — admin Playbooks data layer (Phase 4).
 *
 * Read-only wrappers over an ASSUMED admin playbooks API:
 *   GET /admin/call-center/playbooks
 *   GET /admin/call-center/playbooks/:id
 *
 * These endpoints DO NOT EXIST YET — another integrator will expose the compiled
 * playbook registry (see src/modules/call-center/playbooks) through them. Until
 * then the pages degrade gracefully: a 404 is surfaced as an informative
 * "Playbook API pending — Phase 4" empty state rather than an error.
 *
 * The shapes mirror the module's `Playbook` type. `name` and `status` are marked
 * optional because the current registry object exposes `use_case` / `version` /
 * `persona.name` but no top-level name/status field — the future endpoint may
 * add them, and the UI falls back to persona.name when `name` is absent.
 *
 * Not a route — a plain lib.ts next to the page.tsx files is import-only.
 */

/* ------------------------------------------------------------------ */
/* Types (mirror modules/call-center/playbooks/types.ts)               */
/* ------------------------------------------------------------------ */

export type PlaybookPersona = {
  name: string
  voice_provider: string
  voice_id?: string
  language: string
  tone: string
}

export type PlaybookState = {
  id: string
  goal: string
  sample_lines?: string[]
  allowed_tools: string[]
  transitions?: { on: string; to: string }[]
}

export type PlaybookTool = {
  name: string
  description: string
  parameters: object
}

export type PlaybookGuardrails = {
  max_turns: number
  max_clarify: number
  save_offer_once: boolean
  recording_disclosure: string
}

export type Playbook = {
  id: string
  use_case: string
  version: number
  /** Present only if the future endpoint adds it; else fall back to persona.name. */
  name?: string
  /** Present only if the future endpoint adds a lifecycle status. */
  status?: string
  persona: PlaybookPersona
  objective: string
  first_message: string
  merge_fields: string[]
  states: PlaybookState[]
  tools: PlaybookTool[]
  guardrails: PlaybookGuardrails
  disposition_set: string[]
}

/** A row is the same shape; list responses may omit the heavy nested fields. */
export type PlaybookRow = Pick<
  Playbook,
  "id" | "use_case" | "version" | "name" | "status"
> &
  Partial<Playbook>

/* ------------------------------------------------------------------ */
/* fetch helper                                                        */
/* ------------------------------------------------------------------ */

async function api<T = any>(path: string): Promise<T> {
  const res = await fetch(path, { credentials: "include" })
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message = payload?.message || `Request failed (${res.status})`
    const err = new Error(message) as Error & { status?: number }
    err.status = res.status
    throw err
  }
  return payload as T
}

/* ------------------------------------------------------------------ */
/* Playbooks (assumed endpoints)                                       */
/* ------------------------------------------------------------------ */

/** List the compiled playbooks. 404 => endpoint not built yet (Phase 4). */
export function listPlaybooks(): Promise<{
  playbooks: PlaybookRow[]
  count?: number
}> {
  return api(`/admin/call-center/playbooks`)
}

/** Retrieve one full playbook by id. 404 => not built yet, or unknown id. */
export function getPlaybook(id: string): Promise<{ playbook: Playbook }> {
  return api(`/admin/call-center/playbooks/${id}`)
}

/** Display name: prefer an explicit `name`, else the persona name, else id. */
export function playbookName(p: {
  name?: string
  persona?: { name?: string }
  id: string
}): string {
  return p.name || p.persona?.name || p.id
}
