import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CALL_CENTER_MODULE } from "../../../../modules/call-center"
import { defaultTenantId, validateTwilioSignature } from "../_twilio"

/**
 * POST /telephony/twilio/voice  (UNPREFIXED webhook — escapes /admin + /store auth)
 *
 * Twilio hits this when an inbound call connects. Auth is two-layered:
 *   1. coarse `x-telephony-secret` header gate (src/api/middlewares.ts),
 *   2. fine per-request Twilio signature (`validateTwilioSignature`).
 *
 * INBOUND TRUST ANCHOR (P4): the tenant + answering agent are resolved SOLELY
 * from the DIALED number (`To`) via the `call_center_phone_number` map. A
 * customer who dials tenant A's number can only ever reach tenant A's agent and
 * (through that agent's already-tenant-scoped tools) tenant A's data. There is
 * no way for the caller to influence which tenant they land in. Fail-CLOSED: an
 * unknown / inactive number is politely rejected, never silently routed to a
 * default tenant.
 *
 * We persist a `call_center_call` row keyed by `provider_call_id = CallSid`
 * (carrying the resolved tenant_id + playbook_id), then return TwiML that
 * streams the media to the voice runtime, passing tenant_id / playbook_id /
 * call_id as Stream <Parameter>s so the runtime pulls the RIGHT agent config.
 * NO-THROW on persistence: a DB hiccup still returns valid TwiML.
 */

const xmlEscape = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")

const reject = (res: MedusaResponse, message: string): void => {
  res
    .status(200)
    .type("text/xml")
    .send(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say>${xmlEscape(
        message
      )}</Say><Hangup/></Response>`
    )
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const body = (req.body ?? {}) as Record<string, string | undefined>
  const callSid = body.CallSid ?? ""
  const toNumber = (body.To ?? "").trim()
  const fromNumber = body.From ?? null

  // 1. Twilio signature (skipped only when TWILIO_AUTH_TOKEN is unset — dev).
  if (!validateTwilioSignature(req)) {
    res
      .status(403)
      .type("text/xml")
      .send(`<?xml version="1.0" encoding="UTF-8"?><Response><Reject/></Response>`)
    return
  }

  const service: any = req.scope.resolve(CALL_CENTER_MODULE)

  // 2. Resolve tenant + agent from the DIALED number. Fail-closed.
  let tenantId: string | null = null
  let playbookId: string | null = null
  try {
    const mappings = await service.listPhoneNumbers(
      { e164: toNumber, active: true },
      { take: 1 }
    )
    const mapping = Array.isArray(mappings) ? mappings[0] : null
    if (mapping) {
      tenantId = mapping.tenant_id ?? null
      playbookId = mapping.agent_id ?? null
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[telephony] inbound number lookup failed:", e)
  }

  if (!tenantId) {
    // Unknown / inactive number — do NOT fall back to a default tenant.
    // eslint-disable-next-line no-console
    console.warn(
      "[telephony] inbound call to unmapped number rejected:",
      toNumber
    )
    reject(
      res,
      "Sorry, this number is not currently in service. Goodbye."
    )
    return
  }

  // 3. Persist / update the call row (carrying the resolved tenant + agent).
  try {
    const existing =
      callSid &&
      (await service.listCalls(
        { provider_call_id: callSid, tenant_id: tenantId },
        { take: 1 }
      ))

    const record: Record<string, unknown> = {
      tenant_id: tenantId,
      playbook_id: playbookId,
      direction: "inbound" as const,
      status: "in_progress" as const,
      provider_call_id: callSid || null,
      from_number: fromNumber,
      to_number: toNumber || null,
      started_at: new Date(),
    }

    if (existing && existing.length) {
      await service.updateCalls({ id: existing[0].id, ...record })
    } else {
      await service.createCalls(record)
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(
      "[telephony] failed to persist inbound call (continuing so the call is not dropped):",
      e
    )
  }

  // 4. Stream to the voice runtime, passing the resolved identity as Stream
  //    <Parameter>s. The runtime reads these from Twilio's "start" event and
  //    pulls this exact tenant+agent config — the caller cannot influence them.
  const wsBase = (process.env.VOICE_AGENT_WS_URL ?? "").replace(/\/$/, "")
  const streamUrl = `${wsBase}/twilio/${encodeURIComponent(callSid)}`

  const params = [
    ["tenant_id", tenantId],
    ["playbook_id", playbookId ?? ""],
    ["call_id", callSid],
  ]
    .map(
      ([n, v]) =>
        `<Parameter name="${xmlEscape(n as string)}" value="${xmlEscape(
          String(v ?? "")
        )}"/>`
    )
    .join("")

  res
    .status(200)
    .type("text/xml")
    .send(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Connect><Stream url="${xmlEscape(
        streamUrl
      )}">${params}</Stream></Connect></Response>`
    )
}
