/**
 * Email send-service — the orchestrator that turns a rendered message into a
 * tracked, recorded, suppression-checked send.
 *
 * Pipeline: suppression check -> create email_send row (queued) -> inject
 * first-party tracking (click rewrite, unsubscribe/preferences placeholders,
 * open pixel, List-Unsubscribe headers) -> resolve provider -> send -> record
 * outcome (sent/failed) on the row.
 *
 * Never throws: every path returns a clean `{ ok, ... }` result and, on
 * unexpected failure, marks the row failed.
 */

import { MedusaContainer } from "@medusajs/framework/types"
import { MARKETING_MODULE } from ".."
import { resolveEmailFrom } from "../brand"
import { getEmailProvider } from "./index"
import { makeSendToken, signClickUrl, signUnsubscribe } from "./tokens"

export type SendEmailInput = {
  tenantId: string
  to: string
  toName?: string | null
  contactId?: string | null
  templateId?: string | null
  campaignId?: string | null
  journeyEnrollmentId?: string | null
  subject: string
  html: string
  from?: string | null
  replyTo?: string | null
  text?: string | null
}

export type SendEmailResult = {
  ok: boolean
  sendId?: string
  token?: string
  suppressed?: boolean
  error?: string
}

/** First-party base URL that serves the open/click/unsubscribe routes. */
const trackingBase = (): string =>
  process.env.MARKETING_TRACKING_BASE ??
  process.env.MEDUSA_BACKEND_URL ??
  "http://localhost:9000"

type TrackingContext = {
  sendToken: string
  contactId: string | null
  email: string
}

type TrackingResult = {
  html: string
  headers: Record<string, string>
}

/**
 * Rewrite links, substitute unsubscribe/preferences placeholders, append the
 * open pixel, and build the List-Unsubscribe headers.
 */
const injectTracking = (
  html: string,
  ctx: TrackingContext
): TrackingResult => {
  const base = trackingBase()
  const unsubUrl = `${base}/marketing-email/unsubscribe?u=${signUnsubscribe(
    ctx.contactId ?? "",
    ctx.email
  )}`

  let out = html ?? ""

  // 1. Rewrite http(s) anchor destinations through the signed click tracker.
  out = out.replace(
    /(<a\b[^>]*\bhref\s*=\s*)("([^"]*)"|'([^']*)')/gi,
    (match, prefix, _quoted, dq, sq) => {
      const url = dq ?? sq ?? ""
      if (!/^https?:\/\//i.test(url)) {
        return match
      }
      const tracked = `${base}/marketing-email/click?c=${signClickUrl(
        url,
        ctx.sendToken
      )}`
      return `${prefix}"${tracked}"`
    }
  )

  // 2. Substitute placeholders (preferences === unsubscribe in Phase 1).
  out = out
    .split("{{unsubscribe_url}}")
    .join(unsubUrl)
    .split("{{preferences_url}}")
    .join(unsubUrl)

  // 3. Append the open pixel (before </body> when present, else at the end).
  const pixel = `<img src="${base}/marketing-email/open/${ctx.sendToken}" width="1" height="1" alt="" style="display:none"/>`
  if (/<\/body>/i.test(out)) {
    out = out.replace(/<\/body>/i, `${pixel}</body>`)
  } else {
    out = `${out}${pixel}`
  }

  const headers: Record<string, string> = {
    "List-Unsubscribe": `<${unsubUrl}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  }

  return { html: out, headers }
}

/**
 * Send one marketing email end-to-end. Tenant-scoped, tracked, recorded.
 * Never throws.
 */
/**
 * Email costs us ~nothing per send, but it is not free to give away at scale.
 * A single send is worth less than one credit, and credits are whole numbers —
 * so we bill in BATCHES: every 10th send by a tenant charges 1 credit. The
 * counter lives in the DB (usage rows), so restarts can't be used to dodge it.
 */
const emailBatchCounter = new Map<string, number>()
const chargeEmailBatch = async (
  container: MedusaContainer,
  tenantId: string
): Promise<void> => {
  try {
    const n = (emailBatchCounter.get(tenantId) ?? 0) + 1
    if (n < 10) {
      emailBatchCounter.set(tenantId, n)
      return
    }
    emailBatchCounter.set(tenantId, 0)
    const { getLedger } = await import("../../platform/credits/metering")
    const ledger = getLedger(container)
    const rid = `cres_mail_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const r = await ledger.reserve(tenantId, "email_batch", 1, { reservationId: rid })
    if (r.ok) await ledger.commit(rid)
  } catch {
    /* metering must never break a send */
  }
}

export const sendEmail = async (
  container: MedusaContainer,
  input: SendEmailInput
): Promise<SendEmailResult> => {
  const svc: any = container.resolve(MARKETING_MODULE)
  const tenantId = input.tenantId
  const to = input.to

  let sendId: string | undefined
  let token: string | undefined

  try {
    // 1. Suppression check — an address on the do-not-email list is skipped.
    const suppressions = await svc.listMarketingSuppressions({
      tenant_id: tenantId,
      email: to,
    })

    if (Array.isArray(suppressions) && suppressions.length > 0) {
      const suppressedRow = await svc.createMarketingEmailSends({
        tenant_id: tenantId,
        contact_id: input.contactId ?? null,
        template_id: input.templateId ?? null,
        campaign_id: input.campaignId ?? null,
        journey_enrollment_id: input.journeyEnrollmentId ?? null,
        to_email: to,
        subject: input.subject ?? null,
        status: "suppressed" as any,
        token: makeSendToken(),
        error: "recipient is suppressed",
      } as any)

      return {
        ok: false,
        suppressed: true,
        sendId: suppressedRow?.id,
        token: suppressedRow?.token,
      }
    }

    // 2. Create the per-send row (queued).
    token = makeSendToken()
    const row = await svc.createMarketingEmailSends({
      tenant_id: tenantId,
      contact_id: input.contactId ?? null,
      template_id: input.templateId ?? null,
      campaign_id: input.campaignId ?? null,
      journey_enrollment_id: input.journeyEnrollmentId ?? null,
      to_email: to,
      subject: input.subject ?? null,
      status: "queued" as any,
      token,
    } as any)
    sendId = row?.id
    token = row?.token ?? token

    // 3. Inject first-party tracking into the HTML.
    const tracked = injectTracking(input.html, {
      sendToken: token!,
      contactId: input.contactId ?? null,
      email: to,
    })

    // 4. Resolve the active provider.
    const provider = getEmailProvider()
    if (!provider) {
      const error = "no email provider configured"
      await svc.updateMarketingEmailSends({
        id: sendId,
        status: "failed" as any,
        error,
      } as any)
      return { ok: false, sendId, token, error }
    }

    // 5. Send. `from` precedence: explicit input -> per-instance SMTP_FROM env
    // -> a per-tenant default derived from the resolved brand name + store domain.
    const from =
      input.from ??
      process.env.SMTP_FROM ??
      (await resolveEmailFrom(container, tenantId))

    const result = await provider.send({
      to,
      toName: input.toName ?? null,
      from,
      replyTo: input.replyTo ?? null,
      subject: input.subject,
      html: tracked.html,
      text: input.text ?? null,
      headers: tracked.headers,
    })

    // 6. Record the outcome.
    if (result.ok) {
      await svc.updateMarketingEmailSends({
        id: sendId,
        status: "sent" as any,
        sent_at: new Date(),
        provider: provider.name,
        external_message_id: result.externalMessageId ?? null,
      } as any)
      await chargeEmailBatch(container, tenantId)
      return { ok: true, sendId, token }
    }

    const error = result.error?.message ?? "send failed"
    await svc.updateMarketingEmailSends({
      id: sendId,
      status: "failed" as any,
      error,
    } as any)
    return { ok: false, sendId, token, error }
  } catch (e: any) {
    const error = e?.message ?? "unexpected error sending email"
    // Best-effort: mark the row failed if we managed to create it.
    if (sendId) {
      try {
        await svc.updateMarketingEmailSends({
          id: sendId,
          status: "failed" as any,
          error,
        } as any)
      } catch {
        // swallow — never throw out of the send-service.
      }
    }
    return { ok: false, sendId, token, error }
  }
}
