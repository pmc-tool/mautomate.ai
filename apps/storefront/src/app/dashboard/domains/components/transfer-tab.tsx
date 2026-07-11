"use client"

import React, { useState } from "react"
import {
  Spinner,
  Key,
  Eye,
  EyeSlash,
  ShieldCheck,
  QuestionMarkCircle,
  ArrowDownTray,
  CheckCircleSolid,
  Globe,
} from "@medusajs/icons"
import { Select } from "@components/merchant-admin/form-field"
import {
  validateTransferIn,
  transferInDomain,
  TransferValidateResponse,
} from "@lib/merchant-admin/api"
import { cn } from "@lib/util/cn"
import { Callout, HowItWorks, btnPrimary, btnSecondary } from "./ui"

const CHECKLIST = [
  "Unlock the domain at your current registrar",
  "Request the authorization (EPP) code from your current registrar",
  "Turn OFF WHOIS privacy so the transfer email can be received",
  "Make sure the domain is more than 60 days old (not recently registered or transferred)",
  "Confirm the WHOIS/admin email on the domain is one you can access",
]

export function TransferTab({
  token,
  onTransferred,
}: {
  token: string
  onTransferred: () => void
}) {
  const [checked, setChecked] = useState<boolean[]>(CHECKLIST.map(() => false))
  const [domain, setDomain] = useState("")
  const [authCode, setAuthCode] = useState("")
  const [showCode, setShowCode] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [years, setYears] = useState(1)

  const [validating, setValidating] = useState(false)
  const [validation, setValidation] = useState<TransferValidateResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState<{ manual: boolean } | null>(null)

  const domainClean = domain.trim().toLowerCase()
  const domainValid = /^([a-z0-9](-?[a-z0-9])*\.)+[a-z]{2,}$/.test(domainClean)
  const codeValid = authCode.trim().length >= 4
  const allChecked = checked.every(Boolean)

  // Verified means: registrar confirmed eligible, OR registrar not configured
  // (degraded → manual approval path is allowed).
  const canSubmit =
    !!validation &&
    (validation.configured === false || (validation.valid && validation.eligible))

  const resetVerification = () => {
    setValidation(null)
    setSuccess(null)
  }

  const handleVerify = async () => {
    if (!domainValid || !codeValid) return
    setValidating(true)
    setError(null)
    setValidation(null)
    try {
      const res = await validateTransferIn(token, domainClean, authCode.trim())
      setValidation(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not verify this domain")
    } finally {
      setValidating(false)
    }
  }

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await transferInDomain(token, {
        domain: domainClean,
        auth_code: authCode.trim(),
        years,
      })
      setSuccess({ manual: !!res.manual_approval })
      onTransferred()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transfer could not be started")
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="space-y-5">
        <Callout tone="info" title="Transfer request submitted">
          <p className="mb-2">
            We&apos;ve started the transfer for{" "}
            <span className="font-medium">{domainClean}</span>.
          </p>
          <ul className="list-inside list-disc space-y-1">
            <li>
              An approval email is sent to the admin contact on the domain — approve
              it there to speed things up.
            </li>
            <li>Transfers include a 1-year extension added to your current expiry date.</li>
            <li>
              {success.manual
                ? "Because live registration isn't active yet, our team will submit this at the registrar using the auth code you provided."
                : "The transfer can take a few days to complete at the registrar. It will show as pending under Your domains."}
            </li>
          </ul>
        </Callout>
        <button
          onClick={() => {
            setSuccess(null)
            setValidation(null)
            setDomain("")
            setAuthCode("")
            setChecked(CHECKLIST.map(() => false))
          }}
          className={btnSecondary}
        >
          Transfer another domain
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <HowItWorks
        steps={[
          "Prepare the domain at your current registrar (checklist below).",
          "Enter the domain and its EPP/auth code, then Verify.",
          "Confirm the price to start the transfer — it adds a free 1-year extension.",
        ]}
      />

      {/* Pre-flight checklist */}
      <div className="rounded-large border border-amber-200 bg-amber-50/60 p-5">
        <p className="mb-3 text-sm font-semibold text-amber-900">
          Before transferring — do these at your current registrar
        </p>
        <ul className="space-y-2">
          {CHECKLIST.map((item, idx) => (
            <li key={idx}>
              <label className="flex cursor-pointer items-start gap-2.5 text-sm text-amber-900">
                <input
                  type="checkbox"
                  checked={checked[idx]}
                  onChange={(e) =>
                    setChecked((prev) => prev.map((v, i) => (i === idx ? e.target.checked : v)))
                  }
                  className="mt-0.5 h-4 w-4 rounded border-amber-300 text-grey-90 focus:ring-grey-90"
                />
                <span>{item}</span>
              </label>
            </li>
          ))}
        </ul>
      </div>

      {/* Domain + EPP */}
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-grey-70">Domain name</label>
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-grey-40" />
            <input
              type="text"
              value={domain}
              onChange={(e) => {
                setDomain(e.target.value.toLowerCase())
                resetVerification()
              }}
              placeholder="example.com"
              className="w-full rounded-base border border-grey-30 bg-white py-2 pl-9 pr-3 text-sm text-grey-90 placeholder:text-grey-40 focus:border-grey-90 focus:outline-none focus:ring-1 focus:ring-grey-90"
            />
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-sm font-medium text-grey-70">
              Authorization (EPP) code
            </label>
            <button
              type="button"
              onClick={() => setShowHelp((s) => !s)}
              className="inline-flex items-center gap-1 text-xs text-grey-50 hover:text-grey-90"
            >
              <QuestionMarkCircle className="h-4 w-4" />
              What is this?
            </button>
          </div>

          {showHelp && (
            <div className="mb-3 rounded-large border border-sky-200 bg-sky-50 p-4 text-xs text-sky-900">
              <p className="mb-1 font-medium">What is an authorization code?</p>
              <p className="mb-3 leading-relaxed">
                Also called an EPP code, auth code, or transfer key — a unique secret
                that authorizes moving your domain. You get it from your current
                registrar.
              </p>
              <p className="mb-1 font-medium">Where to find it:</p>
              <ul className="list-inside list-disc space-y-1">
                <li>
                  <strong>GoDaddy:</strong> My Products → Domain Settings → Transfer domain away
                </li>
                <li>
                  <strong>Namecheap:</strong> Domain List → Manage → Sharing &amp; Transfer → Auth Code
                </li>
                <li>
                  <strong>Google Domains / Squarespace:</strong> Registration settings → Get auth code
                </li>
                <li>
                  <strong>Cloudflare:</strong> Domain → Configuration → Auth Code
                </li>
              </ul>
            </div>
          )}

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Key className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-grey-40" />
              <input
                type={showCode ? "text" : "password"}
                value={authCode}
                onChange={(e) => {
                  setAuthCode(e.target.value)
                  resetVerification()
                }}
                placeholder="Enter your EPP / auth code"
                className={cn(
                  "w-full rounded-base border bg-white py-2 pl-9 pr-10 text-sm text-grey-90 placeholder:text-grey-40 focus:outline-none focus:ring-1 focus:ring-grey-90",
                  validation?.valid && validation?.configured
                    ? "border-emerald-300"
                    : "border-grey-30 focus:border-grey-90"
                )}
              />
              <button
                type="button"
                onClick={() => setShowCode((s) => !s)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-grey-40 hover:text-grey-70"
              >
                {showCode ? <EyeSlash className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <button
              type="button"
              onClick={handleVerify}
              disabled={!domainValid || !codeValid || validating || !allChecked}
              className={btnSecondary}
            >
              {validating ? <Spinner className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {validating ? "Verifying..." : "Verify"}
            </button>
          </div>
          {!allChecked && (
            <p className="mt-2 text-xs text-grey-50">
              Tick the checklist above before verifying.
            </p>
          )}
        </div>
      </div>

      {error && <Callout tone="warning">{error}</Callout>}

      {/* Validation result */}
      {validation && validation.configured === false && (
        <Callout tone="warning" title="We&apos;ll process this transfer manually">
          Live transfers aren&apos;t switched on for your store yet. You can still
          submit — your request goes to our team, who will complete it at the
          registrar using your auth code. Store credits are reserved when you submit.
        </Callout>
      )}

      {validation && validation.configured && validation.valid && validation.eligible && (
        <Callout tone="success" title="Eligible to transfer">
          <span className="inline-flex items-center gap-1">
            <CheckCircleSolid className="h-4 w-4" />
            {validation.message || "This domain is unlocked and eligible. You can start the transfer."}
          </span>
        </Callout>
      )}

      {validation && validation.configured && (!validation.valid || !validation.eligible) && (
        <Callout tone="warning" title="Not ready to transfer yet">
          {validation.message ||
            "The domain isn't eligible yet. Make sure it's unlocked, the auth code is correct, and it's past the 60-day lock, then verify again."}
        </Callout>
      )}

      {/* Confirm */}
      {canSubmit && (
        <div className="space-y-4 rounded-large border border-grey-20 bg-grey-5 p-5">
          <div className="flex items-center gap-3">
            <span className="text-sm text-grey-60">Extend by</span>
            <Select
              value={String(years)}
              onChange={(e) => setYears(Number(e.target.value))}
              className="w-28"
            >
              {[1, 2, 3, 5].map((y) => (
                <option key={y} value={y}>
                  {y} year{y > 1 ? "s" : ""}
                </option>
              ))}
            </Select>
          </div>
          <p className="text-xs text-grey-50">
            The transfer adds a {years}-year extension to the domain&apos;s current
            expiry date, charged from your store credit balance.
          </p>
          <div className="flex justify-end">
            <button onClick={handleSubmit} disabled={submitting} className={btnPrimary}>
              {submitting ? <Spinner className="h-4 w-4 animate-spin" /> : <ArrowDownTray className="h-4 w-4" />}
              {submitting
                ? "Submitting..."
                : validation?.configured === false
                ? "Submit transfer request"
                : "Start transfer"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
