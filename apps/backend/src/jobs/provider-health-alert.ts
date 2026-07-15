import type { MedusaContainer } from "@medusajs/framework/types"

import {
  checkProviders,
  failingProviders,
  type ProviderHealth,
} from "../modules/platform/observability/provider-health"
import nodemailer from "nodemailer"

/**
 * provider-health-alert (scheduled, every 10 minutes).
 *
 * The panel only helps someone who is LOOKING at the panel. Nobody was looking
 * when the OpenAI account hit zero: two customers phoned, got silence, and hung
 * up before a human found out. So the platform now checks its own vendors and
 * shouts the moment one of them stops being able to serve.
 *
 * ALERTS ON TRANSITION, not on state — an alert that fires every ten minutes
 * forever is an alert everyone learns to ignore, and the one time it matters it
 * gets ignored too. It fires when a provider goes bad, and once more when it
 * recovers, and stays quiet in between.
 *
 * NEVER THROWS: a monitor that crashes the job runner is worse than no monitor.
 */

/** Last severity we alerted on, per provider. In-memory: a restart re-alerts once. */
const lastSeverity = new Map<string, string>()

const recipients = (): string[] =>
  (process.env.PLATFORM_SUPERADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)

const subjectFor = (p: ProviderHealth): string =>
  p.severity === "critical"
    ? `[mAutomate] ${p.service} is DOWN — ${p.role}`
    : p.severity === "warn"
      ? `[mAutomate] ${p.service} is running low — ${p.role}`
      : `[mAutomate] ${p.service} recovered`

const bodyFor = (p: ProviderHealth): string =>
  [
    `${p.service} — ${p.role}`,
    "",
    p.detail,
    p.remaining
      ? `Remaining: ${p.remaining.value.toLocaleString()} ${p.remaining.unit}${
          p.remaining.percent !== undefined ? ` (${p.remaining.percent}%)` : ""
        }`
      : "",
    p.single_point_of_failure && p.severity === "critical"
      ? "This vendor has NO standby. While it is down, that capability is entirely offline."
      : "",
    "",
    "Control panel: https://console.mautomate.ai/control/observability",
  ]
    .filter(Boolean)
    .join("\n")

/**
 * The alert has its OWN mail transport, deliberately.
 *
 * It would be trivial to reuse the marketing SmtpEmailProvider — and that would
 * mean setting SMTP_HOST, which is the switch that takes the store/marketing
 * email paths out of their inert state. An ops alert must never be the thing
 * that silently turns on customer email. So it talks to the local mail server
 * directly (Postfix on 127.0.0.1:25 by default) and touches nothing else.
 */
const alertTransport = () => {
  const host = process.env.PLATFORM_ALERT_SMTP_HOST
  if (host) {
    const port = Number(process.env.PLATFORM_ALERT_SMTP_PORT ?? 587)
    const user = process.env.PLATFORM_ALERT_SMTP_USER
    const pass = process.env.PLATFORM_ALERT_SMTP_PASS
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      ...(user && pass ? { auth: { user, pass } } : {}),
      tls: { rejectUnauthorized: false },
    })
  }

  // Default: hand the message to the local mail system, exactly as `mail(1)`
  // would. This box runs Postfix but its smtpd never returns a greeting on
  // 127.0.0.1:25 (nodemailer: "Greeting never received"), while the sendmail
  // path queues and delivers fine — so dialling SMTP here would mean the alert
  // that exists to catch silent failures would itself fail silently.
  return nodemailer.createTransport({
    sendmail: true,
    newline: "unix",
    path: process.env.PLATFORM_ALERT_SENDMAIL_PATH || "/usr/sbin/sendmail",
  })
}

const notify = async (p: ProviderHealth): Promise<void> => {
  const to = recipients()

  // Always log it — the log is the one channel that cannot itself be
  // misconfigured, so the alert survives even if mail is broken.
  // eslint-disable-next-line no-console
  console.error(
    `[provider-health] ALERT ${p.severity.toUpperCase()} ${p.service}: ${p.detail}`
  )

  if (!to.length) {
    // eslint-disable-next-line no-console
    console.error(
      "[provider-health] email NOT sent — PLATFORM_SUPERADMIN_EMAILS is empty. " +
        "The alert exists only in this log and the console."
    )
    return
  }

  const from = process.env.PLATFORM_ALERT_FROM || "alerts@mautomate.ai"

  try {
    const transport = alertTransport()
    await transport.sendMail({
      from,
      to: to.join(", "),
      subject: subjectFor(p),
      text: bodyFor(p),
    })
    // eslint-disable-next-line no-console
    console.error(`[provider-health] alert emailed to ${to.join(", ")}`)
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error(
      `[provider-health] could not email the alert (${e?.message ?? e}). ` +
        "It is still in this log and on the console's observability page."
    )
  }
}

export default async function providerHealthAlertJob(
  _container: MedusaContainer
): Promise<void> {
  try {
    const providers = await checkProviders(true)

    for (const p of providers) {
      const previous = lastSeverity.get(p.service)
      const current = p.severity

      // Unknown (no key configured) is not an incident — it is a choice.
      if (current === "unknown") {
        lastSeverity.set(p.service, current)
        continue
      }

      if (previous === undefined) {
        // First observation. Alert only if it is ALREADY bad — we would rather
        // wake someone on boot than let a dead vendor sit quietly.
        if (current !== "ok") {
          await notify(p)
        }
        lastSeverity.set(p.service, current)
        continue
      }

      if (current !== previous) {
        // Recovery is worth exactly one message, so nobody keeps chasing a
        // problem that fixed itself.
        await notify(p)
        lastSeverity.set(p.service, current)
      }
    }

    const failing = failingProviders(providers)
    if (failing.length) {
      // eslint-disable-next-line no-console
      console.warn(
        `[provider-health] ${failing.length} provider(s) need attention: ${failing
          .map((p) => `${p.service}=${p.severity}`)
          .join(", ")}`
      )
    } else {
      // HEARTBEAT. A monitor that only speaks when something is wrong is
      // indistinguishable, in the logs, from a monitor that has stopped running
      // — which is precisely the failure mode this whole job exists to kill. So
      // it says "I checked, and all is well" every single sweep.
      // eslint-disable-next-line no-console
      console.log(
        `[provider-health] swept ${providers.length} vendors — all healthy`
      )
    }
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("[provider-health] sweep failed:", e?.message ?? e)
  }
}

export const config = {
  name: "provider-health-alert",
  schedule: "*/10 * * * *",
}
