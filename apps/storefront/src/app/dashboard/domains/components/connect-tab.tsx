"use client"

import React, { useState } from "react"
import { Spinner, Link as LinkIcon, ShieldCheck, ArrowPath } from "@medusajs/icons"
import {
  connectDomain,
  verifyDomain,
  ConnectDomainResponse,
} from "@lib/merchant-admin/api"
import {
  Callout,
  HowItWorks,
  StepList,
  DnsInstructionsCard,
  CopyField,
  btnPrimary,
  btnSecondary,
} from "./ui"

/** Client-side apex check, mirrors the backend so guidance matches. */
function isApex(domain: string): boolean {
  const host = domain.trim().toLowerCase().replace(/\.$/, "")
  const labels = host.split(".")
  const twoPart = new Set(["co.uk", "com.bd", "com.au", "co.in", "com.br"])
  if (twoPart.has(labels.slice(-2).join("."))) return labels.length === 3
  return labels.length === 2
}

export function ConnectTab({
  token,
  onConnected,
  plan,
}: {
  token: string
  onConnected: () => void
  plan?: { name?: string; domains_limit?: number } | null
}) {
  const [input, setInput] = useState("")
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ConnectDomainResponse | null>(null)

  const [verifying, setVerifying] = useState(false)
  const [verifyState, setVerifyState] = useState<
    | { pending: boolean; ssl: string; verification: string }
    | null
  >(null)

  if (plan && (plan.domains_limit ?? 0) <= 0) {
    return (
      <div className="rounded-large border border-grey-20 bg-grey-10 p-8 text-center">
        <p className="text-base font-semibold text-grey-90">
          Connecting your own domain is a paid feature
        </p>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-grey-50">
          Your{plan.name ? ` ${plan.name}` : ""} plan runs on your free
          mautomate.ai address. Upgrade to the Growth plan or above to connect a
          domain you already own.
        </p>
        <a
          href="/dashboard/billing"
          className="mt-5 inline-flex items-center justify-center rounded-base bg-grey-90 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-grey-80"
        >
          View plans
        </a>
      </div>
    )
  }

  const domain = input.trim().toLowerCase()
  const apex = domain ? isApex(domain) : false

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!domain) return
    setConnecting(true)
    setError(null)
    setResult(null)
    setVerifyState(null)
    try {
      const res = await connectDomain(token, domain)
      setResult(res)
      onConnected()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not connect that domain")
    } finally {
      setConnecting(false)
    }
  }

  const handleVerify = async () => {
    if (!result) return
    setVerifying(true)
    setError(null)
    try {
      const res = await verifyDomain(token, result.domain_id)
      setVerifyState({
        pending: res.pending,
        ssl: res.ssl_status,
        verification: res.verification_status,
      })
      onConnected()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not check status")
    } finally {
      setVerifying(false)
    }
  }

  const reset = () => {
    setResult(null)
    setVerifyState(null)
    setInput("")
    setError(null)
  }

  return (
    <div className="space-y-6">
      <HowItWorks
        steps={[
          "Enter a domain you already own (e.g. yourbrand.com).",
          "Change your domain's nameservers to the two we give you (or add one CNAME for a subdomain).",
          "Click Verify — once the change propagates, your store goes live with HTTPS automatically.",
        ]}
      />

      {!result ? (
        <form onSubmit={handleConnect} className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <LinkIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-grey-40" />
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value.toLowerCase())}
                placeholder="shop.yourbrand.com"
                className="w-full rounded-base border border-grey-30 bg-white py-2 pl-9 pr-3 text-sm text-grey-90 placeholder:text-grey-40 focus:border-grey-90 focus:outline-none focus:ring-1 focus:ring-grey-90"
              />
            </div>
            <button type="submit" disabled={connecting || !domain} className={btnPrimary}>
              {connecting ? <Spinner className="h-4 w-4 animate-spin" /> : <LinkIcon className="h-4 w-4" />}
              {connecting ? "Connecting..." : "Connect domain"}
            </button>
          </div>
          {domain && (
            <p className="text-xs text-grey-50">
              {apex
                ? "One simple step: you'll change your domain's nameservers at your registrar — we handle everything else, including HTTPS."
                : "This looks like a subdomain — a single CNAME record is all you'll need."}
            </p>
          )}
          {error && <Callout tone="warning">{error}</Callout>}
        </form>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-medium text-grey-90">{result.domain}</p>
              <p className="text-sm text-grey-50">Follow the steps below, then verify.</p>
            </div>
            <button onClick={reset} className={btnSecondary}>
              Connect another
            </button>
          </div>

          {result.instructions.length === 0 && (
            <Callout tone="warning" title="Live domain connection is being set up">
              Your exact instructions for{" "}
              <span className="font-medium">{result.domain}</span> appear here
              once we finish provisioning your custom domain. Verify stays
              pending until then, and your store keeps working on its
              mautomate.ai address in the meantime.
            </Callout>
          )}

          {result.instructions.some((r) => r.kind === "ns") ? (
            <div className="rounded-large border border-grey-20 bg-white p-5">
              <h3 className="mb-4 text-sm font-semibold text-grey-90">
                Change your domain&apos;s nameservers — that&apos;s the only step
              </h3>
              <StepList
                steps={[
                  "Log in where you bought the domain (e.g. Namecheap, GoDaddy, Hostinger).",
                  <>
                    Open the domain&apos;s settings and find{" "}
                    <span className="font-medium">Nameservers</span> (sometimes
                    under &quot;DNS&quot;). Choose{" "}
                    <span className="font-medium">Custom nameservers</span>.
                  </>,
                  "Replace the existing nameservers with the two below, then save.",
                  "Come back and click Verify. This usually takes minutes, but can take up to 24 hours to propagate.",
                ]}
              />
              <div className="mt-5 space-y-2">
                {result.instructions
                  .filter((r) => r.kind === "ns")
                  .map((r) => (
                    <CopyField key={r.value} label={r.name} value={r.value} />
                  ))}
              </div>
              <p className="mt-4 text-xs text-grey-50">
                Your email and any other services on this domain keep working —
                we imported your existing DNS records automatically. HTTPS is
                issued for you; there is nothing else to configure.
              </p>
            </div>
          ) : (
            <div className="rounded-large border border-grey-20 bg-white p-5">
              <h3 className="mb-4 text-sm font-semibold text-grey-90">
                Add this record at your DNS provider
              </h3>
              <StepList
                steps={[
                  "Log into your DNS provider (where you bought the domain — e.g. GoDaddy, Namecheap, Cloudflare).",
                  <>Add the <span className="font-medium">CNAME</span> record shown below.</>,
                  "Come back and click Verify. DNS changes can take up to 30 minutes to propagate.",
                ]}
              />

              <div className="mt-5">
                <DnsInstructionsCard instructions={result.instructions} />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              {verifyState ? (
                verifyState.pending ? (
                  <Callout tone="warning" title="Still waiting on DNS">
                    We can&apos;t see the change yet (SSL: {verifyState.ssl}, ownership:{" "}
                    {verifyState.verification}). Nameserver changes usually land
                    within minutes but can take up to 24 hours — check back and
                    try again.
                  </Callout>
                ) : (
                  <Callout tone="success" title="Verified">
                    <span className="inline-flex items-center gap-1">
                      <ShieldCheck className="h-4 w-4" />
                      Your domain is verified and secured with SSL.
                    </span>
                  </Callout>
                )
              ) : (
                <p className="text-sm text-grey-50">
                  Once you&apos;ve added the records, check the connection.
                </p>
              )}
            </div>
            <button onClick={handleVerify} disabled={verifying} className={btnPrimary}>
              {verifying ? <Spinner className="h-4 w-4 animate-spin" /> : <ArrowPath className="h-4 w-4" />}
              {verifying ? "Checking..." : "Verify"}
            </button>
          </div>

          {error && <Callout tone="warning">{error}</Callout>}
        </div>
      )}
    </div>
  )
}
