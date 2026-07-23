/**
 * notifyMerchant — the single entry point for every platform → merchant
 * lifecycle email (subscription, AI-credit, billing, onboarding).
 *
 * Contract (so callers in the money path stay safe):
 *   - GATED: no-op unless PLATFORM_LIFECYCLE_EMAILS === "1" (default OFF, so a
 *     deploy is behavior-neutral until the operator turns it on).
 *   - NEVER throws: resolves the merchant, renders, sends — any failure is
 *     logged and swallowed. Safe to call from a Stripe webhook or a cron job.
 *   - Resolves the recipient SERVER-SIDE from tenant_id (never trusts caller
 *     input for the address).
 *
 * Usage:
 *   await notifyMerchant(container, {
 *     tenantId, template: "topup_receipt",
 *     data: { amountUsd: 20, creditsAdded: 2000, balance: 2500 },
 *   })
 */

import { TEMPLATES, type PlatformTemplate, type MerchantCtx } from "./templates"
import { sendPlatformMail } from "./mailer"

const PLATFORM_MODULE = "platform"

const dashboardUrl = (): string =>
  (
    process.env.MERCHANT_DASHBOARD_URL ||
    process.env.STOREFRONT_URL ||
    "https://mautomate.ai"
  ).replace(/\/+$/, "")

const enabled = (): boolean => process.env.PLATFORM_LIFECYCLE_EMAILS === "1"

const safeLogger = (container: any): any => {
  try {
    return container.resolve("logger")
  } catch {
    return null
  }
}

export type NotifyArgs<T extends PlatformTemplate = PlatformTemplate> = {
  tenantId: string
  template: T
  /** Template-specific fields (see templates.ts). */
  data?: Record<string, any>
  /** Override recipient (e.g. a specific merchant email); otherwise resolved. */
  to?: string
  merchantName?: string | null
}

/**
 * Resolve the primary merchant (store owner) email for a tenant. Prefers an
 * active merchant; falls back to any. Returns null if none / on error.
 */
const resolveMerchant = async (
  container: any,
  tenantId: string
): Promise<{ email: string; name?: string | null } | null> => {
  try {
    const svc: any = container.resolve(PLATFORM_MODULE)
    const list = await svc.listMerchants({ tenant_id: tenantId })
    if (!Array.isArray(list) || list.length === 0) return null
    const active = list.find((m: any) => m?.status === "active") || list[0]
    if (!active?.email) return null
    return { email: active.email, name: active.name ?? null }
  } catch {
    return null
  }
}

export const notifyMerchant = async (
  container: any,
  args: NotifyArgs
): Promise<{ ok: boolean; skipped?: string }> => {
  const logger = safeLogger(container)
  try {
    if (!enabled()) return { ok: false, skipped: "disabled" }
    const builder = (TEMPLATES as any)[args.template]
    if (typeof builder !== "function") {
      return { ok: false, skipped: "unknown-template" }
    }

    let email = args.to
    let name = args.merchantName ?? null
    if (!email) {
      const m = await resolveMerchant(container, args.tenantId)
      if (!m) {
        logger?.warn?.(
          `[platform-notify] no merchant email for tenant ${args.tenantId} (${args.template})`
        )
        return { ok: false, skipped: "no-recipient" }
      }
      email = m.email
      name = m.name
    }

    const ctx: MerchantCtx = { email, name, dashboardUrl: dashboardUrl() }
    const built = builder(ctx, args.data || {})
    const res = await sendPlatformMail(
      { to: email, subject: built.subject, html: built.html, text: built.text },
      logger
    )
    if (res.ok) {
      logger?.info?.(
        `[platform-notify] sent "${args.template}" to tenant ${args.tenantId}`
      )
    }
    return { ok: res.ok, skipped: res.ok ? undefined : "send-failed" }
  } catch (e: any) {
    logger?.error?.(
      `[platform-notify] "${args?.template}" failed (swallowed): ${e?.message ?? e}`
    )
    return { ok: false, skipped: "error" }
  }
}

export { TEMPLATES } from "./templates"
export type { PlatformTemplate } from "./templates"
