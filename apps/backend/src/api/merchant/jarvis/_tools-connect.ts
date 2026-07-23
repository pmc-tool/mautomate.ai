import { MedusaRequest } from "@medusajs/framework/http"
import type { AiToolDefinition } from "../../../modules/marketing/ai/ai-provider"
import { CALL_CENTER_MODULE } from "../../../modules/call-center"

/**
 * Pixi — CONNECT tools (domain + call-center status).
 *
 * Same contract as `_tools.ts`/`_tools-more.ts`: every handler is tenant-scoped
 * through the authenticated merchant context (`ctx`) — the tenant is NEVER read
 * from the model's arguments — and NEVER throws. A failure returns `{ error }`
 * (or an `available:false` payload) the model can read and explain, so a broken
 * tool degrades the answer instead of breaking the run.
 *
 * These two tools are pure REPORTING: they describe where the merchant is in the
 * self-serve domain-connect and call-center setup flows and hand back a short,
 * plain-language next step. They never mutate anything and they never touch a
 * registrar or carrier — the merchant must finish those steps themselves.
 */

type Ctx = { tenant: any; merchant: any; svc: any }

const ROOT = process.env.PLATFORM_ROOT_DOMAIN ?? "mautomate.ai"

/* -------------------------------- domains -------------------------------- */

// A custom domain is "live" once the platform has proven ownership AND issued a
// certificate for it — anything short of both means the browser can't reach it.
const isVerified = (d: any) =>
  ["verified", "active"].includes(String(d?.verification_status ?? "").toLowerCase())
const isSslActive = (d: any) =>
  String(d?.ssl_status ?? "").toLowerCase() === "active"
const isLive = (d: any) => isVerified(d) && isSslActive(d)

/**
 * Where the store stands on domains: its default *.mautomate.ai address, any
 * connected custom domains and whether they're live, plus a one-line next step.
 */
export async function domainStatus(req: MedusaRequest, ctx: Ctx) {
  try {
    const rows: any[] =
      (await ctx.svc.listTenantDomains({ tenant_id: ctx.tenant.id })) || []

    const freeRow = rows.find((d) => d.type === "free")
    const default_address = freeRow?.domain ?? `${ROOT}`

    const custom_domains = rows
      .filter((d) => d.type !== "free")
      .map((d) => ({
        domain: d.domain,
        is_primary: !!d.is_primary,
        ssl_status: d.ssl_status ?? null,
        verification_status: d.verification_status ?? null,
        live: isLive(d),
      }))

    const liveDomain = custom_domains.find((d) => d.live)
    const pendingDomain = custom_domains.find((d) => !d.live)
    const connected = !!liveDomain
    const pending = !!pendingDomain

    let guidance: string
    if (connected) {
      guidance = `Your custom domain ${liveDomain!.domain} is live.`
    } else if (pending) {
      guidance = `You've added ${pendingDomain!.domain} but it isn't verified yet — finish the nameserver/DNS change at your registrar and click Verify in Settings → Domains.`
    } else {
      guidance = `Your store is live at ${default_address}. To use your own domain, go to Settings → Domains, enter it, then change your domain's nameservers at your registrar and click Verify — I can't change settings at your registrar for you.`
    }

    return {
      default_address,
      custom_domains,
      connected,
      pending,
      guidance,
    }
  } catch (e: any) {
    return { error: e?.message || "could not read domains" }
  }
}

/* ------------------------------ call center ------------------------------ */

/**
 * Where the store stands on the AI call center: how many agents exist and how
 * many are published/live, how many phone numbers are attached, today's call
 * count, and the next step to get to a usable voice assistant.
 */
export async function callCenterStatus(req: MedusaRequest, ctx: Ctx) {
  const tenant_id = ctx.tenant?.id ?? ctx.merchant?.tenant_id
  let cc: any
  try {
    cc = req.scope.resolve(CALL_CENTER_MODULE)
  } catch {
    return {
      available: false,
      guidance: "The call center isn't enabled on this store.",
    }
  }

  try {
    const [agents = [], agentCount = 0] = await cc.listAndCountPlaybooks(
      { tenant_id },
      { take: 200, order: { created_at: "DESC" } }
    )
    const publishedAgents = (agents as any[]).filter(
      (a) => a?.status === "published"
    )
    const publishedCount = publishedAgents.length

    const numbers: any[] =
      (await cc.listPhoneNumbers(
        { tenant_id },
        { take: 200, order: { created_at: "DESC" } }
      )) || []
    const numberCount = numbers.length

    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    const [, callsTodayCount = 0] = await cc.listAndCountCalls(
      { tenant_id, created_at: { $gte: startOfToday } },
      { take: 1 }
    )

    const ready = publishedCount > 0
    // Name the live/ready agent when we can, otherwise fall back to any agent.
    const liveAgent = publishedAgents[0] ?? (agents as any[])[0] ?? null
    const agentName = liveAgent?.name ?? "your agent"
    const firstNumber = numbers[0]?.e164 ?? null

    let guidance: string
    if (agentCount === 0) {
      guidance =
        "You don't have an AI voice agent yet. Go to Call Center to create and train one (like 'Ava'), then publish it."
    } else if (numberCount === 0) {
      guidance = `Your agent ${agentName} is ready for web calls. To take real phone calls, buy and attach a phone number in Call Center → Phone Numbers.`
    } else {
      guidance = `Your AI agent ${agentName} is live on ${firstNumber}.`
    }

    return {
      available: true,
      agents: agentCount,
      published: publishedCount,
      phone_numbers: numberCount,
      calls_today: callsTodayCount,
      ready,
      guidance,
    }
  } catch (e: any) {
    return { available: true, error: e?.message || "could not read call center" }
  }
}

/* ----------------------- tool catalog + dispatcher ----------------------- */

export const CONNECT_TOOL_DEFS: AiToolDefinition[] = [
  {
    name: "domain_status",
    description:
      "Report whether the store has connected its own custom domain: the default *.mautomate.ai address, any custom domains and whether they're live, and the exact next step. Use for 'is my domain connected', 'custom domain', 'website address', 'how do I connect my domain', 'why isn't my domain working'.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "call_center_status",
    description:
      "Report the AI call center setup: how many voice agents exist and how many are published, how many phone numbers are attached, today's calls, and the next step. Use for 'is my call center set up', 'AI phone agent', 'voice assistant', 'phone number'.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
]

/** Short human label for the live "Pixi is doing X" stream event. */
export const CONNECT_TOOL_LABELS: Record<string, string> = {
  domain_status: "Checking your domain setup",
  call_center_status: "Checking your call center",
}

/** Dispatch one CONNECT tool call → its JSON-serialisable result. Never throws. */
export async function runConnectTool(
  req: MedusaRequest,
  ctx: Ctx,
  name: string,
  args: Record<string, any>
): Promise<unknown> {
  try {
    switch (name) {
      case "domain_status":
        return await domainStatus(req, ctx)
      case "call_center_status":
        return await callCenterStatus(req, ctx)
      default:
        return { error: "unknown" }
    }
  } catch (e: any) {
    return { error: e?.message || "tool failed" }
  }
}
