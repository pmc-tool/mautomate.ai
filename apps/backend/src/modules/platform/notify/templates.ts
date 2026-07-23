/**
 * Platform → merchant transactional email TEMPLATES (the mAutomate lifecycle:
 * subscription + AI-credit business). Each builder returns { subject, html,
 * text }. All copy is mAutomate-branded and 1:1 transactional.
 *
 * Rendered through renderPlatformEmail (the ember-branded shell). Values are
 * escaped by the shell for the heading; body values here are escaped locally.
 */

import { renderPlatformEmail, escapePlatformHtml as esc } from "./layout"

export type MerchantCtx = {
  name?: string | null
  email: string
  dashboardUrl: string // no trailing slash
}

export type BuiltPlatformEmail = { subject: string; html: string; text: string }

const p = (s: string) => `<p style="margin:0 0 14px 0;">${s}</p>`
const money = (usd: number) =>
  `$${(Math.round(usd * 100) / 100).toFixed(2)}`
const credits = (n: number) => `${Number(n).toLocaleString("en-US")} credits`
const hi = (c: MerchantCtx) => (c.name ? ` ${esc(c.name)}` : "")

/** All template names the platform can send. */
export type PlatformTemplate =
  | "welcome"
  | "subscription_activated"
  | "renewal_receipt"
  | "topup_receipt"
  | "payment_failed"
  | "plan_changed"
  | "low_credit"
  | "trial_ending"
  | "credit_expired"
  | "suspended"

// ---------------------------------------------------------------------------

export const welcome = (
  c: MerchantCtx,
  d: { plan?: string; trialDays?: number; includedCredits?: number } = {}
): BuiltPlatformEmail => {
  const trial = d.trialDays
    ? p(
        `Your ${esc(String(d.plan || "free trial"))} includes a <strong>${d.trialDays}-day trial</strong>${
          d.includedCredits
            ? ` and <strong>${credits(d.includedCredits)}</strong> to spend on AI features`
            : ""
        }.`
      )
    : ""
  return {
    subject: "Welcome to mAutomate",
    html: renderPlatformEmail({
      preheader: "Your store is ready — here's how to get automated.",
      heading: `Welcome to mAutomate${hi(c)}`,
      bodyHtml:
        p(`Your account is live. mAutomate runs your store's marketing on autopilot — welcome emails, abandoned-cart recovery, win-backs and lifecycle campaigns — plus AI tools powered by your credit balance.`) +
        trial +
        p(`Head to your dashboard to finish setup and watch your automations go to work.`),
      ctaText: "Open your dashboard",
      ctaUrl: `${c.dashboardUrl}/dashboard`,
    }),
    text: `Welcome to mAutomate${c.name ? ", " + c.name : ""}!\n\nYour account is live. Finish setup in your dashboard: ${c.dashboardUrl}/dashboard`,
  }
}

export const subscription_activated = (
  c: MerchantCtx,
  d: { plan: string; includedCredits?: number; amountUsd?: number; period?: string }
): BuiltPlatformEmail => ({
  subject: `Your mAutomate ${d.plan} plan is active`,
  html: renderPlatformEmail({
    preheader: `${d.plan} is active${d.includedCredits ? ` — ${credits(d.includedCredits)} added` : ""}.`,
    heading: `You're on ${esc(d.plan)}`,
    bodyHtml:
      p(`Thanks${hi(c)} — your <strong>${esc(d.plan)}</strong> subscription is active${
        d.amountUsd ? ` at ${money(d.amountUsd)}${d.period ? "/" + esc(d.period) : ""}` : ""
      }.`) +
      (d.includedCredits
        ? p(`<strong>${credits(d.includedCredits)}</strong> have been added to your wallet.`)
        : "") +
      p(`Every automation and AI feature is now unlocked. Manage everything from your billing page.`),
    ctaText: "View plan & credits",
    ctaUrl: `${c.dashboardUrl}/dashboard/billing`,
  }),
  text: `Your mAutomate ${d.plan} plan is active. Manage it: ${c.dashboardUrl}/dashboard/billing`,
})

export const renewal_receipt = (
  c: MerchantCtx,
  d: { plan: string; amountUsd: number; includedCredits?: number; period?: string; invoiceUrl?: string }
): BuiltPlatformEmail => ({
  subject: `Receipt — mAutomate ${d.plan} (${money(d.amountUsd)})`,
  html: renderPlatformEmail({
    preheader: `Payment received — ${money(d.amountUsd)}.`,
    heading: "Payment received",
    bodyHtml:
      p(`We've received your payment of <strong>${money(d.amountUsd)}</strong> for the <strong>${esc(d.plan)}</strong> plan${
        d.period ? ` (${esc(d.period)})` : ""
      }.`) +
      (d.includedCredits
        ? p(`Your plan credits have been refreshed: <strong>${credits(d.includedCredits)}</strong>.`)
        : "") +
      p(`Thanks for staying with mAutomate.`),
    ctaText: d.invoiceUrl ? "View invoice" : "View billing",
    ctaUrl: d.invoiceUrl || `${c.dashboardUrl}/dashboard/billing`,
  }),
  text: `Payment received: ${money(d.amountUsd)} for mAutomate ${d.plan}. ${d.invoiceUrl || c.dashboardUrl + "/dashboard/billing"}`,
})

export const topup_receipt = (
  c: MerchantCtx,
  d: { amountUsd: number; creditsAdded: number; balance?: number }
): BuiltPlatformEmail => ({
  subject: `${credits(d.creditsAdded)} added to your wallet`,
  html: renderPlatformEmail({
    preheader: `Top-up complete — ${credits(d.creditsAdded)} added.`,
    heading: "Credits added",
    bodyHtml:
      p(`Your top-up of <strong>${money(d.amountUsd)}</strong> is complete${hi(c) ? "," + hi(c) : ""}.`) +
      p(`<strong>${credits(d.creditsAdded)}</strong> have been added to your wallet${
        typeof d.balance === "number" ? ` — new balance <strong>${credits(d.balance)}</strong>` : ""
      }.`) +
      p(`Credits from top-ups never expire.`),
    ctaText: "View wallet",
    ctaUrl: `${c.dashboardUrl}/dashboard/billing`,
  }),
  text: `${credits(d.creditsAdded)} added (${money(d.amountUsd)}). Wallet: ${c.dashboardUrl}/dashboard/billing`,
})

export const payment_failed = (
  c: MerchantCtx,
  d: { plan?: string; graceDays?: number }
): BuiltPlatformEmail => ({
  subject: "Action needed: your mAutomate payment failed",
  html: renderPlatformEmail({
    preheader: "Update your payment method to keep your automations running.",
    heading: "We couldn't process your payment",
    bodyHtml:
      p(`Hi${hi(c)}, your latest payment${d.plan ? ` for the <strong>${esc(d.plan)}</strong> plan` : ""} didn't go through.`) +
      p(`Please update your payment method to avoid interruption.${
        d.graceDays ? ` Your automations keep running for <strong>${d.graceDays} more days</strong> while you sort this out.` : ""
      }`),
    ctaText: "Update payment method",
    ctaUrl: `${c.dashboardUrl}/dashboard/billing`,
    footerNote: "If you've already updated your card, you can ignore this message.",
  }),
  text: `Your mAutomate payment failed. Update your payment method: ${c.dashboardUrl}/dashboard/billing`,
})

export const plan_changed = (
  c: MerchantCtx,
  d: { plan: string; previous?: string }
): BuiltPlatformEmail => ({
  subject: `Your plan is now ${d.plan}`,
  html: renderPlatformEmail({
    preheader: `Plan updated to ${d.plan}.`,
    heading: `You're now on ${esc(d.plan)}`,
    bodyHtml:
      p(`Your plan has been updated${d.previous ? ` from <strong>${esc(d.previous)}</strong>` : ""} to <strong>${esc(d.plan)}</strong>.`) +
      p(`The change is effective immediately. See what's included on your billing page.`),
    ctaText: "View plan",
    ctaUrl: `${c.dashboardUrl}/dashboard/billing`,
  }),
  text: `Your mAutomate plan is now ${d.plan}. ${c.dashboardUrl}/dashboard/billing`,
})

export const low_credit = (
  c: MerchantCtx,
  d: { balance: number; threshold: number }
): BuiltPlatformEmail => ({
  subject: "Your AI credits are running low",
  html: renderPlatformEmail({
    preheader: `Only ${credits(d.balance)} left.`,
    heading: "Your AI credits are running low",
    bodyHtml:
      p(`Heads up${hi(c)} — your wallet is down to <strong>${credits(d.balance)}</strong>.`) +
      p(`When you run out, AI-powered features (content generation, campaigns, chat and more) pause until you top up. Add credits now to keep everything running.`),
    ctaText: "Top up credits",
    ctaUrl: `${c.dashboardUrl}/dashboard/billing`,
  }),
  text: `Your mAutomate AI credits are low (${credits(d.balance)} left). Top up: ${c.dashboardUrl}/dashboard/billing`,
})

export const trial_ending = (
  c: MerchantCtx,
  d: { daysLeft: number; plan?: string }
): BuiltPlatformEmail => ({
  subject:
    d.daysLeft <= 1
      ? "Your mAutomate trial ends tomorrow"
      : `Your mAutomate trial ends in ${d.daysLeft} days`,
  html: renderPlatformEmail({
    preheader: "Add a plan to keep your automations running.",
    heading:
      d.daysLeft <= 1 ? "Your trial ends tomorrow" : `Your trial ends in ${d.daysLeft} days`,
    bodyHtml:
      p(`Hi${hi(c)}, your free trial is almost over.`) +
      p(`Choose a plan now so your welcome emails, cart recovery and lifecycle campaigns keep running without a pause — and your customers never notice a gap.`),
    ctaText: "Choose your plan",
    ctaUrl: `${c.dashboardUrl}/dashboard/billing`,
  }),
  text: `Your mAutomate trial ends in ${d.daysLeft} day(s). Choose a plan: ${c.dashboardUrl}/dashboard/billing`,
})

export const credit_expired = (
  c: MerchantCtx,
  d: { expired: number; balance?: number }
): BuiltPlatformEmail => ({
  subject: "Some of your plan credits expired",
  html: renderPlatformEmail({
    preheader: `${credits(d.expired)} expired.`,
    heading: "Some plan credits expired",
    bodyHtml:
      p(`<strong>${credits(d.expired)}</strong> from your plan allowance have expired${
        typeof d.balance === "number" ? ` — your balance is now <strong>${credits(d.balance)}</strong>` : ""
      }.`) +
      p(`Plan credits refresh each cycle; top-up credits never expire. Add credits any time to keep AI features running.`),
    ctaText: "Top up credits",
    ctaUrl: `${c.dashboardUrl}/dashboard/billing`,
  }),
  text: `${credits(d.expired)} plan credits expired. Top up: ${c.dashboardUrl}/dashboard/billing`,
})

export const suspended = (
  c: MerchantCtx,
  d: { reason?: string } = {}
): BuiltPlatformEmail => ({
  subject: "Your mAutomate account has been paused",
  html: renderPlatformEmail({
    preheader: "Reactivate any time to resume your automations.",
    heading: "Your account is paused",
    bodyHtml:
      p(`Hi${hi(c)}, your mAutomate account has been paused${
        d.reason ? ` (${esc(d.reason)})` : " due to an unresolved billing issue"
      }.`) +
      p(`Your data is safe. Reactivate from your billing page to resume all automations right where they left off.`),
    ctaText: "Reactivate account",
    ctaUrl: `${c.dashboardUrl}/dashboard/billing`,
  }),
  text: `Your mAutomate account is paused. Reactivate: ${c.dashboardUrl}/dashboard/billing`,
})

/** Registry: template name -> builder. Keeps the dispatcher fully typed. */
export const TEMPLATES = {
  welcome,
  subscription_activated,
  renewal_receipt,
  topup_receipt,
  payment_failed,
  plan_changed,
  low_credit,
  trial_ending,
  credit_expired,
  suspended,
} as const
