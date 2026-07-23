import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { MedusaRequest } from "@medusajs/framework/http"
import type { AiToolCall } from "../../../modules/marketing/ai/ai-provider"
import { PLATFORM_MODULE } from "../../../modules/platform"
import { notifyVoicePending } from "../../../modules/platform/push/push-notifier"
import { buildJarvisTools, TOOL_LABELS } from "./_tools"
import {
  WRITE_DEFINITIONS,
  WRITE_BY_NAME,
  WRITE_LABELS,
  isWriteTool,
} from "./_writes"
import { signPlan, planNonce } from "./_plan-token"

/**
 * Pixi VOICE bridge — lets the pipecat voice runtime hold a live spoken
 * conversation AS Pixi (the same brain, tools and tenant scoping as the
 * dashboard text chat), fully isolated from the AI call-center ("Ava").
 *
 * How it plugs in WITHOUT touching Ava:
 *   - A voice session is started for the reserved playbook id "jarvis"
 *     (JARVIS_VOICE_PLAYBOOK_ID). `/telephony/agent-config` short-circuits on
 *     that id and returns `buildJarvisVoiceConfig(...)` instead of a call-center
 *     Playbook — so the pipeline gets the Pixi system prompt + the Pixi
 *     tool schemas + the CHEAP provider hints.
 *   - Each in-call tool call arrives at `/telephony/tool-execute`; when the call
 *     row's playbook_id is "jarvis" it is routed to `executeJarvisVoiceTool(...)`
 *     instead of the call-center tool registry.
 *
 * TENANT ISOLATION: the voice runtime NEVER supplies the tenant to act on. The
 * start route stamps the merchant-session tenant onto the call row, and
 * tool-execute re-derives the AUTHORITATIVE tenant from that call row (see
 * tool-execute/route.ts). This module receives that already-anchored tenant and
 * rebuilds a server-side merchant context from it — the model's arguments can
 * never widen the tenant.
 *
 * CONFIRM GATE OVER VOICE: reads run freely. WRITES ARE NEVER EXECUTED OVER
 * VOICE. A write tool call only runs its non-mutating plan(), mints the exact
 * same tenant-bound HMAC plan token as the text chat, and records a PENDING
 * proposal the merchant confirms with a tap/typed word in the dashboard (which
 * posts the token to the existing `/merchant/jarvis/apply`). Voice can propose;
 * only a human tap in the UI moves money.
 */

export const JARVIS_VOICE_PLAYBOOK_ID = "jarvis"

type Ctx = { tenant: any; merchant: any; svc: any }

/**
 * Rebuild a merchant context from a tenant id alone (the voice path has no
 * merchant auth cookie — the tenant is anchored on the call row). Picks the
 * tenant's oldest active owner as the actor for audit provenance; falls back to
 * a synthetic actor so a tenant with no merchant row still works read-only.
 */
export async function reconstructMerchantCtx(
  scope: MedusaRequest["scope"],
  tenantId: string
): Promise<Ctx | null> {
  const svc: any = scope.resolve(PLATFORM_MODULE)
  const tenant = await svc.retrieveTenant(tenantId).catch(() => null)
  if (!tenant) return null
  const merchants = await svc
    .listMerchants(
      { tenant_id: tenantId, status: "active" },
      { take: 1, order: { created_at: "ASC" } }
    )
    .catch(() => [])
  const merchant =
    (Array.isArray(merchants) && merchants[0]) || {
      id: `voice:${tenantId}`,
      tenant_id: tenantId,
      email: null,
      name: null,
      status: "active",
    }
  return { merchant, tenant, svc }
}

/** Voice-adapted Pixi persona. Same capabilities, spoken-delivery rules. */
const VOICE_SYSTEM = (
  storeName: string,
  country: string,
  currency: string
): string =>
  `
You are Pixi, the AI operator for the ${storeName || "merchant"} store on mAutomate, speaking with the merchant over a LIVE PHONE/VOICE call.
You are the SAME assistant as the dashboard chat: you can look things up with read tools and you can PROPOSE changes.

Store facts: name="${storeName}", country=${country || "unknown"}, currency=${currency || "unknown"}.

READ freely to answer with real, live data (orders, sales, stock, readiness, attention items, customers, domain and call-center status, ads, visitors). NEVER guess a number, an order state, or a setup status — always look it up first. Lead with the answer.

ACTIONS over voice work differently from the text chat — THERE IS NO CONFIRM BUTTON ON A PHONE CALL:
- When the merchant clearly asks you to DO something (publish/add/restock/price a product, set up delivery, turn on a payment method, set country/currency, create or launch an ad campaign, post to social, reply to a customer, hand a chat to AI, fulfil an order, mark paid, capture, refund, cancel), CALL the matching action tool. It does NOT execute — it PREPARES the change and queues it for the merchant to approve.
- After calling an action tool, tell the merchant plainly: "I've prepared that — open your dashboard and tap Confirm on the Pixi card to apply it." For money or irreversible actions (refund, cancel, capture, mark paid, launch a campaign) add that they'll need to type the confirm word shown on the card. NEVER say the change is "done" — you cannot complete it over voice, only queue it.
- Never claim you executed anything. If asked "did it go through?", say it applies only once they confirm it in the dashboard, and offer to read back the current state.

Voice delivery:
- Speak in short, natural spoken sentences — this is read aloud by a text-to-speech voice. No markdown, no bullet characters, no headings, no emoji.
- Keep it to a sentence or two, then a short spoken list only if needed. Read money as whole units in the store currency (no cents).
- If a tool returns an error, say what went wrong in plain words — never read out internal ids or stack traces.
`.trim()

/**
 * Build the `/telephony/agent-config` payload for a Pixi voice session.
 * Returns the Pixi system prompt, the full Pixi tool catalog (reads +
 * writes) in OpenAI function-schema shape, and CHEAP provider hints the runtime
 * honours (Deepgram Aura-2 TTS + Novita/Kimi LLM). `req` only supplies a DI
 * scope; the tool closures it builds are not used here (definitions are static).
 */
export async function buildJarvisVoiceConfig(
  req: MedusaRequest,
  tenantId: string,
  locale?: string | null
): Promise<any | null> {
  const ctx = await reconstructMerchantCtx(req.scope, tenantId)
  if (!ctx) return null

  const meta = ctx.tenant.meta ?? {}
  const system = VOICE_SYSTEM(
    ctx.tenant.name,
    meta.default_country ?? "",
    (meta.currency_code ?? "").toUpperCase()
  )

  const { definitions } = buildJarvisTools(req, ctx as any)
  const allDefs = [...definitions, ...WRITE_DEFINITIONS]
  const tools = allDefs.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }))

  const storeName = ctx.tenant.name || "your store"
  return {
    playbook_id: JARVIS_VOICE_PLAYBOOK_ID,
    version: 1,
    locale: locale || "en",
    first_message: `Hey boss, it is Pixi. How can I help you today?`,
    system_prompt: system,
    tools,
    // CHEAPEST STACK. STT is always Deepgram nova-3 in the runtime. "piper"
    // here selects the FREE self-hosted Piper TTS (pm2 b2d-piper HTTP server
    // on 127.0.0.1:5060) via the runtimes gated piper branch; Ava keeps
    // ElevenLabs because its playbooks return "elevenlabs". `llm` pins the cheap
    // Novita/Kimi brain for THIS session only (Avas config carries no `llm`).
    voice: {
      provider: "deepgram",
      voice_id: "aura-2-thalia-en",
      language: locale || "en",
    },
    llm: { provider: "novita" },
    guardrails: {
      max_turns: 60,
      max_clarify: 3,
      save_offer_once: true,
      recording_disclosure: "",
    },
    disposition_set: ["resolved", "proposed_actions", "no_action", "handoff"],
    dtmf_map: {},
  }
}

/* --------------------------- pending proposals --------------------------- */

const PENDING_TABLE = "jarvis_voice_pending"

async function ensurePendingTable(pg: any): Promise<void> {
  await pg.raw(
    `CREATE TABLE IF NOT EXISTS ${PENDING_TABLE} (
      id text PRIMARY KEY,
      tenant_id text NOT NULL,
      call_id text,
      action text NOT NULL,
      tier text NOT NULL,
      require_text text,
      summary text,
      token text NOT NULL,
      exp bigint NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )`
  )
  await pg.raw(
    `CREATE INDEX IF NOT EXISTS idx_${PENDING_TABLE}_tenant ON ${PENDING_TABLE} (tenant_id)`
  )
}

/**
 * Persist a proposed voice write so the dashboard can surface it for a
 * tap/typed confirm. `id` is the plan nonce (== the /apply single-use audit
 * nonce), so once the merchant applies it, the pending list hides it by
 * anti-joining `jarvis_audit`.
 */
async function recordPending(
  scope: MedusaRequest["scope"],
  row: {
    tenantId: string
    callId: string
    action: string
    tier: string
    requireText: string | null
    summary: string
    token: string
    exp: number
  }
): Promise<void> {
  const pg: any = scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  await ensurePendingTable(pg)
  await pg(PENDING_TABLE)
    .insert({
      id: planNonce(row.token),
      tenant_id: row.tenantId,
      call_id: row.callId,
      action: row.action,
      tier: row.tier,
      require_text: row.requireText,
      summary: row.summary,
      token: row.token,
      exp: row.exp,
    })
    .onConflict("id")
    .ignore()
}

/** Live, unexpired, not-yet-applied voice proposals for a tenant. */
export async function listPendingVoiceActions(
  scope: MedusaRequest["scope"],
  tenantId: string
): Promise<any[]> {
  const pg: any = scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  await ensurePendingTable(pg)
  const now = Date.now()
  const rows = await pg(`${PENDING_TABLE} as p`)
    .leftJoin("jarvis_audit as a", "a.nonce", "p.id")
    .where("p.tenant_id", tenantId)
    .andWhere("p.exp", ">", now)
    .whereNull("a.nonce")
    .orderBy("p.created_at", "desc")
    .select(
      "p.id",
      "p.action",
      "p.tier",
      "p.require_text",
      "p.summary",
      "p.token",
      "p.exp",
      "p.call_id",
      "p.created_at"
    )
    .catch(() => [])
  return Array.isArray(rows) ? rows : []
}

/* ------------------------------ tool execute ----------------------------- */

/**
 * Execute one Pixi tool for a voice session. `tenantId` is the AUTHORITATIVE
 * tenant already anchored from the call row by the tool-execute route.
 *
 * Reads run and return their result. Writes are PROPOSED ONLY: plan() (no
 * mutation) -> mint tenant-bound plan token -> record pending -> return a
 * "proposed, confirm in the dashboard" result to the model. Always resolves to
 * the in-band tool-execute shape `{ result?, error? }` (never throws).
 */
export async function executeJarvisVoiceTool(
  req: MedusaRequest,
  input: {
    tenantId: string
    callId: string
    toolName: string
    args: Record<string, unknown>
  }
): Promise<{ result?: unknown; error?: string; action?: string }> {
  const { tenantId, callId, toolName, args } = input
  const ctx = await reconstructMerchantCtx(req.scope, tenantId)
  if (!ctx) return { error: "store not found" }

  const label = TOOL_LABELS[toolName] ?? WRITE_LABELS[toolName] ?? toolName

  // ---- WRITE: propose only, never execute over voice ----
  if (isWriteTool(toolName)) {
    const w = WRITE_BY_NAME[toolName]
    if (!w) return { error: "that action isn't available" }

    let planned: any
    try {
      planned = await w.plan(req, ctx as any, args as any)
    } catch {
      planned = { ok: false, error: "I couldn't prepare that change." }
    }
    if (!planned || planned.ok === false) {
      return {
        result: {
          proposed: false,
          error: (planned && planned.error) || "couldn't prepare that action",
        },
      }
    }

    let signed: { token: string; exp: number }
    try {
      signed = signPlan({
        tid: ctx.tenant.id,
        action: toolName,
        args: planned.apply_args,
        tier: w.tier,
        requireText: w.tier === "hard" ? w.requireText || "" : undefined,
        summary: planned.human_summary,
      })
    } catch {
      return { error: "the assistant isn't fully configured to make changes yet" }
    }

    try {
      await recordPending(req.scope, {
        tenantId: ctx.tenant.id,
        callId,
        action: toolName,
        tier: w.tier,
        requireText: w.tier === "hard" ? w.requireText || "" : null,
        summary: planned.human_summary,
        token: signed.token,
        exp: signed.exp,
      })
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error("[jarvis-voice] pending persist failed:", e?.message ?? e)
      // Still return proposed=true: the merchant can re-ask; nothing mutated.
    }

    // Additive, fail-closed push: a voice action is now pending the merchant's
    // confirmation. Gated by PUSH_ENABLED (default off, cost-zero) and wrapped —
    // a push must NEVER affect the proposal flow. Tenant is the AUTHORITATIVE
    // one anchored on the call row (ctx.tenant.id), never a model argument.
    if (process.env.PUSH_ENABLED === "1") {
      try {
        await notifyVoicePending(req.scope, ctx.tenant.id)
      } catch {
        // swallow — a failed push must not affect the proposal.
      }
    }

    return {
      result: {
        proposed: true,
        label,
        tier: w.tier,
        requires_typed_word: w.tier === "hard" ? w.requireText || null : null,
        summary: planned.human_summary,
        // Non-secret correlation key for the voice->card bridge: the plan nonce
        // is the jarvis_voice_pending PK, letting the client match the spoken
        // action card to the /voice/pending confirm token exactly (not by name).
        // The token itself is NEVER returned to the model; only its nonce.
        pending_id: planNonce(signed.token),
        exp: signed.exp,
        note:
          "PREPARED, not applied. Tell the merchant to open their dashboard and tap Confirm on the Pixi card" +
          (w.tier === "hard"
            ? ` (they'll type "${w.requireText || "the confirm word"}" first).`
            : ".") +
          " Do NOT say it's done; it applies only when they confirm.",
      },
    }
  }

  // ---- READ: run and return ----
  try {
    const { run } = buildJarvisTools(req, ctx as any)
    const call: AiToolCall = { id: callId, name: toolName, arguments: args } as any
    const result = await run(call)
    return { result }
  } catch (e: any) {
    return { error: (e?.message || "tool failed").slice(0, 200) }
  }
}
