"use client"

import React, { useState } from "react"
import {
  CheckCircleSolid,
  CircleWarningSolid,
  InformationCircleSolid,
  SquareTwoStack,
  CheckMini,
} from "@medusajs/icons"
import { cn } from "@lib/util/cn"
import type { DnsInstruction } from "@lib/merchant-admin/api"

/** Format a USD amount for display. */
export function formatPrice(amount?: number | null, currency?: string): string {
  if (amount == null) return "—"
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency || "USD",
  }).format(amount)
}

type CalloutTone = "info" | "warning" | "success"

const calloutStyles: Record<CalloutTone, { wrap: string; icon: string }> = {
  info: { wrap: "border-sky-200 bg-sky-50 text-sky-900", icon: "text-sky-500" },
  warning: {
    wrap: "border-amber-200 bg-amber-50 text-amber-900",
    icon: "text-amber-500",
  },
  success: {
    wrap: "border-emerald-200 bg-emerald-50 text-emerald-900",
    icon: "text-emerald-500",
  },
}

const calloutIcons: Record<CalloutTone, React.ComponentType<{ className?: string }>> = {
  info: InformationCircleSolid,
  warning: CircleWarningSolid,
  success: CheckCircleSolid,
}

/** A soft, friendly guidance box. Non-technical merchants read these a lot. */
export function Callout({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: CalloutTone
  title?: string
  children?: React.ReactNode
  className?: string
}) {
  const styles = calloutStyles[tone]
  const Icon = calloutIcons[tone]
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-large border px-4 py-3 text-sm",
        styles.wrap,
        className
      )}
    >
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", styles.icon)} />
      <div className="min-w-0 space-y-1">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className="text-[13px] leading-relaxed opacity-90">{children}</div>}
      </div>
    </div>
  )
}

/** A short "how this works" intro shown at the top of each flow. */
export function HowItWorks({
  steps,
}: {
  steps: (React.ReactNode | string)[]
}) {
  return (
    <ol className="grid gap-2 sm:grid-cols-3">
      {steps.map((step, idx) => (
        <li
          key={idx}
          className="flex items-start gap-2.5 rounded-base border border-grey-10 bg-grey-5 px-3 py-2.5"
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-grey-90 text-[11px] font-semibold text-white">
            {idx + 1}
          </span>
          <span className="text-[13px] leading-snug text-grey-70">{step}</span>
        </li>
      ))}
    </ol>
  )
}

/** A numbered vertical step list used inside the connect / transfer flows. */
export function StepList({ steps }: { steps: React.ReactNode[] }) {
  return (
    <ol className="space-y-3">
      {steps.map((step, idx) => (
        <li key={idx} className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-grey-30 bg-white text-xs font-semibold text-grey-70">
            {idx + 1}
          </span>
          <div className="pt-0.5 text-sm text-grey-70">{step}</div>
        </li>
      ))}
    </ol>
  )
}

/** Copy-to-clipboard button used next to DNS values. */
export function CopyButton({
  value,
  label = "Copy",
  className,
}: {
  value: string
  label?: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard unavailable — no-op
    }
  }
  return (
    <button
      type="button"
      onClick={onCopy}
      className={cn(
        "inline-flex items-center gap-1 rounded-base border border-grey-20 bg-white px-2 py-1 text-xs font-medium text-grey-60 transition-colors hover:bg-grey-10 hover:text-grey-90",
        className
      )}
    >
      {copied ? (
        <>
          <CheckMini className="h-3.5 w-3.5 text-emerald-600" />
          Copied
        </>
      ) : (
        <>
          <SquareTwoStack className="h-3.5 w-3.5" />
          {label}
        </>
      )}
    </button>
  )
}

/** A single copyable field (label + monospace value + copy button). */
export function CopyField({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-base border border-grey-20 bg-grey-5 px-3 py-2">
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-grey-50">
          {label}
        </p>
        <p className="truncate font-mono text-sm text-grey-90">{value}</p>
      </div>
      <CopyButton value={value} />
    </div>
  )
}

const KIND_LABEL: Record<DnsInstruction["kind"], string> = {
  cname: "CNAME",
  txt: "TXT",
  note: "NOTE",
}

/**
 * Renders the copy-paste DNS records the merchant must add at their DNS provider.
 * Handles apex "note" guidance (ALIAS / CNAME-flattening) distinctly from real
 * CNAME / TXT records.
 */
export function DnsInstructionsCard({
  instructions,
}: {
  instructions: DnsInstruction[]
}) {
  if (!instructions?.length) return null

  const records = instructions.filter((r) => r.kind !== "note")
  const notes = instructions.filter((r) => r.kind === "note")

  return (
    <div className="space-y-3">
      {notes.map((note, idx) => (
        <Callout key={`note-${idx}`} tone="warning" title="Apex (root) domain">
          {note.value}
        </Callout>
      ))}

      {records.length > 0 && (
        <div className="overflow-hidden rounded-large border border-grey-20">
          <table className="min-w-full text-sm">
            <thead className="bg-grey-10 text-grey-60">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Type</th>
                <th className="px-4 py-2 text-left font-medium">Name / Host</th>
                <th className="px-4 py-2 text-left font-medium">Value</th>
                <th className="px-4 py-2 text-right font-medium">Copy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-grey-10">
              {records.map((record, idx) => (
                <tr key={idx} className="align-top">
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center rounded-full bg-grey-10 px-2 py-0.5 font-mono text-xs font-medium text-grey-70">
                      {KIND_LABEL[record.kind]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-[13px] text-grey-90 break-all">
                    {record.name}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-[13px] text-grey-90 break-all">
                    {record.value}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <CopyButton value={record.value} label="" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/** Primary / secondary button styles reused across the flows. */
export const btnPrimary =
  "inline-flex items-center justify-center gap-1.5 rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-grey-80 disabled:cursor-not-allowed disabled:opacity-50"

export const btnSecondary =
  "inline-flex items-center justify-center gap-1.5 rounded-base border border-grey-30 bg-white px-4 py-2 text-sm font-medium text-grey-90 transition-colors hover:bg-grey-10 disabled:cursor-not-allowed disabled:opacity-50"
