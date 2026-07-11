import type { MedusaContainer } from "@medusajs/framework/types"

import { getTenantSecret, getTenantConfig } from "./tenant-config"

/**
 * Per-tenant email deliverability config (Phase 5).
 *
 * Each tenant sends from its OWN domain with its OWN reputation, so we resolve
 * SMTP creds + the DKIM sending domain per tenant (encrypted store), falling
 * back to the shared env SMTP for the current single-tenant run. The DKIM
 * selector/record for a custom domain is surfaced so onboarding can show the
 * exact DNS the merchant must publish (SPF/DKIM/DMARC), rather than everyone
 * sharing one IP's reputation.
 */
export type TenantEmailConfig = {
  host?: string
  port?: number
  user?: string
  pass?: string
  from?: string
  dkim_domain?: string
  dkim_selector: string
}

export async function resolveTenantEmailConfig(
  container: MedusaContainer,
  tenantId: string
): Promise<TenantEmailConfig> {
  const [host, user, pass, from, dkimDomain] = await Promise.all([
    getTenantSecret(container, tenantId, "smtp_host", "SMTP_HOST"),
    getTenantSecret(container, tenantId, "smtp_user", "SMTP_USER"),
    getTenantSecret(container, tenantId, "smtp_pass", "SMTP_PASS"),
    getTenantConfig<string>(container, tenantId, "email_from"),
    getTenantConfig<string>(container, tenantId, "dkim_domain"),
  ])
  return {
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    user,
    pass,
    from: from ?? process.env.SMTP_FROM,
    dkim_domain: dkimDomain,
    dkim_selector: process.env.DKIM_SELECTOR ?? "b2d",
  }
}

/** The DNS records a merchant must publish for a custom sending domain. */
export const dkimDnsRecords = (
  domain: string,
  selector = "b2d",
  dkimPublicKey = "<dkim-public-key>"
): Array<{ type: string; name: string; value: string }> => [
  { type: "TXT", name: `@`, value: `v=spf1 include:_spf.${domain} ~all` },
  {
    type: "TXT",
    name: `${selector}._domainkey.${domain}`,
    value: `v=DKIM1; k=rsa; p=${dkimPublicKey}`,
  },
  {
    type: "TXT",
    name: `_dmarc.${domain}`,
    value: `v=DMARC1; p=quarantine; rua=mailto:dmarc@${domain}`,
  },
]
