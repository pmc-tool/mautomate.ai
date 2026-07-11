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

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const body = (req.body ?? {}) as AgentConfigBody
  const playbookId = (body.playbook_id ?? "").trim()
  const tenantId =
    (body.tenant_id ?? "").trim() ||
    resolveTenantId("CALL_CENTER_DEFAULT_TENANT")

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
  const systemPrompt = compileSystemPrompt(playbook, mergeData)

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
    first_message: firstMessage,
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
