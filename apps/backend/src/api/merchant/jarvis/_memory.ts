import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { MedusaRequest } from "@medusajs/framework/http"

/**
 * Pixi memory — a lightweight per-shop "second brain".
 *
 * Notes the merchant asks Pixi to remember are stored tenant-scoped in
 * `jarvis_memory` and folded back into the system prompt on every run, so Pixi
 * carries context across sessions ("we ship only within Dhaka", "my supplier
 * restocks on Mondays"). Strictly tenant-isolated: the tenant is the session's,
 * never a model argument, and recall only ever loads THIS tenant's notes.
 */

const pgOf = (req: MedusaRequest) =>
  req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)

/** Load the most recent notes for a tenant (newest first), capped. */
export async function loadNotes(
  req: MedusaRequest,
  tenantId: string,
  limit = 12
): Promise<string[]> {
  if (!tenantId) return []
  try {
    const rows = await pgOf(req)("jarvis_memory")
      .select("note")
      .where({ tenant_id: tenantId })
      .orderBy("created_at", "desc")
      .limit(limit)
    return (rows || []).map((r: any) => String(r.note)).filter(Boolean)
  } catch {
    return []
  }
}

/** Append a note for a tenant. Returns the saved note or an error object. */
export async function addNote(
  req: MedusaRequest,
  tenantId: string,
  note: string
): Promise<{ saved: string } | { error: string }> {
  const clean = String(note ?? "").trim().slice(0, 500)
  if (!tenantId) return { error: "no store context" }
  if (!clean) return { error: "there was nothing to remember" }
  try {
    await pgOf(req)("jarvis_memory").insert({ tenant_id: tenantId, note: clean })
    return { saved: clean }
  } catch {
    return { error: "couldn't save that just now" }
  }
}

/** Render notes as a compact block for the system prompt (empty string if none). */
export function notesForPrompt(notes: string[]): string {
  if (!notes.length) return ""
  const lines = notes.slice(0, 12).map((n) => `- ${n}`).join("\n")
  return `\nThings the merchant has asked you to remember about this shop:\n${lines}\n`
}
