import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { CALL_CENTER_MODULE } from "../../../../modules/call-center"
import { validateVonageJwt } from "../_vonage"
import { streamAuthToken } from "../../_stream-auth"

/**
 * GET|POST /telephony/vonage/answer  (UNPREFIXED webhook)
 *
 * Vonage's answer webhook for the platform Voice Application. Mirrors the
 * Twilio voice route's trust model exactly: the tenant + answering agent are
 * resolved SOLELY from the DIALED number, fail-closed, and the response is an
 * NCCO that connects the call's media to the voice runtime over a websocket
 * (16kHz linear PCM), carrying tenant_id / playbook_id / call_id / auth as
 * query params on the stream URI (server-set — the caller can't influence
 * them; the voice-agent verifies `auth`).
 *
 * Vonage sends GET with query params by default, or POST JSON when the
 * application is configured that way — both are handled.
 */

const talk = (res: MedusaResponse, text: string): void => {
  res.status(200).json([{ action: "talk", text }])
}

const handler = async (req: MedusaRequest, res: MedusaResponse) => {
  if (!validateVonageJwt(req)) {
    return res.status(403).json({ message: "invalid signature" })
  }

  const q = (req.query ?? {}) as Record<string, string | undefined>
  const b = (req.body ?? {}) as Record<string, string | undefined>
  const callUuid = b.uuid ?? q.uuid ?? ""
  const toRaw = (b.to ?? q.to ?? "").trim()
  const fromRaw = (b.from ?? q.from ?? "").trim()
  const toNumber = toRaw ? (toRaw.startsWith("+") ? toRaw : `+${toRaw}`) : ""
  const fromNumber = fromRaw ? (fromRaw.startsWith("+") ? fromRaw : `+${fromRaw}`) : null

  const service: any = req.scope.resolve(CALL_CENTER_MODULE)

  // Resolve tenant + agent from the DIALED number. Fail-closed.
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
    console.error("[telephony] vonage inbound number lookup failed:", e)
  }

  if (!tenantId) {
    // eslint-disable-next-line no-console
    console.warn("[telephony] vonage call to unmapped number rejected:", toNumber)
    return talk(res, "Sorry, this number is not currently in service. Goodbye.")
  }

  // Persist / update the call row (no-throw: a DB hiccup must not drop the call).
  try {
    const existing =
      callUuid &&
      (await service.listCalls(
        { provider_call_id: callUuid, tenant_id: tenantId },
        { take: 1 }
      ))
    const record: Record<string, unknown> = {
      tenant_id: tenantId,
      playbook_id: playbookId,
      direction: "inbound" as const,
      status: "in_progress" as const,
      provider_call_id: callUuid || null,
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
    console.error("[telephony] failed to persist vonage inbound call:", e)
  }

  const wsBase = (process.env.VOICE_AGENT_WS_URL ?? "").replace(/\/$/, "")
  const params = new URLSearchParams({
    tenant_id: tenantId,
    playbook_id: playbookId ?? "",
    call_id: callUuid,
    auth: streamAuthToken(callUuid),
  })
  const streamUri = `${wsBase}/vonage/${encodeURIComponent(
    callUuid
  )}?${params.toString()}`

  res.status(200).json([
    {
      action: "connect",
      endpoint: [
        {
          type: "websocket",
          uri: streamUri,
          "content-type": "audio/l16;rate=16000",
          headers: {
            tenant_id: tenantId,
            playbook_id: playbookId ?? "",
            call_id: callUuid,
          },
        },
      ],
    },
  ])
}

export const GET = handler
export const POST = handler
