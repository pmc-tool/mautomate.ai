import { resolveTenantId } from "../../../lib/tenant-context"
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { CALL_CENTER_MODULE } from "../../../modules/call-center"
import { getCommerceGateway } from "../../../modules/call-center/gateway"
import { getTool, ToolContext } from "../../../modules/call-center/tools/registry"

/**
 * POST /telephony/tool-execute  (UNPREFIXED — escapes /admin + /store auth)
 *
 * The single entrypoint the voice runtime calls to ACT on an order mid-call.
 * Body: `{ call_id, tenant_id, tool_name, arguments }`.
 *
 * CONTRACT — "always 200, errors in-band": this endpoint ALWAYS returns HTTP
 * 200. Failures (unknown tool, validation, thrown handler) come back as
 * `{ error: <sanitized, <=200 chars> }` in the body — NEVER a non-200 and never
 * a stack trace. That lets the LLM read the error and degrade gracefully
 * instead of seeing an opaque transport failure.
 *
 * Success is `{ result, action? }` where `action` (e.g. "transfer",
 * "end_call") tells the runtime to change call flow.
 *
 * Auth: coarse `x-telephony-secret` middleware gate (owned by middlewares.ts);
 * this handler trusts that gate.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const body = (req.body ?? {}) as Record<string, unknown>

  const callId = typeof body.call_id === "string" ? body.call_id : ""
  // The tenant CLAIMED by the caller. This is UNTRUSTED input — a pooled
  // multi-tenant deployment must never let the caller pick which tenant's data
  // an action touches. Below we derive the AUTHORITATIVE tenant from the call
  // row and only fall back to this claim when no call row anchors it.
  const claimedTenantId =
    (typeof body.tenant_id === "string" && body.tenant_id) ||
    (resolveTenantId("CALL_CENTER_DEFAULT_TENANT"))
  const toolName = typeof body.tool_name === "string" ? body.tool_name : ""
  const toolArgs =
    body.arguments && typeof body.arguments === "object"
      ? (body.arguments as Record<string, unknown>)
      : {}

  const tool = getTool(toolName)
  if (!tool) {
    res.status(200).json({ error: "unknown tool" })
    return
  }

  try {
    const cc = req.scope.resolve(CALL_CENTER_MODULE)

    // TRUST ANCHOR: resolve the tenant from the CALL ROW (by call_id), not from
    // the request body. Mirrors the findCall helper in tools/registry.ts: try
    // retrieveCall first, fall back to a provider_call_id lookup.
    let call: any = null
    try {
      call = await cc.retrieveCall(callId)
    } catch {
      // retrieveCall throws on not-found — fall through to provider lookup.
    }
    if (!call) {
      try {
        const rows = await cc.listCalls(
          { provider_call_id: callId },
          { take: 1 }
        )
        call = rows?.[0] ?? null
      } catch {
        call = null
      }
    }

    let tenantId = claimedTenantId
    if (call && typeof call.tenant_id === "string" && call.tenant_id) {
      // Authoritative: the call row's tenant always wins.
      tenantId = call.tenant_id
      if (
        typeof body.tenant_id === "string" &&
        body.tenant_id &&
        body.tenant_id !== call.tenant_id
      ) {
        // Red flag: the caller claimed a different tenant than the call belongs
        // to. Override with the call row's value and record the mismatch.
        console.error(
          "[telephony] tool-execute tenant mismatch: body=%s call=%s call_id=%s",
          body.tenant_id,
          call.tenant_id,
          callId
        )
      }
    } else {
      // No call row anchored the tenant (e.g. a smoke test). Fall back to the
      // body/default claim, but flag that nothing authoritative backed it.
      console.warn(
        "[telephony] tool-execute: no call row for call_id=%s; falling back to claimed tenant=%s",
        callId,
        claimedTenantId
      )
    }

    const ctx: ToolContext = {
      container: req.scope,
      tenantId,
      callId,
      gateway: getCommerceGateway(req.scope),
      cc,
    }

    const out = await tool.handler(ctx, toolArgs)
    res.status(200).json(out)
  } catch (e) {
    // Sanitize: message only, capped — never leak a stack trace to the runtime.
    const message = e instanceof Error ? e.message : String(e)
    res.status(200).json({ error: message.slice(0, 200) })
  }
}
