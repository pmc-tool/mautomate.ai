import { resolveTenantId } from "../../../lib/tenant-context"
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getCommerceGateway } from "../../../modules/call-center/gateway"
import type { CommerceOrder } from "../../../modules/call-center/gateway"
import {
  compileSystemPrompt,
  getPlaybook,
} from "../../../modules/call-center/playbooks"
import { loadDbPlaybook } from "./_db-playbook"
import type { MergeData } from "../../../modules/call-center/playbooks"
import { CALL_CENTER_MODULE } from "../../../modules/call-center"
import { PLATFORM_MODULE } from "../../../modules/platform"
import {
  JARVIS_VOICE_PLAYBOOK_ID,
  buildJarvisVoiceConfig,
} from "../../merchant/jarvis/_voice"

/**
 * POST /telephony/agent-config  (UNPREFIXED — secret-gated by the
 * `/telephony/*` `x-telephony-secret` middleware in `src/api/middlewares.ts`).
 *
 * The voice runtime fetches this when a call starts. It resolves the requested
 * playbook, (optionally) loads the order via the CommerceGateway, whitelists a
 * merge-data set down to the playbook's `merge_fields`, and returns a fully
 * compiled agent config: the interpolated first line, a freshly compiled system
 * prompt, the tools in OpenAI function-schema shape, the voice persona, the
 * guardrails, and the closed disposition set.
 *
 * NO-THROW: order lookups are best-effort (the call must still connect even if
 * the order can't be read). The only hard failure is an unknown playbook → 404.
 */

type AgentConfigBody = {
  call_id?: string
  call_task_id?: string
  order_id?: string
  playbook_id?: string
  tenant_id?: string
  locale?: string
}

/**
 * Build the FULL candidate merge map from a normalized order. The caller then
 * filters this down to the playbook's `merge_fields` whitelist so only approved
 * fields ever reach the prompt.
 */
const buildCandidateMergeData = (order: CommerceOrder): MergeData => {
  const itemSummary = order.items
    .map((i) => `${i.quantity}x ${i.title}`)
    .join(", ")
  const itemCount = order.items.reduce((sum, i) => sum + (i.quantity ?? 0), 0)
  const addr = order.shipping_address

  return {
    order_id: order.id,
    display_id: order.display_id,
    customer_name: addr?.name ?? null,
    email: order.email,
    phone: order.phone ?? addr?.phone ?? null,
    order_total: order.total,
    currency_code: order.currency_code,
    item_summary: itemSummary,
    item_count: itemCount,
    shipping_city: addr?.city ?? null,
    shipping_address_1: addr?.address_1 ?? null,
    shipping_address_2: addr?.address_2 ?? null,
    shipping_province: addr?.province ?? null,
    shipping_postal_code: addr?.postal_code ?? null,
    payment_status: order.payment_status,
    fulfillment_status: order.fulfillment_status,
    status: order.status,
  }
}

/** Keep only the whitelisted `merge_fields` keys from the candidate map. */
const applyMergeWhitelist = (
  candidate: MergeData,
  mergeFields: string[]
): MergeData => {
  const out: MergeData = {}
  for (const field of mergeFields) {
    out[field] = candidate[field] ?? null
  }
  return out
}

/** Interpolate `{{token}}` markers using the whitelisted merge data. */
const interpolateFirstMessage = (
  template: string,
  data: MergeData
): string => {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key: string) => {
    const value = data[key]
    return value === undefined || value === null ? "" : String(value)
  })
}

/**
 * CALLER MEMORY — best-effort context about a RETURNING caller, appended to the
 * system prompt so the agent can greet a known customer like a person would
 * ("Is this about the order from Tuesday?") instead of starting from zero.
 *
 * Everything here is SERVER-VERIFIED: it comes from the call row and
 * tenant-scoped gateway/call-history reads — never from anything the caller
 * said. The prompt block explicitly instructs the model to confirm identity
 * before using any of it (caller-ID is spoofable). Web test calls carry no
 * phone number, so they naturally produce no context.
 *
 * NO-THROW: any failure returns "" and the call connects without memory.
 */
/**
 * The caller's display name, when we can know it: an explicit
 * `metadata.customer_name` on the call row (web calls from a logged-in
 * account set this) wins; otherwise the phone number is matched against the
 * tenant's recent orders. First name only — natural over voice. Best-effort.
 */
const lookupCallerName = async (
  scope: MedusaRequest["scope"],
  tenantId: string,
  callId: string | undefined
): Promise<string | null> => {
  if (!callId) return null
  try {
    const cc: any = scope.resolve(CALL_CENTER_MODULE)
    const call = await cc.retrieveCall(callId).catch(() => null)
    if (!call || call.tenant_id !== tenantId) return null
    const metaName = (call as any)?.metadata?.customer_name
    if (typeof metaName === "string" && metaName.trim()) {
      return metaName.trim().split(/\s+/)[0]
    }
    const phone =
      call.direction === "outbound" ? call.to_number : call.from_number
    if (!phone) return null
    const gateway = getCommerceGateway(scope)
    const orders = await gateway.findOrders(tenantId, { phone })
    const name = (orders ?? [])[0]?.shipping_address?.name
    if (typeof name === "string" && name.trim()) {
      return name.trim().split(/\s+/)[0]
    }
  } catch {
    /* best-effort */
  }
  return null
}

/**
 * Final greeting text. Supports {store_name}/{store} and
 * {customer_name}/{name} placeholders; when the caller is known but the
 * template has no name placeholder, the name is prefixed ("Hi Sarah! ...").
 * The result is a FIXED string per (store, caller), which is what lets the
 * voice runtime serve it from the recorded-audio cache instead of paying TTS
 * on every call.
 */
const resolveGreeting = (
  template: string,
  storeName: string,
  callerName: string | null
): string => {
  let t =
    template && template.trim()
      ? template
      : "Thanks for calling {store_name}! How can I help you today?"
  t = t.replace(/\{store_name\}|\{store\}/gi, storeName || "our store")
  if (callerName) {
    if (/\{customer_name\}|\{name\}/i.test(t)) {
      t = t.replace(/\{customer_name\}|\{name\}/gi, callerName)
    } else {
      // Strip the template's own generic salutation so we never say
      // "Hi Alex! Hi! Thanks for calling..."
      t = t.replace(/^(hi|hello|hey|hi there|hello there)[!,.]?\s+/i, "")
      t = `Hi ${callerName}! ` + t
    }
  } else {
    t = t.replace(/\s*\{customer_name\}|\s*\{name\}/gi, "")
  }
  return t.replace(/\s{2,}/g, " ").trim()
}

const buildCallerContext = async (
  scope: MedusaRequest["scope"],
  tenantId: string,
  callId: string | undefined,
  bodyOrderId: string | undefined
): Promise<string> => {
  try {
    const lines: string[] = []
    let call: any = null

    if (callId) {
      const cc: any = scope.resolve(CALL_CENTER_MODULE)
      call = await cc.retrieveCall(callId).catch(() => null)
      // Fail-closed: a call row from another tenant contributes nothing.
      if (call && call.tenant_id !== tenantId) call = null

      const phone: string | null =
        call?.direction === "outbound"
          ? call?.to_number ?? null
          : call?.from_number ?? null

      if (call && phone) {
        // Past completed calls from the same number — the returning-caller signal.
        try {
          const prev = await cc.listCalls(
            {
              tenant_id: tenantId,
              status: "completed",
              ...(call.direction === "outbound"
                ? { to_number: phone }
                : { from_number: phone }),
            },
            { take: 4, order: { started_at: "DESC" } }
          )
          const past = (prev ?? [])
            .filter((c: any) => c.id !== call.id && (c.summary || c.disposition))
            .slice(0, 3)
          if (past.length) {
            lines.push(
              `This caller has spoken with us before (${past.length} recent call${
                past.length > 1 ? "s" : ""
              }, newest first):`
            )
            for (const c of past) {
              const when = c.started_at
                ? new Date(c.started_at).toISOString().slice(0, 10)
                : null
              const bits = [when, c.disposition, c.summary].filter(Boolean)
              lines.push(`- ${bits.join(" — ")}`)
            }
          }
        } catch {
          /* best-effort */
        }

        // Recent orders tied to that phone number (tenant-scoped, fuzzy match).
        try {
          const gateway = getCommerceGateway(scope)
          const orders = await gateway.findOrders(tenantId, { phone })
          const recent = (orders ?? []).slice(0, 2)
          if (recent.length) {
            lines.push("Recent orders on this caller's phone number:")
            for (const o of recent) {
              const items = (o.items ?? [])
                .map((i) => `${i.quantity}x ${i.title}`)
                .join(", ")
              const status = [o.status, o.fulfillment_status]
                .filter(Boolean)
                .join(", ")
              lines.push(
                `- Order #${o.display_id}${status ? ` (${status})` : ""}${
                  items ? ` — ${items}` : ""
                }`
              )
            }
          }
        } catch {
          /* best-effort */
        }
      }
    }

    // An order linked on the call row that the merge-data path didn't cover.
    const linkedOrderId: string | null =
      call?.order_id && call.order_id !== bodyOrderId ? call.order_id : null
    if (linkedOrderId) {
      try {
        const gateway = getCommerceGateway(scope)
        const o = await gateway.getOrder(tenantId, linkedOrderId)
        if (o) {
          lines.push(
            `This call is linked to order #${o.display_id} (${[
              o.status,
              o.fulfillment_status,
            ]
              .filter(Boolean)
              .join(", ")}).`
          )
        }
      } catch {
        /* best-effort */
      }
    }

    if (!lines.length) return ""
    return (
      "\n\n[Caller context — verified from our own records, not from the caller]\n" +
      lines.join("\n") +
      "\n\nUse this naturally: if this is clearly a returning caller, greet them " +
      "like one and pick up where the last conversation left off instead of " +
      "starting from zero. Caller ID can be spoofed, so confirm you are " +
      "speaking with the right person (their name, or the order number) before " +
      "revealing order details, and never read out full contact details."
    )
  } catch {
    return ""
  }
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const body = (req.body ?? {}) as AgentConfigBody
  const playbookId = (body.playbook_id ?? "").trim()
  const tenantId =
    (body.tenant_id ?? "").trim() ||
    resolveTenantId("CALL_CENTER_DEFAULT_TENANT")

  // Jarvis voice session: a reserved playbook id served by the Jarvis bridge
  // (same brain/tools/tenant scoping as the dashboard chat), NOT a call-center
  // Playbook. Isolated from Ava. tenant_id here is server-set by the start route
  // (the caller cannot influence it); tool-execute re-anchors it from the call
  // row too. Returns early with the compiled Jarvis agent config.
  if (playbookId === JARVIS_VOICE_PLAYBOOK_ID) {
    const jarvisConfig = await buildJarvisVoiceConfig(
      req,
      tenantId,
      body.locale ?? null
    )
    if (!jarvisConfig) {
      res
        .status(404)
        .json({ type: "not_found", message: "Jarvis voice: store not found." })
      return
    }
    res.status(200).json(jarvisConfig)
    return
  }

  // Static in-code registry first (the two reference playbooks); then fall
  // back to a merchant-trained playbook stored in the DB for this tenant.
  let playbook = playbookId ? getPlaybook(playbookId) : null
  if (!playbook && playbookId) {
    playbook = await loadDbPlaybook(req.scope, playbookId, tenantId)
  }
  if (!playbook) {
    res.status(404).json({
      type: "not_found",
      message: `No playbook registered for id "${playbookId}".`,
    })
    return
  }

  // Best-effort order load → whitelisted merge data. Never let a read failure
  // block the call config; fall back to an empty (all-null) whitelist.
  let mergeData: MergeData = applyMergeWhitelist({}, playbook.merge_fields)
  if (body.order_id) {
    try {
      const gateway = getCommerceGateway(req.scope)
      const order = await gateway.getOrder(tenantId, body.order_id)
      if (order) {
        mergeData = applyMergeWhitelist(
          buildCandidateMergeData(order),
          playbook.merge_fields
        )
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(
        "[telephony] agent-config: order lookup failed (continuing with empty merge data):",
        e
      )
    }
  }

  const firstMessage = interpolateFirstMessage(
    playbook.first_message,
    mergeData
  )
  // Personalized, cacheable greeting: store name always; caller name when
  // the number matches a customer or the session provided one.
  let storeName = ""
  try {
    const platform: any = req.scope.resolve(PLATFORM_MODULE)
    const tenant = await platform.retrieveTenant(tenantId)
    storeName = tenant?.name ?? ""
  } catch {
    /* best-effort */
  }
  const callerName = await lookupCallerName(req.scope, tenantId, body.call_id)
  const greeting = resolveGreeting(firstMessage, storeName, callerName)

  const callerContext = await buildCallerContext(
    req.scope,
    tenantId,
    body.call_id,
    body.order_id
  )
  const systemPrompt = compileSystemPrompt(playbook, mergeData) + callerContext

  // Map the playbook tools into the OpenAI function-calling schema shape the
  // runtime forwards to the model.
  const tools = playbook.tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }))

  res.status(200).json({
    playbook_id: playbook.id,
    version: playbook.version,
    locale: body.locale ?? playbook.persona.language,
    first_message: greeting,
    store_name: storeName,
    caller_name: callerName,
    system_prompt: systemPrompt,
    tools,
    voice: {
      provider: playbook.persona.voice_provider,
      voice_id: playbook.persona.voice_id ?? null,
      language: playbook.persona.language,
    },
    guardrails: playbook.guardrails,
    disposition_set: playbook.disposition_set,
    // Keypad shortcuts (digit -> intent). The voice runtime maps a DTMF press
    // to the mapped intent and injects it as an explicit signal to the model —
    // robust to weak Bengali STT. Empty object when the playbook defines none.
    dtmf_map: playbook.dtmf_map ?? {},
  })
}
