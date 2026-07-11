import {
  getCurrentTenantId,
  resolveTenantId,
} from "../../../lib/tenant-context"
/**
 * Journey action executor — performs one `action` node against an enrollment.
 * The runner calls `executeAction`; each action type dispatches to email / DM /
 * tag / score / discount / webhook. Returns an `ActionResult` (ok + optional
 * context to merge back + optional stop). Never throws.
 *
 * Failure model:
 *  - A DEGRADED action (e.g. no DM credential connected) returns `ok:true` with
 *    a note in `context` so the journey keeps flowing.
 *  - A GENUINE send failure on the critical email path returns `ok:false` so the
 *    runner can retry.
 *  - Every branch is wrapped in try/catch → an ActionResult; nothing throws out.
 */
import type { MedusaContainer } from "@medusajs/framework/types"

import { MARKETING_MODULE } from ".."
import { resolveBrandName } from "../brand"
import { generateEmailCopy } from "../email/copy-service"
import { sendEmail } from "../email/send-service"
import { broadcastEmail, renderHandlebars } from "../email/templates"
import { getCommerceGateway } from "../gateway"
import { getMessagingProvider } from "../messaging"
import type { MessagingChannel } from "../messaging/types"
import { openCredentials } from "../publish/credentials"
import type { ActionResult, JourneyAction, JourneyContext } from "./types"

export type ExecuteActionInput = {
  tenantId: string
  action: JourneyAction
  enrollment: any
  context: JourneyContext
}

/** Default tenant when the enrollment/input carries none. */
const currentTenantId = (): string =>
  getCurrentTenantId() ?? resolveTenantId("MARKETING_DEFAULT_TENANT")

/** DM channel → connected social_account platform. */
const CHANNEL_TO_PLATFORM: Record<string, string> = {
  telegram: "telegram",
  messenger: "facebook",
  instagram: "instagram",
  whatsapp: "whatsapp",
}

/**
 * Execute a single journey action. Dispatches on `action.type`; each branch is
 * no-throw and returns an `ActionResult`.
 */
export const executeAction = async (
  container: MedusaContainer,
  input: ExecuteActionInput
): Promise<ActionResult> => {
  const tenantId = input.tenantId || currentTenantId()
  const { action, enrollment, context } = input
  const contact = (context.contact ?? null) as any
  const data = (context.data ?? {}) as Record<string, unknown>

  try {
    switch (action.type) {
      case "send_email":
        return await runSendEmail(container, tenantId, action, enrollment, contact, data)
      case "send_dm":
        return await runSendDm(container, tenantId, action, contact, data)
      case "add_tag":
        return await runTag(container, enrollment, action.tag, true)
      case "remove_tag":
        return await runTag(container, enrollment, action.tag, false)
      case "add_score":
        return await runScore(container, enrollment, action.points)
      case "discount":
        return await runDiscount(container, tenantId, action)
      case "webhook":
        return await runWebhook(action.url, context)
      default:
        return { ok: false, error: "unknown action" }
    }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "action failed" }
  }
}

// ---------------------------------------------------------------------------
// send_email
// ---------------------------------------------------------------------------

const runSendEmail = async (
  container: MedusaContainer,
  tenantId: string,
  action: Extract<JourneyAction, { type: "send_email" }>,
  enrollment: any,
  contact: any,
  data: Record<string, unknown>
): Promise<ActionResult> => {
  try {
    let subject = ""
    let html = ""

    if (action.template_id) {
      const svc: any = container.resolve(MARKETING_MODULE)
      const tpl = await svc.retrieveMarketingEmailTemplate(action.template_id)
      subject = tpl?.subject ?? ""
      html = tpl?.html ?? ""
    } else if (action.brief) {
      const copy = await generateEmailCopy(container, {
        tenantId,
        brief: action.brief,
        kind: "broadcast",
        brandVoiceId: action.brand_voice_id,
      })
      const brandName = await resolveBrandName(container, tenantId)
      const heading = copy.subject || action.subject || `News from ${brandName}`
      const built = broadcastEmail({
        brandName,
        heading,
        bodyHtml: copy.bodyHtml,
      })
      subject = copy.subject || built.subject
      html = built.html
    } else {
      subject = action.subject ?? ""
      html = action.html ?? ""
    }

    const tplCtx: Record<string, unknown> = { contact, ...data }
    const renderedSubject = renderHandlebars(subject, tplCtx)
    const renderedHtml = renderHandlebars(html, tplCtx)

    const recipient = (contact?.email ?? enrollment?.email) as string | undefined
    if (!recipient) {
      return { ok: false, error: "no recipient" }
    }

    const result = await sendEmail(container, {
      tenantId,
      to: recipient,
      contactId: enrollment?.contact_id ?? null,
      subject: renderedSubject,
      html: renderedHtml,
      campaignId: "journey",
    })

    // A suppressed recipient is not an error — the journey continues.
    if (result.ok || result.suppressed) {
      return { ok: true }
    }
    return { ok: false, error: result.error ?? "email send failed" }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "send_email failed" }
  }
}

// ---------------------------------------------------------------------------
// send_dm
// ---------------------------------------------------------------------------

const runSendDm = async (
  container: MedusaContainer,
  tenantId: string,
  action: Extract<JourneyAction, { type: "send_dm" }>,
  contact: any,
  data: Record<string, unknown>
): Promise<ActionResult> => {
  try {
    const channel = action.channel
    const platform = CHANNEL_TO_PLATFORM[channel]
    if (!platform) {
      return { ok: true, context: { dm_skipped: `unsupported channel: ${channel}` } }
    }

    const svc: any = container.resolve(MARKETING_MODULE)
    const accounts = await svc.listMarketingSocialAccounts({
      tenant_id: tenantId,
      platform,
      status: "connected",
    })
    const account = Array.isArray(accounts) ? accounts[0] : accounts
    if (!account?.id) {
      return { ok: true, context: { dm_skipped: `no connected ${platform} account` } }
    }

    const credentials = await openCredentials(svc, tenantId, account.id)
    if (!credentials?.accessToken) {
      return { ok: true, context: { dm_skipped: `no credential for ${platform}` } }
    }

    const externalIds = (contact?.meta?.external_ids ?? {}) as Record<string, unknown>
    const handle = (externalIds?.[channel] as string | undefined) ?? contact?.phone
    if (!handle) {
      return { ok: true, context: { dm_skipped: "no channel handle for contact" } }
    }

    const provider = getMessagingProvider(channel as MessagingChannel)
    if (!provider) {
      return { ok: true, context: { dm_skipped: `no messaging provider for ${channel}` } }
    }

    const result = await provider.sendMessage({
      channel: channel as MessagingChannel,
      externalThreadId: String(handle),
      credentials: { accessToken: credentials.accessToken, meta: credentials.meta },
      text: renderHandlebars(action.text, { contact, ...data }),
      media: [],
    })

    if (result.ok) {
      return { ok: true }
    }
    // Degrade — a DM is best-effort and must not stall the journey.
    return { ok: true, context: { dm_skipped: result.error?.message ?? "dm send failed" } }
  } catch (e: any) {
    return { ok: true, context: { dm_skipped: e?.message ?? "send_dm error" } }
  }
}

// ---------------------------------------------------------------------------
// add_tag / remove_tag
// ---------------------------------------------------------------------------

const runTag = async (
  container: MedusaContainer,
  enrollment: any,
  tag: string,
  add: boolean
): Promise<ActionResult> => {
  try {
    const contactId = enrollment?.contact_id
    if (!contactId) {
      return { ok: true, context: { tag_skipped: "no contact" } }
    }
    const svc: any = container.resolve(MARKETING_MODULE)
    const contact = await svc.retrieveMarketingContact(contactId)
    const current: string[] = Array.isArray(contact?.tags) ? contact.tags : []

    let next: string[]
    if (add) {
      next = current.includes(tag) ? current : [...current, tag]
    } else {
      next = current.filter((t) => t !== tag)
    }

    await svc.updateMarketingContacts({ id: contactId, tags: next } as any)
    return { ok: true, context: { tags: next } }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "tag update failed" }
  }
}

// ---------------------------------------------------------------------------
// add_score
// ---------------------------------------------------------------------------

const runScore = async (
  container: MedusaContainer,
  enrollment: any,
  points: number
): Promise<ActionResult> => {
  try {
    const contactId = enrollment?.contact_id
    if (!contactId) {
      return { ok: true, context: { score_skipped: "no contact" } }
    }
    const svc: any = container.resolve(MARKETING_MODULE)
    const contact = await svc.retrieveMarketingContact(contactId)
    const currentScore = typeof contact?.score === "number" ? contact.score : 0
    const newScore = currentScore + (typeof points === "number" ? points : 0)

    await svc.updateMarketingContacts({ id: contactId, score: newScore } as any)
    return { ok: true, context: { score: newScore } }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "score update failed" }
  }
}

// ---------------------------------------------------------------------------
// discount
// ---------------------------------------------------------------------------

const runDiscount = async (
  container: MedusaContainer,
  tenantId: string,
  action: Extract<JourneyAction, { type: "discount" }>
): Promise<ActionResult> => {
  try {
    const gateway = getCommerceGateway(container)
    const result = await gateway.createRecoveryDiscount(tenantId, {
      percentage: action.percentage,
      amount: action.amount,
      expiresInHours: action.expires_hours ?? 72,
      codePrefix: "JOURNEY",
    })
    if (result?.code) {
      // Expose the code so later email steps can use {{data.discount_code}}.
      return { ok: true, context: { discount_code: result.code } }
    }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "discount failed" }
  }
}

// ---------------------------------------------------------------------------
// webhook
// ---------------------------------------------------------------------------

const runWebhook = async (
  url: string,
  context: JourneyContext
): Promise<ActionResult> => {
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contact: context.contact, data: context.data }),
    })
  } catch {
    // Best-effort — a failed webhook must not stall the journey.
  }
  return { ok: true }
}
